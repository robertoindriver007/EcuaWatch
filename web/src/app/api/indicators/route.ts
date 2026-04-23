import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini with the API KEY
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function GET() {
  try {
    // Attempt Database connection
    const client = await clientPromise;
    const db = client.db(process.env.MONGODB_DB || 'asamblea_ecuador');
    
    // Fetch latest laws or data to feed into the prompt (context)
    const latestLaws = await db.collection('proyectos_de_ley').find({}).sort({ date_created: -1 }).limit(3).toArray();
    const lawsContext = latestLaws.map(l => l.title || l._id).join(', ');

    // Gemini Prompt to generate live traceability and stats
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
      Eres el motor analítico de EcuaWatch. A continuación te doy contexto de 3 leyes recientes: ${lawsContext || 'Ninguna reciente'}.
      Genera un JSON estrictamente válido que represente 5 indicadores macroeconómicos de Ecuador actuales (estimados si no hay data).
      El JSON debe ser un array de objetos con las llaves: 
      - "id" (string)
      - "title" (string, ej: "Inflación Mensual")
      - "value" (string, ej: "1.4%")
      - "trend" ("up" o "down")
      - "cause" (string corto, por qué está así)
      - "effect" (string corto, a quién afecta)
      - "traceability" (string, responsables o ley vinculada).
      
      No incluyas markdown \`\`\`json, SOLO devuélveme el array JSON crudo.
    `;

    // Only run Gemini if API Key is set to avoid crashing during development without keys
    let aiData;
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'TU_CLAVE_AQUI') {
      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();
      aiData = JSON.parse(responseText.replace(/```json/g, '').replace(/```/g, ''));
    } else {
      // Fallback mock data if no key is present
      aiData = [
        {
          id: "1", title: "Riesgo País", value: "1,150 pts", trend: "down",
          cause: "Acuerdo técnico preliminar con el FMI",
          effect: "Reducción leve en tasas de interés para bonos",
          traceability: "Ministerio de Finanzas / Ley Económica Urgente"
        },
        {
          id: "2", title: "Ejecución Presupuestaria M.", value: "32%", trend: "down",
          cause: "Bloqueos burocráticos en SERCOP y falta de liquidez",
          effect: "Atraso en obra pública y pagos a proveedores",
          traceability: "Asignaciones MEF / Contraloría General"
        }
      ];
    }

    return NextResponse.json({ success: true, indicators: aiData });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false, error: "Failed to fetch indicators." }, { status: 500 });
  }
}
