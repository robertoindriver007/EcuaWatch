"""
EcuaWatch Content Generator Agent
═══════════════════════════════════
Agente autónomo que lee datos del gobierno desde MongoDB,
genera alertas y guiones de reels con Gemini, y los inyecta
de vuelta en las colecciones `feed_items` y `reels`.

Se ejecuta cada 6 horas vía GitHub Actions o cron local.
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
    """Call Gemini API with a prompt and return text response."""
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.7}
    }
    try:
        r = requests.post(GEMINI_URL, json=payload, timeout=30)
        r.raise_for_status()
        data = r.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        print(f"[Gemini Error] {e}")
        return ""


def generate_feed_alerts():
    """
    Lee datos recientes de las colecciones fuente,
    genera alertas editoriales con Gemini, y las inyecta en feed_items.
    """
    print("[ContentGen] Generando alertas de feed...")

    # Buscar datos fuente: leyes recientes, contratos, etc.
    source_collections = ["registros_oficiales", "leyes", "contratos_sercop", "alertas"]
    raw_data = []

    for col_name in source_collections:
        col = db[col_name]
        docs = list(col.find().sort("_id", -1).limit(5))
        for doc in docs:
            doc["_id"] = str(doc["_id"])
            doc["_source_collection"] = col_name
        raw_data.extend(docs)

    if not raw_data:
        print("[ContentGen] No hay datos fuente. Generando contenido de demostración...")
        raw_data = [
            {"titulo": "Reforma al Código Tributario Art. 14", "tipo": "ley", "_source_collection": "leyes"},
            {"titulo": "Adjudicación directa $1.8M sin proceso competitivo", "tipo": "contrato", "_source_collection": "contratos_sercop"},
            {"titulo": "Recaudación IVA cae 12% vs 2025", "tipo": "alerta_fiscal", "_source_collection": "alertas"},
        ]

    # Prompt para Gemini
    prompt = f"""Eres el motor de inteligencia de EcuaWatch, una plataforma de vigilancia ciudadana del Estado ecuatoriano.

A partir de los siguientes datos del gobierno, genera exactamente 3 alertas informativas en formato JSON.
Cada alerta debe tener:
- "type": "alert" | "data" | "law"
- "source": nombre institucional (ej: "Contraloría General", "Asamblea Nacional", "SRI", "EcuaWatch IA")
- "sourceCode": 2-3 letras (ej: "CGE", "AN", "SRI")
- "sourceColor": color hex (rojo para alertas, azul para leyes, púrpura para datos IA)
- "badge": emoji + tipo en mayúsculas
- "location": ciudad/provincia relevante
- "province": id de provincia (ej: "guayas", "pichincha")
- "headline": titular impactante, conciso, periodístico
- "body": explicación de 2-3 oraciones con contexto y consecuencias
- "tags": 3 hashtags relevantes
- "impact": "ALTO" | "MEDIO" | "BAJO"
- "aiGenerated": true

Datos fuente:
{json.dumps(raw_data[:10], default=str, ensure_ascii=False, indent=2)}

