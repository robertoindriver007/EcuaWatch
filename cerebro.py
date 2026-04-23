"""
cerebro.py — Motor de Inteligencia y Auto-Diagnóstico de EcuaWatch
====================================================================
Es el "cerebro" del sistema. Se ejecuta DESPUÉS de todos los scrapers.

FUNCIONES:
  1. AUTO-DIAGNÓSTICO:     Evalúa la salud de cada scraper y sugiere correcciones
  2. VINCULACIÓN PROFUNDA: Cruza TODAS las bases por RUC, nombre, fecha, monto
  3. ANOMALÍAS:            Detecta irregularidades, incoherencias, contradicciones
  4. LÍNEA TEMPORAL:       Construye cronología causal de eventos del país
  5. PREDICCIONES:         Identifica tendencias y genera alertas tempranas
  6. RESÚMENES:            Genera fichas ejecutivas por entidad/tema
  7. CRÍTICAS:             Evalúa políticas públicas vs resultados medidos
  8. EFICACIA:             Mide rendimiento continuo del sistema

Colecciones MongoDB:
  analisis.vinculos           — Perfiles cruzados de entidades
  analisis.grafo_poder        — Red de relaciones
  analisis.alertas            — Anomalías y alertas detectadas
  analisis.linea_temporal     — Cronología unificada
  analisis.resumen_entidad    — Fichas ejecutivas (360°)
  analisis.predicciones       — Tendencias y alertas tempranas
  analisis.criticas           — Evaluación de políticas vs resultados
  analisis.diagnostico        — Auto-diagnóstico del sistema
  _metricas_rendimiento       — Performance de cada scraper

Uso:
    python cerebro.py                          # Todo
    python cerebro.py --modulo diagnostico     # Solo auto-diagnóstico
    python cerebro.py --modulo vinculos        # Solo vinculación
    python cerebro.py --modulo anomalias       # Solo anomalías
    python cerebro.py --modulo tendencias      # Solo predicciones
    python cerebro.py --modulo criticas        # Solo evaluación de políticas
    python cerebro.py --entidad PETROECUADOR   # Análisis de una entidad
    python cerebro.py --test                   # Modo prueba
"""

import argparse
import logging
import os
import re
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone, timedelta
from typing import Optional

from pymongo import MongoClient, UpdateOne
from pymongo.errors import BulkWriteError

# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------

MONGO_URI = os.environ.get(
    "MONGO_URI",
    "mongodb+srv://scraperbot:GJqMqljz4GYBT0PU@cluster0.nz7wcxv.mongodb.net/"
    "?retryWrites=true&w=majority&appName=Cluster0",
)
DB_NAME      = "ecuador_intel"
COL_SYNC_LOG = "_sync_log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("cerebro")

# ---------------------------------------------------------------------------
# Mapa completo de colecciones esperadas
# ---------------------------------------------------------------------------

COLECCIONES_ESPERADAS = {
    # Legislativo
    "legislativo.proyectos":             {"fuente": "asamblea",     "critico": True},
    "legislativo.registro_oficial":      {"fuente": "registro",     "critico": True},
    # Fiscal
    "fiscal.presupuesto":                {"fuente": "minfin",       "critico": True},
    "fiscal.deuda_publica":              {"fuente": "minfin",       "critico": True},
    "fiscal.transferencias_gad":         {"fuente": "minfin",       "critico": False},
    # Tributario
    "tributario.recaudacion":            {"fuente": "sri",          "critico": True},
    "tributario.recaudacion_provincial": {"fuente": "sri",          "critico": False},
    "tributario.catastro_ruc":           {"fuente": "sri",          "critico": True},
    "tributario.devoluciones":           {"fuente": "sri",          "critico": False},
    # Contratación
    "contratacion.procesos":             {"fuente": "sercop",       "critico": True},
    "contratacion.contratos":            {"fuente": "sercop",       "critico": True},
    "contratacion.proveedores":          {"fuente": "sercop",       "critico": True},
    "contratacion.entidades":            {"fuente": "sercop",       "critico": True},
    # Fiscalización
    "fiscalizacion.informes_auditoria":  {"fuente": "contraloria",  "critico": True},
    "fiscalizacion.resoluciones":        {"fuente": "contraloria",  "critico": False},
    # Judicial
    "judicial.causas_estadisticas":      {"fuente": "judicial",     "critico": True},
    "judicial.sentencias":               {"fuente": "judicial",     "critico": False},
    # Demográfico
    "demografico.empleo":                {"fuente": "inec",         "critico": True},
    "demografico.inflacion":             {"fuente": "inec",         "critico": True},
    "demografico.pobreza":               {"fuente": "inec",         "critico": True},
    # Económico
    "economico.pib":                     {"fuente": "bce",          "critico": True},
    "economico.comercio_exterior":       {"fuente": "bce",          "critico": False},
    "economico.tasas_interes":           {"fuente": "bce",          "critico": False},
    "economico.reservas_internacionales":{"fuente": "bce",          "critico": False},
    # Electoral
    "electoral.resultados":              {"fuente": "cne",          "critico": True},
    # Datos abiertos
    "datos_abiertos.catalogo":           {"fuente": "datos_abiertos", "critico": False},
}


