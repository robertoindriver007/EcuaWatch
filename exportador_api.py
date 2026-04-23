"""
exportador_api.py — Puente Backend a Frontend Estático (GitHub Pages)
===================================================================
Para que el Dashboard sea 100% gratuito (sin costos de servidor Node.js/Python),
este script pre-calcula los JSON gigantes (Grafos, Alertas, Resúmenes) desde MongoDB
y los guarda en una carpeta `./dashboard/public/data/`. 
Luego, GitHub Actions commitea estos JSONs y los publica en GitHub Pages.

Optimización implementada: Formato adaptado específicamente para Sigma.js / Graphology.
"""

import json
import os
import sys
import logging
from pymongo import MongoClient

MONGO_URI = os.environ.get(
    "MONGO_URI",
    "mongodb+srv://scraperbot:GJqMqljz4GYBT0PU@cluster0.nz7wcxv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
)
DB_NAME = "ecuador_intel"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [EXPORTADOR] %(message)s", handlers=[logging.StreamHandler(sys.stdout)])
log = logging.getLogger("exportador")

def exportar_grafo_sigmajs(db, output_dir_base):
    """
    Genera el grafo de poder exportando nodos y ejes (edges) formateados para Sigma.js
    (x, y, size, color, label requeridos).
    """
    log.info("Exportando Grafo de Poder masivo...")
    
    # Obtenemos los vínculos (entidades) con mayor peso
    nodes = []
    edges = []
    
    # Mapeo para evitar duplicados en ejes y mantener acceso rápido a IDs
    nodos_agregados = set()
    
    # 1. Traer a los "peso pesados" (proveedores y entidades más relevantes)
    for perfil in db["analisis.vinculos"].find({"score_relevancia": {"$gte": 0}}, limit=2000):
        ruc = perfil.get("ruc")
        if not ruc: continue
        
        tipo = perfil.get("tipo", "desconocido") # publico, privado
        color = "#e53e3e" if tipo == "privado" else "#3182ce"
        size = min(max(perfil.get("score_relevancia", 10) / 10, 3), 30)
        
        nodes.append({
            "key": ruc,
            "attributes": {
                "label": perfil.get("nombre", ruc),
                "x": 0, # Graphology ForceAtlas2 calculará esto en el web worker
                "y": 0,
                "size": size,
                "color": color,
                "tipo": tipo,
                "score": perfil.get("score_relevancia", 0)
            }
        })
        nodos_agregados.add(ruc)
        
    # 2. Reconstruir los 'edges' usando la base de contratos
    # Limitamos para no sobrecargar el JSON inicial estático
    log.info(f"Nodos calculados: {len(nodes)}. Buscando relaciones contractuales...")
    
    edge_id_counter = 0
    contratos = db["contratacion.contratos"].find(
        {"proveedor_ruc": {"$in": list(nodos_agregados)}, "entidad_id": {"$in": list(nodos_agregados)}},
        limit=5000
    )
    
    # Agrupar por par Entidad-Proveedor para sumar el peso de enlace
    enlaces = {}
    for c in contratos:
        src = c.get("entidad_id")
        dst = c.get("proveedor_ruc")
        monto = c.get("monto", 0)
        try: monto = float(monto)
        except: monto = 0
            
        pair = f"{src}-{dst}"
        if pair not in enlaces:
            enlaces[pair] = {"source": src, "target": dst, "weight": 0, "monto_total": 0, "contratos": 0}
            
        enlaces[pair]["weight"] += 1
        enlaces[pair]["monto_total"] += monto
        enlaces[pair]["contratos"] += 1
        
    for k, info in enlaces.items():
        edges.append({
            "key": f"e{edge_id_counter}",
            "source": info["source"],
            "target": info["target"],
            "attributes": {
                "size": min(info["weight"], 10),
                "color": "#4a5568",
                "monto_format": f"${info['monto_total']:,.0f}",
                "contratos_count": info["contratos"]
            }
        })
        edge_id_counter += 1

    graph_data = {"nodes": nodes, "edges": edges}
    
    # Asegurar directorio
    os.makedirs(output_dir_base, exist_ok=True)
    out_file = os.path.join(output_dir_base, "grafo_sigma.json")
    
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(graph_data, f, ensure_ascii=False)
        
    log.info(f"Grafo exportado: {len(nodes)} nodos, {len(edges)} ejes -> {out_file}")


def exportar_alertas(db, output_dir_base):
    log.info("Exportando panel de alarmas y sobreprecios...")
    alertas = list(db["analisis.alertas"].find({}, {"_id": 0}).sort("_ingestado", -1).limit(300))
    
    # Formatear datetime a str
    for a in alertas:
        if "_ingestado" in a and isinstance(a["_ingestado"], datetime):
            a["_ingestado"] = a["_ingestado"].isoformat()
            
    out_file = os.path.join(output_dir_base, "alertas.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(alertas, f, ensure_ascii=False)
    log.info(f"Alertas exportadas: {len(alertas)} elementos.")

if __name__ == "__main__":
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    # Path del frontend donde se dejarán los datos estáticos procesados
    data_dir = os.path.join(os.path.dirname(__file__), "dashboard", "public", "data")
    os.makedirs(data_dir, exist_ok=True)
    
    exportar_grafo_sigmajs(db, data_dir)
    exportar_alertas(db, data_dir)
    
    client.close()
    log.info("✅ Exportación completa. Los archivos están listos para Git/GitHub Pages.")