Responde SOLO con el array JSON, sin texto adicional, sin markdown."""

    response = call_gemini(prompt)
    if not response:
        print("[ContentGen] Gemini no respondió")
        return 0

    # Parsear respuesta
    try:
        # Limpiar respuesta (a veces viene con ```json y ```)
        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1]
        if clean.endswith("```"):
            clean = clean.rsplit("```", 1)[0]
        alerts = json.loads(clean.strip())
    except json.JSONDecodeError as e:
        print(f"[ContentGen] Error parsing JSON: {e}")
        print(f"[ContentGen] Raw response: {response[:500]}")
        return 0

    # Inyectar en MongoDB
    count = 0
    for alert in alerts:
        alert["time"] = "Hace minutos"
        alert["likes"] = 0
        alert["comments"] = 0
        alert["shares"] = 0
        alert["aiGenerated"] = True
        alert["createdAt"] = datetime.now(timezone.utc)
        alert["generatedBy"] = "content_generator_v1"

        # Evitar duplicados por headline
        exists = db.feed_items.find_one({"headline": alert.get("headline", "")})
        if not exists:
            db.feed_items.insert_one(alert)
            count += 1
            print(f"  ✅ Alert: {alert.get('headline', 'N/A')[:60]}...")

    print(f"[ContentGen] {count} alertas nuevas insertadas en feed_items")
    return count


def generate_reel_scripts():
    """
    Genera guiones cortos para Reels Cívicos usando Gemini,
    basados en datos recientes del gobierno.
    """
    print("[ContentGen] Generando guiones de reels...")

    # Tomar las últimas alertas generadas como base
    recent = list(db.feed_items.find({"aiGenerated": True}).sort("createdAt", -1).limit(5))
    for doc in recent:
        doc["_id"] = str(doc["_id"])

    if not recent:
        recent = [
            {"headline": "Anomalía detectada en contratos de emergencia", "body": "7 empresas con el mismo representante legal acumulan el 34% de contratos de insumos médicos."},
            {"headline": "Reforma tributaria aprobada en primer debate", "body": "La nueva tasa a exportaciones agrícolas afecta a exportadores de banano y camarón."},
        ]

    prompt = f"""Eres un productor de contenido de video corto para EcuaWatch, plataforma de vigilancia ciudadana de Ecuador.

Genera 2 guiones de Reels (30-60 segundos) en formato JSON basados en estas noticias recientes.
Cada reel debe ser:
- Informativo pero IMPACTANTE (estilo documental)
- Enfocado en un dato o anomalía específica
- En español latinoamericano neutro

Formato JSON de cada reel:
- "title": titular corto y llamativo (max 60 chars)
- "description": descripción para el feed (max 150 chars)
- "script": guión narrado completo (lo que diría el locutor, 4-6 frases)
- "duration": 30-90 (segundos estimados)
- "category": "Legislativo" | "Datos" | "Denuncia" | "Educativo" | "Investigación"
- "tags": 2-3 hashtags
- "province": id provincia relevante

Noticias base:
{json.dumps(recent[:5], default=str, ensure_ascii=False, indent=2)}

Responde SOLO con el array JSON."""

    response = call_gemini(prompt)
    if not response:
        return 0

    try:
        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1]
        if clean.endswith("```"):
            clean = clean.rsplit("```", 1)[0]
        reels = json.loads(clean.strip())
    except json.JSONDecodeError as e:
        print(f"[ContentGen] Error parsing reel JSON: {e}")
        return 0

    count = 0
    for reel in reels:
        doc = {
            "title": reel.get("title", ""),
            "description": reel.get("description", ""),
            "videoUrl": "",  # Sin video por ahora — se generará en futuro
            "thumbnailUrl": "",
            "duration": reel.get("duration", 60),
            "author": {"name": "EcuaWatch IA", "avatar": "🤖", "verified": True},
            "category": reel.get("category", "Datos"),
            "tags": reel.get("tags", []),
            "likes": 0,
            "comments": 0,
            "shares": 0,
            "views": 0,
            "province": reel.get("province", "pichincha"),
            "aiGenerated": True,
            "script": reel.get("script", ""),
            "createdAt": datetime.now(timezone.utc),
            "generatedBy": "content_generator_v1",
        }

        exists = db.reels.find_one({"title": doc["title"]})
        if not exists:
            db.reels.insert_one(doc)
            count += 1
            print(f"  🎬 Reel: {doc['title'][:50]}...")

    print(f"[ContentGen] {count} reels nuevos insertados")
    return count


def generate_community_posts():
    """
    Genera posts de discusión automáticos para las comunidades
    basados en datos trending.
    """
    print("[ContentGen] Generando posts de comunidad...")

    # Topics basados en alertas recientes
    recent_alerts = list(db.feed_items.find().sort("createdAt", -1).limit(3))
    for doc in recent_alerts:
        doc["_id"] = str(doc["_id"])

    if not recent_alerts:
        return 0

    prompt = f"""Eres un moderador de comunidad de EcuaWatch, plataforma cívica ecuatoriana.

