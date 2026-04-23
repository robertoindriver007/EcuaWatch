"""
EcuaWatch Autonomous Director Agent
═══════════════════════════════════════
Agente IA Director que administra la plataforma de forma autónoma.
Responsabilidades:
  1. CONTENIDO: Genera alertas, reels, posts de comunidad
  2. ESTRUCTURA: Audita la web, detecta secciones muertas, propone mejoras
  3. SEO: Genera meta tags, títulos, descripciones para cada sección
  4. CALIDAD: Revisa contenido existente, mejora titulares débiles
  5. CRECIMIENTO: Analiza métricas, identifica tendencias, sugiere nuevos temas

Se ejecuta cada 6 horas vía GitHub Actions.
"""

import os
import json
import requests
from datetime import datetime, timezone
from pymongo import MongoClient

# ── Config ──────────────────────────────────────────────
MONGO_URI = os.environ.get("MONGODB_URI", "mongodb+srv://scraperbot:GJqMqljz4GYBT0PU@cluster0.nz7wcxv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
MONGO_DB = os.environ.get("MONGODB_DB", "ecuador_intel")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY", "AIzaSyAgIVcZH3DFtXf8f2DAzr2caEyjTyWAVAQ")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_KEY}"

# ── MongoDB ─────────────────────────────────────────────
client = MongoClient(MONGO_URI)
db = client[MONGO_DB]


def call_gemini(prompt: str, max_tokens: int = 2048) -> str:
    """Call Gemini API with retry logic."""
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.7}
    }
    for attempt in range(3):
        try:
            r = requests.post(GEMINI_URL, json=payload, timeout=30)
            r.raise_for_status()
            data = r.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
        except requests.exceptions.HTTPError as e:
            if r.status_code == 429:
                import time
                wait = (attempt + 1) * 10
                print(f"[Gemini] Rate limited. Waiting {wait}s...")
                time.sleep(wait)
            else:
                print(f"[Gemini Error] {e}")
                return ""
        except Exception as e:
            print(f"[Gemini Error] {e}")
            return ""
    return ""


def parse_json_response(response: str) -> list:
    """Safely parse JSON from Gemini response."""
    if not response:
        return []
    clean = response.strip()
    if clean.startswith("```"):
        clean = clean.split("\n", 1)[1]
    if clean.endswith("```"):
        clean = clean.rsplit("```", 1)[0]
    try:
        result = json.loads(clean.strip())
        return result if isinstance(result, list) else [result]
    except json.JSONDecodeError as e:
        print(f"[Parse Error] {e}")
        return []


# ═══════════════════════════════════════════════════════
# AGENTE 1: GENERADOR DE CONTENIDO
# ═══════════════════════════════════════════════════════

def agent_content_feed():
    """Genera alertas editoriales para el feed principal."""
    print("\n[AGENTE:Feed] Generando alertas de feed...")

    source_collections = ["registros_oficiales", "leyes", "contratos_sercop", "alertas"]
    raw_data = []
    for col_name in source_collections:
        docs = list(db[col_name].find().sort("_id", -1).limit(5))
        for doc in docs:
            doc["_id"] = str(doc["_id"])
            doc["_source"] = col_name
        raw_data.extend(docs)

    if not raw_data:
        raw_data = [
            {"titulo": "Reforma al Codigo Tributario Art. 14", "tipo": "ley"},
            {"titulo": "Adjudicacion directa $1.8M sin proceso competitivo", "tipo": "contrato"},
            {"titulo": "Recaudacion IVA cae 12% vs 2025", "tipo": "alerta_fiscal"},
        ]

    prompt = f"""Eres el motor de inteligencia de EcuaWatch, plataforma de vigilancia ciudadana del Estado ecuatoriano.

Genera exactamente 3 alertas periodisticas en formato JSON array.
Cada alerta:
- "type": "alert" | "data" | "law"
- "source": nombre institucional (ej: "Contraloria General", "Asamblea Nacional", "SRI")
- "sourceCode": 2-3 letras
- "sourceColor": hex color
- "badge": emoji + tipo en mayusculas
- "location": ciudad/provincia
- "province": id provincia (ej: "guayas", "pichincha")
- "headline": titular impactante, conciso
- "body": 2-3 oraciones con contexto
- "tags": 3 hashtags
- "impact": "ALTO" | "MEDIO" | "BAJO"
- "aiGenerated": true

Datos fuente:
{json.dumps(raw_data[:8], default=str, ensure_ascii=False, indent=2)}

Responde SOLO con el array JSON."""

    alerts = parse_json_response(call_gemini(prompt))
    count = 0
    for alert in alerts:
        alert["time"] = "Hace minutos"
        alert["likes"] = 0
        alert["comments"] = 0
        alert["shares"] = 0
        alert["aiGenerated"] = True
        alert["createdAt"] = datetime.now(timezone.utc)
        alert["generatedBy"] = "director_v2"

        if not db.feed_items.find_one({"headline": alert.get("headline", "")}):
            db.feed_items.insert_one(alert)
            count += 1
            print(f"  [+] {alert.get('headline', 'N/A')[:60]}...")

    print(f"[AGENTE:Feed] {count} alertas insertadas")
    return count