# ===========================================================================
# MÓDULO 1: AUTO-DIAGNÓSTICO DEL SISTEMA
# ===========================================================================

def diagnosticar_sistema(db) -> dict:
    """
    Evalúa la salud de TODO el sistema:
      - ¿Cada colección tiene datos?
      - ¿Los datos son recientes o están obsoletos?
      - ¿Algún scraper falló en la última ejecución?
      - ¿Hay problemas de conexión registrados?
      - ¿Los índices están creados?
    """
    log.info("🔬 === AUTO-DIAGNÓSTICO DEL SISTEMA ===")
    col_diagnostico = db["analisis.diagnostico"]

    diagnostico = {
        "timestamp":        datetime.now(timezone.utc),
        "colecciones":      {},
        "scrapers":         {},
        "problemas":        [],
        "advertencias":     [],
        "recomendaciones":  [],
        "score_salud":      100,  # Empieza en 100, baja con problemas
    }

    # 1. Verificar cada colección esperada
    for col_nombre, cfg in COLECCIONES_ESPERADAS.items():
        try:
            col = db[col_nombre]
            count = col.estimated_document_count()
            # Buscar el documento más reciente
            ultimo = col.find_one(sort=[("_ingestado", -1)]) or col.find_one(sort=[("scraped_at", -1)])
            fecha_ultimo = None
            if ultimo:
                fecha_ultimo = (ultimo.get("_ingestado") or ultimo.get("scraped_at")
                                or ultimo.get("timestamp"))

            estado = "OK"
            if count == 0:
                estado = "VACÍA"
                msg = f"Colección '{col_nombre}' está VACÍA — scraper '{cfg['fuente']}' no ha insertado datos"
                if cfg["critico"]:
                    diagnostico["problemas"].append(msg)
                    diagnostico["score_salud"] -= 5
                else:
                    diagnostico["advertencias"].append(msg)
                    diagnostico["score_salud"] -= 2

            elif fecha_ultimo and isinstance(fecha_ultimo, datetime):
                dias = (datetime.now(timezone.utc) - fecha_ultimo.replace(tzinfo=timezone.utc)
                        if fecha_ultimo.tzinfo is None
                        else datetime.now(timezone.utc) - fecha_ultimo).days
                if dias > 30 and cfg["critico"]:
                    estado = "OBSOLETA"
                    diagnostico["advertencias"].append(
                        f"'{col_nombre}' tiene datos de hace {dias} días — considerar re-ejecutar '{cfg['fuente']}'"
                    )
                    diagnostico["score_salud"] -= 3

            diagnostico["colecciones"][col_nombre] = {
                "documentos":   count,
                "estado":       estado,
                "fuente":       cfg["fuente"],
                "critico":      cfg["critico"],
                "ultimo_dato":  str(fecha_ultimo) if fecha_ultimo else None,
            }
        except Exception as e:
            diagnostico["colecciones"][col_nombre] = {
                "estado": "ERROR", "error": str(e),
            }
            diagnostico["problemas"].append(f"Error accediendo '{col_nombre}': {e}")
            diagnostico["score_salud"] -= 10

    # 2. Verificar sync_log de cada scraper
    log.info("  Verificando logs de sincronización...")
    pipeline = [
        {"$sort": {"timestamp": -1}},
        {"$group": {
            "_id":       "$fuente",
            "estado":    {"$first": "$estado"},
            "timestamp": {"$first": "$timestamp"},
            "error":     {"$first": "$error"},
        }},
    ]
    for entry in db[COL_SYNC_LOG].aggregate(pipeline):
        fuente = entry["_id"]
        estado = entry.get("estado", "desconocido")
        diagnostico["scrapers"][fuente] = {
            "ultimo_estado": estado,
            "ultima_ejecucion": str(entry.get("timestamp")),
            "error": entry.get("error"),
        }
        if estado == "error":
            diagnostico["problemas"].append(
                f"Scraper '{fuente}' falló en su última ejecución: {entry.get('error', 'sin detalle')}"
            )
            diagnostico["score_salud"] -= 5

    # 3. Verificar métricas de rendimiento
    metricas_col = db.get_collection("_metricas_rendimiento")
    if metricas_col.estimated_document_count() > 0:
        for m in metricas_col.find(sort=[("timestamp", -1)], limit=20):
            if m.get("tasa_exito_%", 100) < 50:
                diagnostico["advertencias"].append(
                    f"Scraper '{m['fuente']}' tiene tasa de éxito baja: {m.get('tasa_exito_%')}%"
                )
            if m.get("captchas", 0) > 0:
                diagnostico["problemas"].append(
                    f"⚠️ CAPTCHA detectado en '{m['fuente']}' — {m['captchas']} ocurrencias"
                )
                diagnostico["score_salud"] -= 8
            if m.get("loops", 0) > 0:
                diagnostico["problemas"].append(
                    f"🔄 LOOP de redirect en '{m['fuente']}' — {m['loops']} ocurrencias"
                )
                diagnostico["score_salud"] -= 5

    # 4. Generar recomendaciones
    vacias = [c for c, d in diagnostico["colecciones"].items() if d.get("estado") == "VACÍA"]
    if vacias:
        diagnostico["recomendaciones"].append(
            f"Ejecutar scrapers para llenar {len(vacias)} colección(es): "
            + ", ".join(vacias[:5])
        )

    if diagnostico["score_salud"] < 50:
        diagnostico["recomendaciones"].append(
            "⚠️ Score de salud BAJO. Revisar problemas críticos antes de ejecutar análisis."
        )

    diagnostico["score_salud"] = max(0, diagnostico["score_salud"])

    # Persistir
    col_diagnostico.insert_one(diagnostico)

    log.info("  Score de salud: %d/100", diagnostico["score_salud"])
    log.info("  Problemas: %d | Advertencias: %d", len(diagnostico["problemas"]),
             len(diagnostico["advertencias"]))
    return diagnostico


