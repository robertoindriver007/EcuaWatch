import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

/**
 * GET /api/swarm — Returns latest swarm agent intel from MongoDB
 * POST /api/swarm — Triggers a Gemini-based "Agent Directive" that:
 *   1. Reads current DB state
 *   2. Identifies gaps in data coverage
 *   3. Proposes new scraper tasks / data sources
 *   4. Writes the directive back into MongoDB for the swarm to consume
 */

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db('ecuador_intel');

    // Fetch latest swarm intelligence entries
    const latestIntel = await db.collection('swarm_intel')
      .find({})
      .sort({ _ingestado: -1 })
      .limit(15)
      .toArray();

    // Fetch system diagnostics
    const latestDiag = await db.collection('analisis.diagnostico')
      .find({})
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();

    // Fetch active alerts
    const alerts = await db.collection('analisis.alertas')
      .find({ severidad: { $in: ['alta', 'critica'] } })
      .sort({ _ingestado: -1 })
      .limit(10)
      .toArray();

    // Collection coverage stats
    const collections = await db.listCollections().toArray();
    const colStats = [];
    for (const col of collections.slice(0, 30)) {
      const count = await db.collection(col.name).estimatedDocumentCount();
      colStats.push({ name: col.name, docs: count });
    }

    return NextResponse.json({
      success: true,
      intel: latestIntel.map(i => ({
        domain: i.domain,
        proposal: typeof i.proposal === 'string' ? i.proposal.slice(0, 300) : '',
        priority: i.priority,
        timestamp: i._ingestado,
      })),
      diagnostics: latestDiag[0] || null,
      alerts: alerts.map(a => ({
        type: a.tipo_alerta,
        severity: a.severidad,
        description: a.descripcion?.slice(0, 200) || '',
      })),
      coverage: colStats.sort((a, b) => b.docs - a.docs),
    });
  } catch (error) {
    console.error('Swarm API Error:', error);
    return NextResponse.json({ success: false, error: 'DB connection failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const directive = body.directive || 'auto';

    const client = await clientPromise;
    const db = client.db('ecuador_intel');

    // Gather context: what collections exist and how many docs
    const collections = await db.listCollections().toArray();
    const coverageMap: Record<string, number> = {};
    for (const col of collections.slice(0, 25)) {
      coverageMap[col.name] = await db.collection(col.name).estimatedDocumentCount();
    }

    // Use Gemini to generate an autonomous improvement directive
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
Eres el "Supervisor IA" de EcuaWatch, un sistema de vigilancia del Estado ecuatoriano.
Tu base de datos actual tiene estas colecciones y cantidades de documentos:
${JSON.stringify(coverageMap, null, 2)}

La directiva solicitada es: "${directive}"

Genera un JSON con un array de exactamente 3 a 5 "tareas de mejora autónomas" que el sistema debería ejecutar.
Cada tarea debe tener:
- "agent": nombre del agente responsable (ej: "DataEngineer", "Researcher", "SecurityAuditor", "MLEngineer", "UXDesigner")
- "task": descripción específica de lo que debe hacer
- "priority": "CRÍTICO" | "ALTA" | "MEDIA"
- "data_source": URL o nombre de portal del gobierno si es un scraper nuevo, o "interno" si es mejora interna
- "estimated_docs": número estimado de documentos que se obtendrían
- "rationale": por qué es importante para ciudadanos y transparencia

Prioriza:
1. Colecciones vacías que deberían tener datos
2. Nuevas fuentes de datos abiertos del gobierno ecuatoriano no cubiertas
3. Mejoras de análisis para cruzar datos existentes

Solo devuelve el JSON crudo, sin markdown ni explicación extra.
    `;

    let tasks;
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'TU_CLAVE_AQUI') {
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();
      tasks = JSON.parse(text.replace(/```json/g, '').replace(/```/g, ''));
    } else {
      tasks = [
        { agent: "DataEngineer", task: "Scraper para datos abiertos CKN del gobierno", priority: "ALTA", data_source: "https://datosabiertos.gob.ec", estimated_docs: 5000, rationale: "Datos abiertos del gobierno sin cubrir" },
        { agent: "Researcher", task: "Buscar APIs de INEC para empleo y pobreza", priority: "CRÍTICO", data_source: "https://ecuadorencifras.gob.ec", estimated_docs: 2000, rationale: "Indicadores sociales vitales" },
      ];
    }

    // Persist the directive for agents to consume
    await db.collection('swarm_directives').insertOne({
      directive,
      tasks,
      generated_by: 'gemini-1.5-flash',
      status: 'pending',
      _ingestado: new Date(),
    });

    return NextResponse.json({ success: true, tasks });
  } catch (error) {
    console.error('Swarm Directive Error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate directive' }, { status: 500 });
  }
}