def agent_content_reels():
    """Genera guiones de Reels civicos."""
    print("\n[AGENTE:Reels] Generando guiones de reels...")

    recent = list(db.feed_items.find({"aiGenerated": True}).sort("createdAt", -1).limit(5))
    for doc in recent:
        doc["_id"] = str(doc["_id"])

    if not recent:
        recent = [
            {"headline": "Anomalia detectada en contratos de emergencia", "body": "7 empresas acumulan 34% de contratos de insumos medicos."},
        ]

    prompt = f"""Eres productor de video corto para EcuaWatch, plataforma de vigilancia ciudadana de Ecuador.

Genera 2 guiones de Reels (30-60 seg) en formato JSON array.
Cada reel:
- "title": max 60 chars, llamativo
- "description": max 150 chars
- "script": guion narrado (4-6 frases)
- "duration": 30-90
- "category": "Legislativo" | "Datos" | "Denuncia" | "Educativo" | "Investigacion"
- "tags": 2-3 hashtags
- "province": id provincia

Noticias base:
{json.dumps(recent[:5], default=str, ensure_ascii=False, indent=2)}

Responde SOLO con el array JSON."""

    reels = parse_json_response(call_gemini(prompt))
    count = 0
    for reel in reels:
        doc = {
            "title": reel.get("title", ""),
            "description": reel.get("description", ""),
            "videoUrl": "",
            "thumbnailUrl": "",
            "duration": reel.get("duration", 60),
            "author": {"name": "EcuaWatch IA", "avatar": "🤖", "verified": True},
            "category": reel.get("category", "Datos"),
            "tags": reel.get("tags", []),
            "likes": 0, "comments": 0, "shares": 0, "views": 0,
            "province": reel.get("province", "pichincha"),
            "aiGenerated": True,
            "script": reel.get("script", ""),
            "createdAt": datetime.now(timezone.utc),
            "generatedBy": "director_v2",
        }

        if not db.reels.find_one({"title": doc["title"]}):
            db.reels.insert_one(doc)
            count += 1
            print(f"  [+] {doc['title'][:50]}...")

    print(f"[AGENTE:Reels] {count} reels insertados")
    return count


def agent_content_community():
    """Genera posts de discusion para comunidades."""
    print("\n[AGENTE:Comunidad] Generando posts de debate...")

    recent = list(db.feed_items.find().sort("createdAt", -1).limit(3))
    for doc in recent:
        doc["_id"] = str(doc["_id"])

    if not recent:
        return 0

    prompt = f"""Eres moderador de comunidad de EcuaWatch, plataforma civica ecuatoriana.

Genera 2 posts de discusion en formato JSON array.
Cada post:
- "communityId": "c01" (Guayaquil) | "c02" (Asamblea) | "c03" (Contraloria) | "c06" (Seguridad)
- "title": pregunta provocadora que invite al debate
- "content": 2-3 parrafos con contexto y pregunta
- "tags": 2-3 hashtags

Noticias:
{json.dumps(recent[:3], default=str, ensure_ascii=False, indent=2)}

Responde SOLO con el array JSON."""

    posts = parse_json_response(call_gemini(prompt))
    count = 0
    for post in posts:
        doc = {
            **post,
            "author": {"name": "EcuaWatch IA", "avatar": "🤖"},
            "upvotes": 0, "downvotes": 0, "comments": 0,
            "replies": [],
            "aiGenerated": True,
            "createdAt": datetime.now(timezone.utc),
            "generatedBy": "director_v2",
        }

        if not db.community_posts.find_one({"title": doc["title"]}):
            db.community_posts.insert_one(doc)
            count += 1
            print(f"  [+] {doc['title'][:50]}...")

    print(f"[AGENTE:Comunidad] {count} posts insertados")
    return count


