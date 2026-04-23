"""
bot_sanador.py — IA de Mantenimiento y Auto-Curación
======================================================
Este script es un "bot sanador" autónomo diseñado para correr en GitHub Actions
y resolver problemas en los web scrapers sin intervención humana.

Funciones:
1. Lee los diagnósticos dejados por `cerebro.py` (ej. advertencias de captchas o timeouts).
2. Modifica dinámicamente el comportamiento de los scrapers (baja la agresividad o rota IPs).
3. Notifica anomalías severas si requiere ayuda humana.
"""

import logging
import sys
import os
import re
from datetime import datetime, timezone
from pymongo import MongoClient

MONGO_URI = os.environ.get(
    "MONGO_URI",
    "mongodb+srv://scraperbot:GJqMqljz4GYBT0PU@cluster0.nz7wcxv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
)
DB_NAME = "ecuador_intel"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [BOT SANADOR] %(message)s", handlers=[logging.StreamHandler(sys.stdout)])
log = logging.getLogger("bot")

def reparar_scrapers(db):
    log.info("🩺 Iniciando diagnóstico automédico del sistema...")
    ultimo_diagnostico = db["analisis.diagnostico"].find_one(sort=[("timestamp", -1)])
    
    if not ultimo_diagnostico:
        log.info("No hay diagnósticos previos. Sistema saludable.")
        return
        
    score = ultimo_diagnostico.get("score_salud", 100)
    problemas = ultimo_diagnostico.get("problemas", [])
    advertencias = ultimo_diagnostico.get("advertencias", [])
    
    log.info(f"Score actual de salud: {score}/100")
    
    if score >= 90 and not problemas:
        log.info("Sistema operando en estado óptimo. No se requiere intervención.")
        return
        
    log.warning(f"Se detectaron {len(problemas)} problemas y {len(advertencias)} advertencias. Intentando curación autónoma...")
    
    # Análisis de los problemas:
    for prob in problemas + advertencias:
        log.info(f"Analizando: {prob}")
        
        # 1. Problema de CAPTCHAS múltiples o WAF Blocks
        if "CAPTCHA detectado" in prob or "tasa de éxito baja" in prob:
            match = re.search(r"en '([\w_.]+)'", prob)
            if match:
                fuente = match.group(1)
                log.info(f"  -> ACCIÓN: Aumentando el 'timeout_base' y forzando rotación de proxy para '{fuente}'.")
                
                db["config_dinamica"].update_one(
                    {"scraper": fuente},
                    {
                        "$set": {
                            "timeout_minimo": 10, 
                            "timeout_maximo": 25, 
                            "forzar_rotacion_proxy": True, 
                            "limite_paginas": 5, 
                            "_actualizado": datetime.now(timezone.utc)
                        }
                    },
                    upsert=True
                )
                
        # 2. Problema de colección VACÍA 
        elif "está VACÍA" in prob or "OBSOLETA" in prob:
            match = re.search(r"Colección '([\w_.]+)'", prob) or re.search(r"'([\w_.]+)' tiene datos", prob)
            if match:
                col_name = match.group(1)
                log.info(f"  -> ACCIÓN: Posible cambio de esquema o bloqueo severo en {col_name}. Flaggeando para resincronización total.")
                # Aquí podemos inyectar un log en el "sync_log" para que el orquestador intente de nuevo.
                db["analisis.alertas"].update_one(
                    {"tipo_alerta": "sistema", "entidad": col_name},
                    {"$set": {
                        "tipo_alerta": "sistema",
                        "severidad": "alta",
                        "entidad": col_name,
                        "descripcion": f"Falla consecutiva o datos obsoletos en {col_name}. La IA de curación no pudo resolverlo localmente. Posible cambio de HTML.",
                        "_ingestado": datetime.now(timezone.utc)
                    }},
                    upsert=True
                )

    log.info("Curación autónoma completada. Las directivas de 'config_dinamica' se aplicarán en el próximo ciclo del orquestador.")

if __name__ == "__main__":
    client = MongoClient(MONGO_URI)
    reparar_scrapers(client[DB_NAME])
    client.close()