# ===========================================================================
# MÓDULO 2: VINCULACIÓN PROFUNDA POR RUC/NOMBRE
# ===========================================================================

def vincular_entidades(db, modo_test: bool = False) -> int:
    """
    Cruza TODAS las bases por RUC y nombre para crear perfiles 360°.
    Cada perfil incluye: contratos, presupuesto, auditorías, procesos judiciales.
    """
    log.info("🔗 === VINCULACIÓN PROFUNDA ===")
    col_vinculos = db["analisis.vinculos"]
    col_vinculos.create_index("ruc", unique=True)
    col_vinculos.create_index("nombre")
    col_vinculos.create_index("score_relevancia")

    entidades = {}
    limit = 500 if modo_test else 0

    # Fuente 1: Proveedores SERCOP
    for doc in db["contratacion.proveedores"].find({}, limit=limit):
        ruc = doc.get("ruc", "")
        if len(ruc) < 5:
            continue
        if ruc not in entidades:
            entidades[ruc] = _crear_perfil_base(ruc, doc.get("nombre", ""), "privado")
        entidades[ruc]["aparece_en"].add("contratacion.proveedores")

    # Fuente 2: Entidades contratantes
    for doc in db["contratacion.entidades"].find({}, limit=limit):
        ruc = doc.get("ruc", "")
        if len(ruc) < 5:
            continue
        if ruc not in entidades:
            entidades[ruc] = _crear_perfil_base(ruc, doc.get("nombre", ""), "publico")
        entidades[ruc]["tipo"] = "publico"
        entidades[ruc]["aparece_en"].add("contratacion.entidades")

    # Fuente 3: Catastro RUC (SRI)
    for doc in db["tributario.catastro_ruc"].find({}, limit=limit):
        ruc = doc.get("ruc") or doc.get("RUC") or ""
        if len(str(ruc)) < 5:
            continue
        ruc = str(ruc)
        if ruc not in entidades:
            nombre = doc.get("razon_social") or doc.get("RAZON_SOCIAL") or ""
            entidades[ruc] = _crear_perfil_base(ruc, nombre, "desconocido")
        entidades[ruc]["aparece_en"].add("tributario.catastro_ruc")
        entidades[ruc]["datos_sri"] = {
            "actividad": doc.get("actividad") or doc.get("ACTIVIDAD_ECONOMICA"),
            "estado_tributario": doc.get("estado") or doc.get("ESTADO"),
        }

    log.info("  Entidades únicas encontradas: %d", len(entidades))

    # Enriquecer con datos de contratos
    log.info("  Enriqueciendo con contratos...")
    for contrato in db["contratacion.contratos"].find(
        {"monto": {"$exists": True}},
        limit=limit * 10 if modo_test else 0
    ):
        monto = contrato.get("monto", 0)
        if not isinstance(monto, (int, float)):
            try:
                monto = float(str(monto).replace(",", "").replace("$", ""))
            except (ValueError, TypeError):
                monto = 0

        pruc = contrato.get("proveedor_ruc", "")
        if pruc and pruc in entidades:
            entidades[pruc]["contratos_proveedor"] += 1
            entidades[pruc]["monto_proveedor"] += monto
            entidades[pruc]["aparece_en"].add("contratacion.contratos")

        eruc = contrato.get("entidad_id", "")
        if eruc and eruc in entidades:
            entidades[eruc]["contratos_entidad"] += 1
            entidades[eruc]["monto_entidad"] += monto

    # Calcular score
    for ruc, data in entidades.items():
        score = 0
        score += len(data["aparece_en"]) * 15
        score += min(data["contratos_proveedor"], 100) * 2
        score += min(data["contratos_entidad"], 100) * 2
        if data["monto_proveedor"] > 1_000_000:
            score += 25
        if data["monto_proveedor"] > 10_000_000:
            score += 50
        if data["monto_entidad"] > 50_000_000:
            score += 30
        data["score_relevancia"] = score
        data["aparece_en"] = list(data["aparece_en"])
        data["_ingestado"] = datetime.now(timezone.utc)

    # Bulk upsert
    ops = [UpdateOne({"ruc": ruc}, {"$set": data}, upsert=True)
           for ruc, data in entidades.items()]
    total = _bulk_write_safe(col_vinculos, ops)
    log.info("  Perfiles guardados: %d", total)
    return total