# ═══════════════════════════════════════════════════════
# AGENTE 2: AUDITOR DE CALIDAD
# ═══════════════════════════════════════════════════════

def agent_quality_audit():
    """Revisa contenido existente y mejora titulares debiles."""
    print("\n[AGENTE:Calidad] Auditando contenido existente...")

    # Find items with low engagement that might need better titles
    weak_items = list(db.feed_items.find(
        {"likes": 0, "comments": 0, "shares": 0, "aiGenerated": True}
    ).sort("createdAt", 1).limit(5))

    if not weak_items:
        print("[AGENTE:Calidad] No hay items debiles para mejorar")
        return 0

    for doc in weak_items:
        doc["_id"] = str(doc["_id"])

    headlines = [{"id": d["_id"], "headline": d.get("headline", ""), "body": d.get("body", "")[:100]} for d in weak_items]

    prompt = f"""Eres editor jefe de EcuaWatch. Revisa estos titulares y mejora los que sean debiles.

Titulares actuales:
{json.dumps(headlines, ensure_ascii=False, indent=2)}

Criterios de mejora:
- Mas impactante y periodistico
- Datos concretos (porcentajes, montos, fechas)
- Urgencia y relevancia ciudadana
- Max 90 caracteres

Responde con JSON array donde cada item tenga:
- "id": el id original
- "improved_headline": el titular mejorado (o null si ya esta bien)
- "reason": por que se mejoro

Responde SOLO con el array JSON."""

    improvements = parse_json_response(call_gemini(prompt))
    count = 0
    for imp in improvements:
        if imp.get("improved_headline") and imp.get("id"):
            from bson import ObjectId
            try:
                db.feed_items.update_one(
                    {"_id": ObjectId(imp["id"])},
                    {"$set": {
                        "headline": imp["improved_headline"],
                        "improvedAt": datetime.now(timezone.utc),
                        "improvementReason": imp.get("reason", "")
                    }}
                )
                count += 1
                print(f"  [~] Mejorado: {imp['improved_headline'][:60]}...")
            except Exception:
                pass

    print(f"[AGENTE:Calidad] {count} titulares mejorados")
    return count


# ═══════════════════════════════════════════════════════
# AGENTE 3: ANALISTA DE TENDENCIAS
# ═══════════════════════════════════════════════════════