Basado en estas noticias, genera 2 posts de discusión en formato JSON.
Cada post debe:
- Plantear una PREGUNTA abierta al ciudadano
- Dar contexto breve
- Incluir opciones para debatir

Formato:
- "communityId": uno de ["c01" (Guayaquil), "c02" (Asamblea), "c03" (Contraloría), "c06" (Seguridad)]
- "title": título de la discusión (pregunta provocadora)
- "content": 2-3 párrafos con contexto y la pregunta
- "tags": 2-3 hashtags

Noticias:
{json.dumps(recent_alerts[:3], default=str, ensure_ascii=False, indent=2)}

Responde SOLO con el array JSON."""

    response = call_gemini(prompt)
    if not response:
        return 0

    try:
        clean = response.strip()
        if clean.startswith("```"):
            clean = clean.split("\n", 1)[1]
        if clean.endswith("```"):
            clean = clean.rsplit("```", 1)[0]
        posts = json.loads(clean.strip())
    except json.JSONDecodeError:
        return 0

    count = 0
    for post in posts:
        doc = {
            **post,
            "author": {"name": "EcuaWatch IA", "avatar": "🤖"},
            "upvotes": 0,
            "downvotes": 0,
            "comments": 0,
            "replies": [],
            "aiGenerated": True,
            "createdAt": datetime.now(timezone.utc),
            "generatedBy": "content_generator_v1",
        }

        exists = db.community_posts.find_one({"title": doc["title"]})
        if not exists:
            db.community_posts.insert_one(doc)
            count += 1
            print(f"  💬 Post: {doc['title'][:50]}...")

    print(f"[ContentGen] {count} posts de comunidad insertados")
    return count


def seed_initial_data():
    """
    Si la BD está vacía, inyecta los datos orgánicos de seed-content
    para que las APIs funcionen desde el día 1.
    """
    print("[ContentGen] Verificando datos iniciales...")

    feed_count = db.feed_items.count_documents({})
    reels_count = db.reels.count_documents({})
    community_count = db.communities.count_documents({})

    if feed_count == 0:
        print("[Seed] Inyectando feed items orgánicos...")
        from seed_data import FEED_ITEMS
        for item in FEED_ITEMS:
            item["createdAt"] = datetime.now(timezone.utc)
        db.feed_items.insert_many(FEED_ITEMS)
        print(f"  ✅ {len(FEED_ITEMS)} feed items insertados")

    if reels_count == 0:
        print("[Seed] Inyectando reels orgánicos...")
        from seed_data import REELS
        for reel in REELS:
            reel["createdAt"] = datetime.now(timezone.utc)
        db.reels.insert_many(REELS)
        print(f"  ✅ {len(REELS)} reels insertados")

    if community_count == 0:
        print("[Seed] Inyectando comunidades...")
        from seed_data import COMMUNITIES
        db.communities.insert_many(COMMUNITIES)
        print(f"  ✅ {len(COMMUNITIES)} comunidades insertadas")


# ── Main Execution ──────────────────────────────────────
if __name__ == "__main__":
    print("=" * 60)
    print(f"EcuaWatch Content Generator — {datetime.now(timezone.utc).isoformat()}")
    print("=" * 60)

    # Step 1: Seed if empty
    seed_initial_data()

    # Step 2: Generate new content
    alerts = generate_feed_alerts()
    reels = generate_reel_scripts()
    posts = generate_community_posts()

    print("\n" + "=" * 60)
    print(f"RESUMEN: {alerts} alertas + {reels} reels + {posts} posts generados")
    print("=" * 60)

    client.close()