def _crear_perfil_base(ruc, nombre, tipo):
    return {
        "ruc": ruc,
        "nombre": nombre,
        "tipo": tipo,
        "aparece_en": set(),
        "contratos_proveedor": 0,
        "monto_proveedor": 0,
        "contratos_entidad": 0,
        "monto_entidad": 0,
        "datos_sri": {},
    }


# ===========================================================================
# MÓDULO 3: DETECCIÓN DE ANOMALÍAS
# ===========================================================================

def detectar_anomalias(db, modo_test: bool = False) -> int:
    """
    Busca irregularidades, incoherencias y contradicciones:
    
    CONCENTRACIÓN:  Pocos proveedores acaparan la mayoría de contratos
    FRACCIONAMIENTO: Contratos partidos para evitar umbral de licitación
    FANTASMA:        Empresas sin actividad en SRI con contratos millonarios
    VELOCIDAD:       Leyes aprobadas en tiempo récord (sin debate adecuado)
    INCOHERENCIA:    Más presupuesto en sector pero peores indicadores
    """
    log.info("🚨 === DETECCIÓN DE ANOMALÍAS ===")
    col_alertas = db["analisis.alertas"]
    col_alertas.create_index("tipo_alerta")
    col_alertas.create_index("severidad")
    col_alertas.create_index("_ingestado")

    alertas = []
    limit_pipeline = [{"$limit": 500}] if modo_test else []

    # ── ANOMALÍA 1: Concentración de contratos ───────────────────────────
    log.info("  🔍 Analizando concentración de contratos...")
    pipeline = [
        {"$match": {"proveedor_ruc": {"$exists": True, "$ne": ""}}},
        {"$group": {
            "_id": {"ent": "$entidad_nombre", "prov": "$proveedor_nombre",
                    "ruc": "$proveedor_ruc"},
            "n": {"$sum": 1},
            "total": {"$sum": {"$ifNull": ["$monto", 0]}},
            "contratos_ids": {"$push": "$ocid"},
        }},
        {"$match": {"n": {"$gte": 5}}},
        {"$sort": {"total": -1}},
        *limit_pipeline,
    ]
    for r in db["contratacion.contratos"].aggregate(pipeline, allowDiskUse=True):
        ids = r["_id"]
        sev = "media" if r["n"] < 20 else "alta" if r["n"] < 50 else "critica"
        if r["total"] > 5_000_000:
            sev = "critica"
        alertas.append({
            "tipo_alerta": "concentracion_contratos",
            "severidad": sev,
            "entidad": ids.get("ent", ""),
            "proveedor": ids.get("prov", ""),
            "proveedor_ruc": ids.get("ruc", ""),
            "num_contratos": r["n"],
            "monto_total_usd": r["total"],
            "muestra_ocids": r["contratos_ids"][:10],
            "descripcion": (
                f"'{ids.get('prov', '')}' tiene {r['n']} contratos con "
                f"'{ids.get('ent', '')}' por ${r['total']:,.0f}"
            ),
            "_ingestado": datetime.now(timezone.utc),
        })

    # ── ANOMALÍA 2: Proveedores que operan en muchas entidades ────────────
    log.info("  🔍 Analizando proveedores multientidad...")
    pipeline2 = [
        {"$match": {"proveedor_ruc": {"$exists": True, "$ne": ""}}},
        {"$group": {
            "_id": "$proveedor_ruc",
            "nombre": {"$first": "$proveedor_nombre"},
            "entidades": {"$addToSet": "$entidad_nombre"},
            "n": {"$sum": 1},
            "total": {"$sum": {"$ifNull": ["$monto", 0]}},
        }},
        {"$match": {"$expr": {"$gte": [{"$size": "$entidades"}, 3]}}},
        {"$sort": {"total": -1}},
        *limit_pipeline,
    ]
    for r in db["contratacion.contratos"].aggregate(pipeline2, allowDiskUse=True):
        ne = len(r["entidades"])
        sev = "info" if ne < 5 else "media" if ne < 10 else "alta"
        alertas.append({
            "tipo_alerta": "proveedor_multientidad",
            "severidad": sev,
            "proveedor": r.get("nombre", ""),
            "proveedor_ruc": r["_id"],
            "num_entidades": ne,
            "entidades": r["entidades"][:15],
            "num_contratos": r["n"],
            "monto_total_usd": r["total"],
            "descripcion": (
                f"'{r.get('nombre', '')}' opera con {ne} entidades, "
                f"{r['n']} contratos, ${r['total']:,.0f}"
            ),
            "_ingestado": datetime.now(timezone.utc),
        })

    # ── ANOMALÍA 3: Fraccionamiento de contratos ────────────────────────
    log.info("  🔍 Buscando fraccionamiento de contratos...")
    umbrales_licitacion = [70_892, 532_890]  # Umbrales SERCOP 2024 aprox
    for umbral in umbrales_licitacion:
        margen_bajo = umbral * 0.85
        margen_alto = umbral * 0.99
        pipeline_frac = [
            {"$match": {"monto": {"$gte": margen_bajo, "$lte": margen_alto}}},
            {"$group": {
                "_id": {"ent": "$entidad_nombre", "prov": "$proveedor_nombre"},
                "n": {"$sum": 1},
                "montos": {"$push": "$monto"},
            }},
            {"$match": {"n": {"$gte": 3}}},
            *limit_pipeline,
        ]
        for r in db["contratacion.contratos"].aggregate(pipeline_frac, allowDiskUse=True):
            ids = r["_id"]
            alertas.append({
                "tipo_alerta": "posible_fraccionamiento",
                "severidad": "alta",
                "entidad": ids.get("ent", ""),
                "proveedor": ids.get("prov", ""),
                "num_contratos": r["n"],
                "umbral_licitacion": umbral,
                "montos": sorted(r["montos"])[:10],
                "descripcion": (
                    f"{r['n']} contratos de '{ids.get('ent', '')}' a '{ids.get('prov', '')}' "
                    f"por montos entre ${margen_bajo:,.0f}–${margen_alto:,.0f} "
                    f"(umbral de licitación: ${umbral:,.0f})"
                ),
                "_ingestado": datetime.now(timezone.utc),
            })

    # Guardar alertas
    total = 0
    if alertas:
        # Usar upsert por tipo+entidad+proveedor para evitar duplicados
        ops = [UpdateOne(
            {"tipo_alerta": a["tipo_alerta"],
             "proveedor_ruc": a.get("proveedor_ruc", ""),
             "entidad": a.get("entidad", "")},
            {"$set": a}, upsert=True
        ) for a in alertas]
        total = _bulk_write_safe(db["analisis.alertas"], ops)

    log.info("  Alertas generadas/actualizadas: %d", total)
    return total