def agent_trends_analyzer():
    """Analiza contenido existente, identifica gaps y sugiere nuevos temas."""
    print("\n[AGENTE:Tendencias] Analizando cobertura...")

    # Count by province and category
    pipeline = [
        {"$group": {"_id": "$province", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    province_coverage = list(db.feed_items.aggregate(pipeline))

    category_pipeline = [
        {"$group": {"_id": "$type", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}
    ]
    type_coverage = list(db.feed_items.aggregate(category_pipeline))

    ALL_PROVINCES = [
        "guayas", "pichincha", "manabi", "azuay", "santo-domingo", "el-oro",
        "esmeraldas", "tungurahua", "los-rios", "chimborazo", "loja",
        "imbabura", "cotopaxi", "canar", "bolivar", "carchi", "sucumbios",
        "morona-santiago", "orellana", "napo", "pastaza", "zamora-chinchipe",
        "santa-elena", "galapagos"
    ]

    covered = {p["_id"] for p in province_coverage if p["_id"]}
    gaps = [p for p in ALL_PROVINCES if p not in covered]

    # Store analysis
    analysis = {
        "timestamp": datetime.now(timezone.utc),
        "total_feed_items": db.feed_items.count_documents({}),
        "total_reels": db.reels.count_documents({}),
        "total_communities": db.communities.count_documents({}),
        "total_posts": db.community_posts.count_documents({}),
        "province_coverage": province_coverage,
        "type_coverage": type_coverage,
        "coverage_gaps": gaps[:10],
        "generatedBy": "director_v2",
    }

    db.swarm_analytics.replace_one(
        {"type": "trends_report"},
        {**analysis, "type": "trends_report"},
        upsert=True
    )

    print(f"  Total: {analysis['total_feed_items']} feed + {analysis['total_reels']} reels + {analysis['total_posts']} posts")
    print(f"  Gaps: {', '.join(gaps[:5])}{'...' if len(gaps) > 5 else ''}")
    return len(gaps)


# ═══════════════════════════════════════════════════════
# AGENTE 4: DIAGNOSTICO DEL SISTEMA
# ═══════════════════════════════════════════════════════

def agent_system_diagnostics():
    """Genera un reporte de salud del ecosistema y lo guarda en MongoDB."""
    print("\n[AGENTE:Diagnostico] Evaluando salud del sistema...")

    collections = db.list_collection_names()
    stats = {}
    for col_name in collections:
        stats[col_name] = db[col_name].count_documents({})

    # Calculate health score
    feed_count = stats.get("feed_items", 0)
    reels_count = stats.get("reels", 0)
    community_count = stats.get("communities", 0)

    score = 0
    score += min(30, feed_count * 3)      # Max 30 for 10+ feed items
    score += min(20, reels_count * 4)     # Max 20 for 5+ reels
    score += min(20, community_count * 3) # Max 20 for 7+ communities
    score += 15 if stats.get("community_posts", 0) > 0 else 0  # Has posts
    score += 15 if stats.get("swarm_analytics", 0) > 0 else 0  # Has analytics

    diagnostic = {
        "type": "system_health",
        "timestamp": datetime.now(timezone.utc),
        "collections": stats,
        "health_score": min(score, 100),
        "status": "healthy" if score >= 70 else "degraded" if score >= 40 else "critical",
        "generatedBy": "director_v2",
    }

    db.swarm_analytics.replace_one(
        {"type": "system_health"},
        diagnostic,
        upsert=True
    )

    print(f"  Salud: {diagnostic['health_score']}/100 ({diagnostic['status']})")
    print(f"  Colecciones: {len(collections)} ({', '.join(f'{k}:{v}' for k, v in stats.items())})")
    return diagnostic["health_score"]


# ═══════════════════════════════════════════════════════
# SEED INICIAL
# ═══════════════════════════════════════════════════════

def seed_initial_data():
    """Inyecta datos organicos si la BD esta vacia."""
    print("[Seed] Verificando datos iniciales...")

    if db.feed_items.count_documents({}) == 0:
        print("[Seed] Inyectando feed items...")
        from seed_data import FEED_ITEMS
        for item in FEED_ITEMS:
            item["createdAt"] = datetime.now(timezone.utc)
        db.feed_items.insert_many(FEED_ITEMS)
        print(f"  [+] {len(FEED_ITEMS)} feed items")

    if db.reels.count_documents({}) == 0:
        print("[Seed] Inyectando reels...")
        from seed_data import REELS
        for reel in REELS:
            reel["createdAt"] = datetime.now(timezone.utc)
        db.reels.insert_many(REELS)
        print(f"  [+] {len(REELS)} reels")

    if db.communities.count_documents({}) == 0:
        print("[Seed] Inyectando comunidades...")
        from seed_data import COMMUNITIES
        db.communities.insert_many(COMMUNITIES)
        print(f"  [+] {len(COMMUNITIES)} comunidades")


# ═══════════════════════════════════════════════════════
# MAIN — ORQUESTACION AUTONOMA
# ═══════════════════════════════════════════════════════

if __name__ == "__main__":
    print("=" * 60)
    print(f"EcuaWatch Director Autonomo v2 | {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    # 1. Seed si vacio
    seed_initial_data()

    # 2. Diagnostico del sistema
    health = agent_system_diagnostics()

    # 3. Analisis de tendencias
    gaps = agent_trends_analyzer()

    # 4. Generacion de contenido
    alerts = agent_content_feed()
    reels = agent_content_reels()
    posts = agent_content_community()

    # 5. Mejora de calidad
    improved = agent_quality_audit()

    # 6. Reporte final
    report = {
        "type": "execution_report",
        "timestamp": datetime.now(timezone.utc),
        "results": {
            "health_score": health,
            "coverage_gaps": gaps,
            "alerts_generated": alerts,
            "reels_generated": reels,
            "posts_generated": posts,
            "headlines_improved": improved,
        },
        "generatedBy": "director_v2",
    }
    db.swarm_analytics.insert_one(report)

    print("\n" + "=" * 60)
    print(f"DIRECTOR v2 COMPLETADO")
    print(f"  Salud: {health}/100")
    print(f"  Contenido: {alerts} alertas + {reels} reels + {posts} posts")
    print(f"  Calidad: {improved} titulares mejorados")
    print(f"  Gaps: {gaps} provincias sin cobertura")
    print("=" * 60)

    client.close()