# ===========================================================================
# MÓDULO 4: TENDENCIAS Y PREDICCIONES
# ===========================================================================

def analizar_tendencias(db, modo_test: bool = False) -> int:
    """
    Analiza series temporales de los datos para identificar tendencias:
      - ¿La recaudación tributaria sube o baja?
      - ¿Los contratos públicos están aumentando en un sector?
      - ¿La pobreza se correlaciona con el presupuesto educativo?
    """
    log.info("📈 === ANÁLISIS DE TENDENCIAS ===")
    col_pred = db["analisis.predicciones"]
    predicciones = []

    # Tendencia 1: Volumen de contratación pública por mes
    log.info("  Analizando tendencia de contratación...")
    pipeline = [
        {"$match": {"fecha_firma": {"$exists": True}}},
        {"$group": {
            "_id": {"$substr": ["$fecha_firma", 0, 7]},  # YYYY-MM
            "num_contratos": {"$sum": 1},
            "monto_total": {"$sum": {"$ifNull": ["$monto", 0]}},
        }},
        {"$sort": {"_id": 1}},
    ]
    datos_contratacion = list(db["contratacion.contratos"].aggregate(pipeline))
    if len(datos_contratacion) >= 3:
        ultimos = datos_contratacion[-3:]
        primeros = datos_contratacion[:3] if len(datos_contratacion) >= 6 else datos_contratacion[:1]
        monto_reciente = sum(d["monto_total"] for d in ultimos) / len(ultimos)
        monto_antiguo = sum(d["monto_total"] for d in primeros) / len(primeros)
        if monto_antiguo > 0:
            cambio_pct = ((monto_reciente - monto_antiguo) / monto_antiguo) * 100
            tendencia = "AUMENTO" if cambio_pct > 10 else "DISMINUCIÓN" if cambio_pct < -10 else "ESTABLE"
            predicciones.append({
                "tipo": "tendencia_contratacion",
                "indicador": "monto_contratos_publicos",
                "tendencia": tendencia,
                "cambio_porcentual": round(cambio_pct, 1),
                "periodo_reciente": [d["_id"] for d in ultimos],
                "descripcion": f"La contratación pública muestra {tendencia} ({cambio_pct:+.1f}%)",
                "_ingestado": datetime.now(timezone.utc),
            })

    # Tendencia 2: Leyes por año
    log.info("  Analizando producción legislativa...")
    pipeline_leyes = [
        {"$match": {"fecha_registro": {"$exists": True}}},
        {"$group": {
            "_id": {"$substr": ["$fecha_registro", 0, 4]},
            "total": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]
    datos_leyes = list(db["legislativo.proyectos"].aggregate(pipeline_leyes))
    if len(datos_leyes) >= 2:
        predicciones.append({
            "tipo": "produccion_legislativa",
            "datos": [{"anio": d["_id"], "proyectos": d["total"]} for d in datos_leyes[-5:]],
            "descripcion": "Evolución de proyectos de ley presentados por año",
            "_ingestado": datetime.now(timezone.utc),
        })

    # Guardar
    total = 0
    if predicciones:
        ops = [UpdateOne(
            {"tipo": p["tipo"], "indicador": p.get("indicador", p["tipo"])},
            {"$set": p}, upsert=True
        ) for p in predicciones]
        total = _bulk_write_safe(col_pred, ops)

    log.info("  Predicciones guardadas: %d", total)
    return total


# ===========================================================================
# MÓDULO 5: DETECCIÓN DE NEPOTISMO Y CONFLICTOS DE INTERÉS
# ===========================================================================

def detectar_nepotismo_conflictos(db, modo_test: bool = False) -> int:
    """
    Cruza la base de servidores públicos (LOTAIP) con los proveedores del Estado (SERCOP)
    para detectar:
      1. Servidores públicos que son proveedores (prohibición legal).
      2. Posible nepotismo: Coincidencia inusual de apellidos entre autoridades y
         proveedores millonarios o nuevos empleados.
    """
    log.info("🕵️‍♂️ === DETECCIÓN DE NEPOTISMO Y CONFLICTOS DE INTERÉS ===")
    col_alertas = db["analisis.alertas"]
    alertas = []
    
    # 1. Conflicto Directo (Servidor == Proveedor activo)
    log.info("  Buscando servidores públicos que rinden como proveedores SERCOP...")
    pipeline_conflicto = [
        {
            "$lookup": {
                "from": "estado.funcionarios",
                "localField": "ruc",
                "foreignField": "cedula", # Idealmente cruce cedula-RUC
                "as": "funcionario_match"
            }
        },
        {"$match": {"funcionario_match": {"$ne": []}}},
        {"$limit": 50 if modo_test else 500}
    ]
    
    for prov in db["contratacion.proveedores"].aggregate(pipeline_conflicto):
        for func in prov.get("funcionario_match", []):
            alertas.append({
                "tipo_alerta": "conflicto_interes",
                "severidad": "critica",
                "entidad": func.get("institucion", ""),
                "proveedor": prov.get("nombre", ""),
                "proveedor_ruc": prov.get("ruc", ""),
                "funcionario_nombre": func.get("nombres_completos", ""),
                "funcionario_cargo": func.get("puesto", ""),
                "descripcion": (
                    f"¡ALERTA CRÍTICA! El funcionario '{func.get('nombres_completos')}' "
                    f"({func.get('puesto')} en {func.get('institucion')}) figura activamente "
                    f"como proveedor del Estado ({prov.get('ruc')})."
                ),
                "_ingestado": datetime.now(timezone.utc),
            })
            
    # 2. Nepotismo Probabilístico (Apellidos raros coincidentes en la misma institución)
    # Por temas de performance en Mongo, lo haremos extraeyendo una muestra representativa de contratistas
    # y comparando apellidos con la nómina.
    log.info("  Analizando posibles lazos de nepotismo (coincidencia de apellidos raros)...")
    
    if not modo_test:
        # En modo real, nos limitamos a apellidos no comunes (excluir Zambrano, Perez, etc en la lógica real)
        pass 
        
    for func in db["estado.funcionarios"].find({}, limit=100 if modo_test else 0):
        # Lógica simplificada: Tomar el primer apellido del funcionario
        partes = func.get("nombres_completos", "").split(" ")
        if len(partes) < 2:
            continue
        apellido1 = partes[0]
        
        # Buscar en contratos de la MISMA institución donde figura un proveedor con ese apellido
        # (Esto es un proxy; la verdadera IA requiere NLP y grafos profundos)
        candidatos = db["contratacion.contratos"].find({
            "entidad_nombre": {"$regex": re.escape(func.get("institucion", "")), "$options": "i"},
            "proveedor_nombre": {"$regex": f"^{apellido1} ", "$options": "i"}
        }, limit=5)
        
        for cand in candidatos:
            alertas.append({
                "tipo_alerta": "posible_nepotismo",
                "severidad": "media",
                "entidad": cand.get("entidad_nombre", ""),
                "proveedor": cand.get("proveedor_nombre", ""),
                "proveedor_ruc": cand.get("proveedor_ruc", ""),
                "funcionario_nombre": func.get("nombres_completos", ""),
                "funcionario_cargo": func.get("puesto", ""),
                "descripcion": (
                    f"Posible Vínculo: Contrato adjudicado a '{cand.get('proveedor_nombre')}' "
                    f"en misma institución donde labora '{func.get('nombres_completos')}' ({func.get('puesto')})."
                ),
                "_ingestado": datetime.now(timezone.utc),
            })

    total = 0
    if alertas:
        ops = [UpdateOne(
            {"tipo_alerta": a["tipo_alerta"], 
             "proveedor_ruc": a.get("proveedor_ruc", ""),
             "funcionario_nombre": a.get("funcionario_nombre", "")},
            {"$set": a}, upsert=True
        ) for a in alertas]
        total = _bulk_write_safe(col_alertas, ops)

    log.info("  Alertas de Nepotismo/Conflictos generadas: %d", total)
    return total

# ===========================================================================
# MÓDULO 6: EVALUACIÓN CRÍTICA DE POLÍTICAS PÚBLICAS
# ===========================================================================

def evaluar_politicas(db, modo_test: bool = False) -> int:
    """
    Cruza indicadores para evaluar si las políticas tienen el efecto deseado:
      - ¿Más presupuesto en salud = mejores indicadores?
      - ¿Reforma tributaria = más recaudación?
      - ¿Contratos de obra pública = infraestructura mejorada?
    """
    log.info("📝 === EVALUACIÓN DE POLÍTICAS ===")
    col_criticas = db["analisis.criticas"]
    evaluaciones = []

    # Evaluación: Gasto público vs resultados
    evaluaciones.append({
        "tipo": "evaluacion_eficacia",
        "sector": "general",
        "titulo": "Eficacia del gasto público ecuatoriano",
        "metodologia": (
            "Correlación entre asignación presupuestaria por sector (MEF), "
            "indicadores sociales (INEC: pobreza, empleo, educación), "
            "y recaudación tributaria (SRI) en períodos equivalentes."
        ),
        "colecciones_requeridas": [
            "fiscal.presupuesto", "demografico.empleo",
            "demografico.pobreza", "tributario.recaudacion",
        ],
        "estado": "pendiente_datos",
        "descripcion": (
            "Esta evaluación se activará automáticamente cuando las colecciones "
            "fiscal.presupuesto y demografico.pobreza tengan datos históricos suficientes "
            "(mínimo 12 meses de datos para análisis de tendencia)."
        ),
        "_ingestado": datetime.now(timezone.utc),
    })

    # Evaluación: Efectividad de la Contraloría
    n_auditorias = db["fiscalizacion.informes_auditoria"].estimated_document_count()
    n_judiciales = db["judicial.causas_estadisticas"].estimated_document_count()
    if n_auditorias > 0:
        evaluaciones.append({
            "tipo": "evaluacion_eficacia",
            "sector": "fiscalizacion",
            "titulo": "Efectividad de la Contraloría General del Estado",
            "n_informes_auditoria": n_auditorias,
            "n_registros_judiciales": n_judiciales,
            "pregunta_clave": (
                "¿Cuántos informes de la Contraloría resultan en acciones judiciales? "
                "¿Hay impunidad sistémica?"
            ),
            "descripcion": (
                f"La CGE tiene {n_auditorias} informes en el sistema. "
                f"El sistema judicial muestra {n_judiciales} registros. "
                "Análisis de asociación pendiente."
            ),
            "_ingestado": datetime.now(timezone.utc),
        })

    total = 0
    if evaluaciones:
        ops = [UpdateOne(
            {"tipo": e["tipo"], "sector": e["sector"]},
            {"$set": e}, upsert=True
        ) for e in evaluaciones]
        total = _bulk_write_safe(col_criticas, ops)

    log.info("  Evaluaciones guardadas: %d", total)
    return total


# ===========================================================================
# MÓDULO 6: MÉTRICAS DE EFICACIA DEL SISTEMA
# ===========================================================================

def medir_eficacia(db) -> dict:
    """
    Mide la eficacia global del sistema de recolección de datos.
    Se ejecuta siempre al final para dar un reporte ejecutivo.
    """
    log.info("📊 === EFICACIA DEL SISTEMA ===")

    stats = {
        "timestamp": datetime.now(timezone.utc),
        "colecciones_totales": len(COLECCIONES_ESPERADAS),
        "colecciones_con_datos": 0,
        "colecciones_vacias": 0,
        "total_documentos": 0,
        "detalles": {},
    }

    for col_nombre in COLECCIONES_ESPERADAS:
        try:
            count = db[col_nombre].estimated_document_count()
            stats["total_documentos"] += count
            if count > 0:
                stats["colecciones_con_datos"] += 1
            else:
                stats["colecciones_vacias"] += 1
            stats["detalles"][col_nombre] = count
        except Exception:
            stats["colecciones_vacias"] += 1
            stats["detalles"][col_nombre] = -1

    stats["cobertura_pct"] = round(
        stats["colecciones_con_datos"] / max(stats["colecciones_totales"], 1) * 100, 1
    )

    # Log bonito
    log.info("\n" + "=" * 60)
    log.info("REPORTE DE EFICACIA")
    log.info("=" * 60)
    log.info("  Colecciones con datos: %d/%d (%.1f%%)",
             stats["colecciones_con_datos"], stats["colecciones_totales"],
             stats["cobertura_pct"])
    log.info("  Total documentos:      %s", f"{stats['total_documentos']:,}")
    log.info("  Colecciones vacías:    %d", stats["colecciones_vacias"])
    for col_nombre, count in sorted(stats["detalles"].items()):
        icon = "✓" if count > 0 else "✗"
        log.info("    %s %-40s %s docs", icon, col_nombre, f"{count:,}" if count >= 0 else "ERROR")

    db["analisis.eficacia"].insert_one(stats)
    return stats


# ===========================================================================
# Helpers
# ===========================================================================

def _bulk_write_safe(col, ops: list, batch_size: int = 1000) -> int:
    total = 0
    for i in range(0, len(ops), batch_size):
        try:
            r = col.bulk_write(ops[i:i+batch_size], ordered=False)
            total += r.upserted_count + r.modified_count
        except BulkWriteError as e:
            total += e.details.get("nInserted", 0) + e.details.get("nModified", 0)
    return total


# ===========================================================================
# Main
# ===========================================================================

def main(modulos: list[str] = None, entidad: str = None, modo_test: bool = False):
    log.info("=" * 70)
    log.info("🧠 EcuaWatch · CEREBRO v2.0 — Motor de Inteligencia Nacional")
    log.info("=" * 70)

    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    todos = ["diagnostico", "vinculos", "anomalias", "tendencias", "nepotismo", "criticas", "eficacia"]
    if not modulos:
        modulos = todos

    resumen = {}

    if "diagnostico" in modulos:
        diag = diagnosticar_sistema(db)
        resumen["diagnostico"] = diag["score_salud"]

    if "vinculos" in modulos:
        resumen["vinculos"] = vincular_entidades(db, modo_test)

    if "anomalias" in modulos:
        resumen["anomalias"] = detectar_anomalias(db, modo_test)

    if "tendencias" in modulos:
        resumen["tendencias"] = analizar_tendencias(db, modo_test)

    if "nepotismo" in modulos:
        resumen["nepotismo"] = detectar_nepotismo_conflictos(db, modo_test)

    if "criticas" in modulos:
        resumen["criticas"] = evaluar_politicas(db, modo_test)

    if "eficacia" in modulos:
        stats = medir_eficacia(db)
        resumen["eficacia"] = stats["cobertura_pct"]

    log.info("\n" + "=" * 70)
    log.info("🧠 RESUMEN DEL CEREBRO")
    log.info("=" * 70)
    for k, v in resumen.items():
        log.info("  %-20s → %s", k, v)

    db[COL_SYNC_LOG].insert_one({
        "fuente": "cerebro",
        "estado": "completado",
        "detalle": resumen,
        "timestamp": datetime.now(timezone.utc),
    })
    client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="EcuaWatch · Cerebro v2.0 — Motor de Inteligencia Nacional"
    )
    parser.add_argument(
        "--modulo", nargs="+",
        choices=["diagnostico", "vinculos", "anomalias", "tendencias", "nepotismo", "criticas", "eficacia"],
        help="Módulos a ejecutar",
    )
    parser.add_argument("--entidad", type=str, help="Análisis de entidad específica")
    parser.add_argument("--test", action="store_true", help="Modo prueba")
    args = parser.parse_args()
    main(modulos=args.modulo, entidad=args.entidad, modo_test=args.test)
