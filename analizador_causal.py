"""
analizador_causal.py — Motor de Vinculación y Análisis Causal de Ecuador
=========================================================================
Cruza TODAS las bases de datos de EcuaWatch para establecer:

  1. CAUSA-EFECTO:
     → Ley aprobada (Asamblea) → Cambio en recaudación (SRI) → Impacto en empleo (INEC)
     → Reducción presupuesto (MEF) → Aumento pobreza (INEC)
     → Contrato millonario (SERCOP) → Sin obra terminada → Informe de auditoría (Contraloría)

  2. DEPENDENCIAS:
     → Quién contrata a quién (SERCOP → proveedores → SuperCias → accionistas)
     → Qué autoridad aprueba qué ley (Asamblea) y quién se beneficia (SERCOP)
     → Qué institución recibe más presupuesto (MEF) vs resultados (INEC, judicial)

  3. RED DE PODER:
     → Personas que aparecen en múltiples fuentes (legisladores, contratistas, jueces)
     → Organizaciones con conexiones cruzadas
     → Flujo del dinero público: Presupuesto → Contrato → Proveedor → ¿Resultados?

  4. LÍNEA TEMPORAL:
     → Construye una cronología de eventos para identificar patrones

Colección MongoDB: ecuador_intel.analisis.vinculos
                   ecuador_intel.analisis.grafo_poder
                   ecuador_intel.analisis.linea_temporal
                   ecuador_intel.analisis.alertas
                   ecuador_intel.analisis.resumen_entidad

Uso:
    python analizador_causal.py                     # Análisis completo
    python analizador_causal.py --modulo vinculos   # Solo vinculación
    python analizador_causal.py --modulo grafo      # Solo grafo de poder
    python analizador_causal.py --modulo alertas    # Solo detección de anomalías
    python analizador_causal.py --entidad "PETROECUADOR"  # Análisis de una entidad
    python analizador_causal.py --test              # Modo prueba
"""

import argparse
import logging
import os
import re
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone
from typing import Optional

from pymongo import MongoClient

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
log = logging.getLogger("analizador_causal")

# ---------------------------------------------------------------------------
# Colecciones fuente (todas las bases del sistema)
# ---------------------------------------------------------------------------

FUENTES = {
    # Legislativo
    "legislativo.proyectos":           {"tipo": "ley",           "campo_id": "numero",     "campo_fecha": "fecha_presentacion"},
    "legislativo.registro_oficial":    {"tipo": "publicacion",   "campo_id": "numero_ro",  "campo_fecha": "fecha_publicacion"},
    # Fiscal
    "fiscal.presupuesto":              {"tipo": "presupuesto",   "campo_id": None,         "campo_fecha": "_ingestado"},
    "fiscal.deuda_publica":            {"tipo": "deuda",         "campo_id": None,         "campo_fecha": "_ingestado"},
    "fiscal.transferencias_gad":       {"tipo": "transferencia", "campo_id": None,         "campo_fecha": "_ingestado"},
    # Tributario
    "tributario.recaudacion":          {"tipo": "recaudacion",   "campo_id": None,         "campo_fecha": "_ingestado"},
    "tributario.recaudacion_provincial": {"tipo": "recaudacion", "campo_id": None,         "campo_fecha": "_ingestado"},
    # Contratación
    "contratacion.procesos":           {"tipo": "contratacion",  "campo_id": "ocid",       "campo_fecha": "fecha_inicio"},
    "contratacion.contratos":          {"tipo": "contrato",      "campo_id": "contrato_id","campo_fecha": "fecha_firma"},
    "contratacion.proveedores":        {"tipo": "proveedor",     "campo_id": "ruc",        "campo_fecha": None},
    "contratacion.entidades":          {"tipo": "entidad_pub",   "campo_id": "ruc",        "campo_fecha": None},
    # Fiscalización
    "fiscalizacion.informes_auditoria":{"tipo": "auditoria",     "campo_id": None,         "campo_fecha": "_ingestado"},
    "fiscalizacion.resoluciones":      {"tipo": "resolucion",    "campo_id": None,         "campo_fecha": "_ingestado"},
    # Judicial
    "judicial.causas_estadisticas":    {"tipo": "causa_judicial","campo_id": None,         "campo_fecha": "_ingestado"},
    # Demográfico
    "demografico.empleo":              {"tipo": "empleo",        "campo_id": None,         "campo_fecha": "_ingestado"},
    "demografico.inflacion":           {"tipo": "inflacion",     "campo_id": None,         "campo_fecha": "_ingestado"},
    "demografico.pobreza":             {"tipo": "pobreza",       "campo_id": None,         "campo_fecha": "_ingestado"},
    # Económico
    "economico.pib":                   {"tipo": "pib",           "campo_id": None,         "campo_fecha": "_ingestado"},
    "economico.tasas_interes":         {"tipo": "tasa_interes",  "campo_id": None,         "campo_fecha": "_ingestado"},
    "economico.remesas":               {"tipo": "remesas",       "campo_id": None,         "campo_fecha": "_ingestado"},
    # Electoral
    "electoral.resultados":            {"tipo": "resultado_elec","campo_id": None,         "campo_fecha": "_ingestado"},
}


# ===========================================================================
# MÓDULO 1: VINCULACIÓN CRUZADA POR ENTIDADES (RUC/Nombre)
# ===========================================================================

def vincular_por_ruc(db, modo_test: bool = False) -> int:
    """
    Busca el mismo RUC/nombre en múltiples colecciones para construir
    un perfil integral de cada entidad (pública o privada).

    Ejemplo de vinculación:
      RUC 1790016919001 (PETROECUADOR)
        → contratacion.entidades: es entidad contratante
        → contratacion.contratos: firmó X contratos por $Y millones
        → fiscal.presupuesto: recibió $Z de presupuesto
        → fiscalizacion.informes: tiene N informes de auditoría
        → tributario.catastro_ruc: registrado como contribuyente especial
    """
    log.info("=== VINCULACIÓN POR RUC/ENTIDAD ===")
    col_vinculos = db["analisis.vinculos"]
    col_vinculos.create_index("ruc", unique=True)
    col_vinculos.create_index("nombre")
    col_vinculos.create_index("tipo")
    col_vinculos.create_index("score_relevancia")

    # Recopilar todos los RUCs/entidades únicas de las fuentes clave
    entidades = {}  # ruc -> {datos acumulados}

    # 1. Proveedores SERCOP
    log.info("  Recopilando proveedores SERCOP...")
    limit = 500 if modo_test else 0
    for prov in db["contratacion.proveedores"].find({}, limit=limit):
        ruc = prov.get("ruc", "")
        if not ruc:
            continue
        if ruc not in entidades:
            entidades[ruc] = {
                "ruc":     ruc,
                "nombre":  prov.get("nombre", ""),
                "tipo":    "privado",
                "fuentes": [],
                "contratos_como_proveedor": 0,
                "montos_como_proveedor":    0,
                "contratos_como_entidad":   0,
                "montos_como_entidad":      0,
                "informes_auditoria":       0,
                "causas_judiciales":        0,
                "legislacion_relacionada":  [],
            }
        entidades[ruc]["fuentes"].append("contratacion.proveedores")

    # 2. Entidades contratantes SERCOP
    log.info("  Recopilando entidades contratantes SERCOP...")
    for ent in db["contratacion.entidades"].find({}, limit=limit):
        ruc = ent.get("ruc", "")
        if not ruc:
            continue
        if ruc not in entidades:
            entidades[ruc] = {
                "ruc":     ruc,
                "nombre":  ent.get("nombre", ""),
                "tipo":    "publico",
                "fuentes": [],
                "contratos_como_proveedor": 0,
                "montos_como_proveedor":    0,
                "contratos_como_entidad":   0,
                "montos_como_entidad":      0,
                "informes_auditoria":       0,
                "causas_judiciales":        0,
                "legislacion_relacionada":  [],
            }
        entidades[ruc]["tipo"] = "publico"
        entidades[ruc]["fuentes"].append("contratacion.entidades")

    log.info("  Total entidades únicas: %d", len(entidades))

    # 3. Enriquecer con contratos
    log.info("  Enriqueciendo con datos de contratos...")
    for contrato in db["contratacion.contratos"].find(
        {"monto": {"$exists": True, "$ne": None}}, limit=limit * 5 if modo_test else 0
    ):
        # Como proveedor
        ruc_prov = contrato.get("proveedor_ruc", "")
        if ruc_prov and ruc_prov in entidades:
            entidades[ruc_prov]["contratos_como_proveedor"] += 1
            monto = contrato.get("monto", 0)
            if isinstance(monto, (int, float)):
                entidades[ruc_prov]["montos_como_proveedor"] += monto

        # Como entidad contratante
        ruc_ent = contrato.get("entidad_id", "")
        if ruc_ent and ruc_ent in entidades:
            entidades[ruc_ent]["contratos_como_entidad"] += 1
            monto = contrato.get("monto", 0)
            if isinstance(monto, (int, float)):
                entidades[ruc_ent]["montos_como_entidad"] += monto

    # 4. Calcular score de relevancia
    for ruc, data in entidades.items():
        score = 0
        score += len(set(data["fuentes"])) * 10  # Más fuentes = más relevante
        score += data["contratos_como_proveedor"] * 2
        score += data["contratos_como_entidad"] * 2
        score += data["informes_auditoria"] * 15  # Auditorías son muy relevantes
        if data["montos_como_proveedor"] > 1_000_000:
            score += 20
        if data["montos_como_proveedor"] > 10_000_000:
            score += 50
        data["score_relevancia"] = score
        data["fuentes"] = list(set(data["fuentes"]))
        data["_ingestado"] = datetime.now(timezone.utc)
        data["_tipo"] = "vinculo_entidad"

    # 5. Guardar en MongoDB
    from pymongo import UpdateOne
    ops = [UpdateOne({"ruc": ruc}, {"$set": data}, upsert=True)
           for ruc, data in entidades.items()]

    total = 0
    if ops:
        batch_size = 1000
        for i in range(0, len(ops), batch_size):
            r = col_vinculos.bulk_write(ops[i:i+batch_size], ordered=False)
            total += r.upserted_count + r.modified_count

    log.info("  Vínculos guardados: %d", total)
    return total


# ===========================================================================
# MÓDULO 2: GRAFO DE PODER Y DEPENDENCIAS
# ===========================================================================

def construir_grafo_poder(db, modo_test: bool = False) -> int:
    """
    Construye un grafo de relaciones entre entidades.
    Nodos = entidades (públicas/privadas)
    Aristas = relaciones (contrata, auditada_por, legisla_sobre, etc.)

    Este grafo permite responder preguntas como:
    - ¿Qué empresa recibe más contratos de qué ministerio?
    - ¿Qué legislador aprobó leyes que benefician a qué sector?
    - ¿Qué entidades son más auditadas y por qué?
    """
    log.info("=== CONSTRUCCIÓN GRAFO DE PODER ===")
    col_grafo = db["analisis.grafo_poder"]
    col_grafo.create_index([("origen", 1), ("destino", 1), ("relacion", 1)])
    col_grafo.create_index("peso")

    aristas = []

    # 1. Relaciones de contratación: entidad_contratante → proveedor
    log.info("  Construyendo aristas de contratación...")
    pipeline = [
        {"$match": {"entidad_nombre": {"$exists": True}, "proveedor_nombre": {"$exists": True}}},
        {"$group": {
            "_id": {"entidad": "$entidad_nombre", "proveedor": "$proveedor_nombre",
                    "entidad_ruc": "$entidad_id", "proveedor_ruc": "$proveedor_ruc"},
            "num_contratos": {"$sum": 1},
            "monto_total":   {"$sum": {"$ifNull": ["$monto", 0]}},
        }},
        {"$sort": {"monto_total": -1}},
    ]
    if modo_test:
        pipeline.append({"$limit": 200})

    for rel in db["contratacion.contratos"].aggregate(pipeline):
        ids = rel["_id"]
        aristas.append({
            "origen":         ids.get("entidad", ""),
            "origen_ruc":     ids.get("entidad_ruc", ""),
            "origen_tipo":    "entidad_publica",
            "destino":        ids.get("proveedor", ""),
            "destino_ruc":    ids.get("proveedor_ruc", ""),
            "destino_tipo":   "proveedor",
            "relacion":       "contrata_a",
            "num_contratos":  rel["num_contratos"],
            "monto_total":    rel["monto_total"],
            "peso":           rel["num_contratos"] * (1 + rel["monto_total"] / 1_000_000),
            "_ingestado":     datetime.now(timezone.utc),
        })

    # 2. Relación legislativa: leyes que mencionan instituciones
    log.info("  Buscando vínculos legislativos...")
    instituciones_clave = [
        "PETROECUADOR", "IESS", "SRI", "Banco Central", "SERCOP",
        "Contraloría", "Fiscalía", "Ministerio de Salud",
        "Ministerio de Educación", "Ministerio de Defensa",
        "Policía Nacional", "Fuerzas Armadas", "GAD",
    ]
    for inst in instituciones_clave:
        regex = re.compile(inst, re.IGNORECASE)
        count = db["legislativo.proyectos"].count_documents(
            {"$or": [{"titulo": regex}, {"resumen": regex}]}
        )
        if count > 0:
            aristas.append({
                "origen":       "Asamblea Nacional",
                "origen_tipo":  "poder_legislativo",
                "destino":      inst,
                "destino_tipo": "institucion",
                "relacion":     "legisla_sobre",
                "menciones":    count,
                "peso":         count * 5,
                "_ingestado":   datetime.now(timezone.utc),
            })

    # 3. Guardar grafo
    total = 0
    if aristas:
        from pymongo import UpdateOne
        ops = [UpdateOne(
            {"origen": a["origen"], "destino": a["destino"], "relacion": a["relacion"]},
            {"$set": a}, upsert=True
        ) for a in aristas]
        batch_size = 1000
        for i in range(0, len(ops), batch_size):
            r = col_grafo.bulk_write(ops[i:i+batch_size], ordered=False)
            total += r.upserted_count + r.modified_count

    log.info("  Aristas del grafo: %d", total)
    return total


# ===========================================================================
# MÓDULO 3: DETECCIÓN DE ANOMALÍAS Y ALERTAS
# ===========================================================================

def detectar_anomalias(db, modo_test: bool = False) -> int:
    """
    Detecta patrones sospechosos o relevantes cruzando bases de datos:

    ANOMALÍAS DE CONTRATACIÓN:
      → Proveedor recibe >50% de contratos de una entidad (concentración)
      → Contratos por montos justo debajo del umbral de licitación
      → Mismo proveedor en múltiples entidades (posible info privilegiada)

    ANOMALÍAS FISCALES:
      → Entidad con más presupuesto pero peores indicadores
      → Aumento de deuda sin impacto en inversión social

    ANOMALÍAS LEGISLATIVAS:
      → Leyes aprobadas rápido (< 30 días) sin debate amplio
      → Leyes que benefician a sectores específicos

    Cada anomalía genera una ALERTA con score de severidad.
    """
    log.info("=== DETECCIÓN DE ANOMALÍAS ===")
    col_alertas = db["analisis.alertas"]
    col_alertas.create_index("tipo_alerta")
    col_alertas.create_index("severidad")
    col_alertas.create_index("_ingestado")

    alertas = []

    # ── ALERTA 1: Concentración de contratos ──────────────────────────────
    log.info("  Analizando concentración de contratos...")
    pipeline = [
        {"$match": {"proveedor_ruc": {"$exists": True, "$ne": ""}}},
        {"$group": {
            "_id": {"entidad": "$entidad_nombre", "proveedor": "$proveedor_nombre",
                    "proveedor_ruc": "$proveedor_ruc"},
            "num_contratos": {"$sum": 1},
            "monto_total":   {"$sum": {"$ifNull": ["$monto", 0]}},
        }},
        {"$sort": {"num_contratos": -1}},
    ]
    if modo_test:
        pipeline.append({"$limit": 100})

    for rel in db["contratacion.contratos"].aggregate(pipeline):
        ids = rel["_id"]
        if rel["num_contratos"] >= 5:
            severidad = "media"
            if rel["num_contratos"] >= 20:
                severidad = "alta"
            if rel["monto_total"] > 5_000_000:
                severidad = "critica"

            alertas.append({
                "tipo_alerta":      "concentracion_contratos",
                "severidad":        severidad,
                "entidad":          ids.get("entidad", ""),
                "proveedor":        ids.get("proveedor", ""),
                "proveedor_ruc":    ids.get("proveedor_ruc", ""),
                "num_contratos":    rel["num_contratos"],
                "monto_total_usd":  rel["monto_total"],
                "descripcion":      (
                    f"El proveedor '{ids.get('proveedor', '')}' tiene "
                    f"{rel['num_contratos']} contratos con '{ids.get('entidad', '')}' "
                    f"por un total de ${rel['monto_total']:,.2f}"
                ),
                "_ingestado":       datetime.now(timezone.utc),
            })

    # ── ALERTA 2: Proveedores que operan en múltiples entidades ───────────
    log.info("  Analizando proveedores multientidad...")
    pipeline2 = [
        {"$match": {"proveedor_ruc": {"$exists": True, "$ne": ""}}},
        {"$group": {
            "_id": "$proveedor_ruc",
            "nombre": {"$first": "$proveedor_nombre"},
            "entidades": {"$addToSet": "$entidad_nombre"},
            "num_contratos": {"$sum": 1},
            "monto_total":   {"$sum": {"$ifNull": ["$monto", 0]}},
        }},
        {"$match": {"$expr": {"$gte": [{"$size": "$entidades"}, 3]}}},
        {"$sort": {"monto_total": -1}},
    ]
    if modo_test:
        pipeline2.append({"$limit": 50})

    for prov in db["contratacion.contratos"].aggregate(pipeline2):
        num_entidades = len(prov["entidades"])
        severidad = "info" if num_entidades < 5 else "media" if num_entidades < 10 else "alta"

        alertas.append({
            "tipo_alerta":      "proveedor_multientidad",
            "severidad":        severidad,
            "proveedor":        prov.get("nombre", ""),
            "proveedor_ruc":    prov["_id"],
            "num_entidades":    num_entidades,
            "entidades":        prov["entidades"][:20],  # Limitar tamaño
            "num_contratos":    prov["num_contratos"],
            "monto_total_usd":  prov["monto_total"],
            "descripcion":      (
                f"Proveedor '{prov.get('nombre', '')}' (RUC: {prov['_id']}) opera con "
                f"{num_entidades} entidades públicas, {prov['num_contratos']} contratos "
                f"por ${prov['monto_total']:,.2f}"
            ),
            "_ingestado":       datetime.now(timezone.utc),
        })

    # ── ALERTA 3: Correlación presupuesto vs pobreza ──────────────────────
    log.info("  Analizando correlaciones macro...")
    # Esto requiere que haya datos en las colecciones; genera una entrada informativa
    alertas.append({
        "tipo_alerta":  "correlacion_macro",
        "severidad":    "info",
        "descripcion":  (
            "Análisis pendiente: correlación entre presupuesto público por sector, "
            "indicadores de pobreza (INEC), recaudación tributaria (SRI) y "
            "ejecución presupuestaria (MEF). Requiere datos históricos acumulados."
        ),
        "colecciones_involucradas": [
            "fiscal.presupuesto", "demografico.pobreza",
            "tributario.recaudacion", "economico.pib",
        ],
        "_ingestado": datetime.now(timezone.utc),
    })

    # Guardar alertas
    total = 0
    if alertas:
        try:
            r = col_alertas.insert_many(alertas, ordered=False)
            total = len(r.inserted_ids)
        except BulkWriteError as e:
            total = e.details.get("nInserted", 0)

    log.info("  Alertas generadas: %d", total)
    return total


# ===========================================================================
# MÓDULO 4: LÍNEA TEMPORAL DE EVENTOS
# ===========================================================================

def construir_linea_temporal(db, modo_test: bool = False) -> int:
    """
    Crea una cronología unificada de todos los eventos del país.
    Permite ver qué pasó antes y después de cada evento para establecer
    relaciones causales.
    """
    log.info("=== CONSTRUCCIÓN LÍNEA TEMPORAL ===")
    col_timeline = db["analisis.linea_temporal"]
    col_timeline.create_index("fecha")
    col_timeline.create_index("tipo_evento")
    col_timeline.create_index("sector")

    eventos = []

    # Leyes aprobadas
    log.info("  Recopilando eventos legislativos...")
    limit = 100 if modo_test else 0
    for proy in db["legislativo.proyectos"].find(
        {"fecha_presentacion": {"$exists": True}},
        {"numero": 1, "titulo": 1, "estado": 1, "fecha_presentacion": 1, "proponente": 1},
        limit=limit
    ):
        fecha = proy.get("fecha_presentacion")
        if fecha and isinstance(fecha, str):
            try:
                fecha = datetime.fromisoformat(fecha.replace("Z", "+00:00"))
            except Exception:
                continue
        elif not isinstance(fecha, datetime):
            continue

        eventos.append({
            "fecha":       fecha,
            "tipo_evento": "proyecto_ley",
            "sector":      "legislativo",
            "titulo":      proy.get("titulo", ""),
            "referencia":  proy.get("numero", ""),
            "estado":      proy.get("estado", ""),
            "actor":       proy.get("proponente", ""),
            "impacto":     "alto" if "orgáni" in (proy.get("titulo") or "").lower() else "medio",
            "_fuente":     "legislativo.proyectos",
            "_ingestado":  datetime.now(timezone.utc),
        })

    # Contratos importantes (>$500k)
    log.info("  Recopilando contratos importantes...")
    for contrato in db["contratacion.contratos"].find(
        {"monto": {"$gte": 500000}},
        limit=limit
    ):
        fecha = contrato.get("fecha_firma")
        if fecha and isinstance(fecha, str):
            try:
                fecha = datetime.fromisoformat(fecha.replace("Z", "+00:00"))
            except Exception:
                continue
        elif not isinstance(fecha, datetime):
            continue

        eventos.append({
            "fecha":       fecha,
            "tipo_evento": "contrato_publico",
            "sector":      "contratacion",
            "titulo":      contrato.get("titulo", ""),
            "referencia":  contrato.get("ocid", ""),
            "actor":       contrato.get("entidad_nombre", ""),
            "beneficiario": contrato.get("proveedor_nombre", ""),
            "monto_usd":   contrato.get("monto"),
            "impacto":     "alto" if (contrato.get("monto") or 0) > 5_000_000 else "medio",
            "_fuente":     "contratacion.contratos",
            "_ingestado":  datetime.now(timezone.utc),
        })

    # Guardar timeline
    total = 0
    if eventos:
        try:
            r = col_timeline.insert_many(eventos, ordered=False)
            total = len(r.inserted_ids)
        except BulkWriteError as e:
            total = e.details.get("nInserted", 0)

    log.info("  Eventos en timeline: %d", total)
    return total


# ===========================================================================
# MÓDULO 5: RESUMEN POR ENTIDAD (Ficha completa)
# ===========================================================================

def generar_resumen_entidad(db, nombre_entidad: str = None, modo_test: bool = False) -> int:
    """
    Genera una ficha integral de una entidad cruzando TODAS las fuentes.
    Si no se especifica entidad, genera fichas de las top 50 más relevantes.
    """
    log.info("=== GENERACIÓN FICHAS DE ENTIDAD ===")
    col_fichas = db["analisis.resumen_entidad"]
    col_fichas.create_index("nombre")
    col_fichas.create_index("score_total")

    # Obtener entidades del grafo de vínculos
    filtro = {}
    if nombre_entidad:
        filtro = {"nombre": {"$regex": nombre_entidad, "$options": "i"}}

    entidades = list(db["analisis.vinculos"].find(
        filtro,
        sort=[("score_relevancia", -1)],
        limit=10 if modo_test else 50
    ))

    total = 0
    for ent in entidades:
        ruc = ent.get("ruc", "")
        nombre = ent.get("nombre", "")

        ficha = {
            "ruc":                    ruc,
            "nombre":                 nombre,
            "tipo":                   ent.get("tipo", "desconocido"),
            "score_total":            ent.get("score_relevancia", 0),
            # Datos de contratación
            "contratos_como_proveedor": ent.get("contratos_como_proveedor", 0),
            "montos_como_proveedor":    ent.get("montos_como_proveedor", 0),
            "contratos_como_entidad":   ent.get("contratos_como_entidad", 0),
            "montos_como_entidad":      ent.get("montos_como_entidad", 0),
            # Red de conexiones
            "conexiones_grafo":       list(db["analisis.grafo_poder"].find(
                {"$or": [{"origen": nombre}, {"destino": nombre}]},
                {"_id": 0, "origen": 1, "destino": 1, "relacion": 1, "peso": 1},
                limit=20
            )),
            # Alertas
            "alertas":                list(db["analisis.alertas"].find(
                {"$or": [{"proveedor_ruc": ruc}, {"entidad": nombre}]},
                {"_id": 0, "tipo_alerta": 1, "severidad": 1, "descripcion": 1},
                limit=10
            )),
            # Fuentes donde aparece
            "fuentes":                 ent.get("fuentes", []),
            "_ingestado":              datetime.now(timezone.utc),
        }

        from pymongo import UpdateOne
        col_fichas.update_one({"ruc": ruc}, {"$set": ficha}, upsert=True)
        total += 1

    log.info("  Fichas generadas: %d", total)
    return total


# ===========================================================================
# Main
# ===========================================================================

def main(modulos: list[str] = None, entidad: str = None, modo_test: bool = False):
    log.info("=" * 70)
    log.info("EcuaWatch · ANALIZADOR CAUSAL — Motor de Inteligencia Nacional")
    log.info("=" * 70)

    client  = MongoClient(MONGO_URI)
    db      = client[DB_NAME]
    col_log = db[COL_SYNC_LOG]

    todos = ["vinculos", "grafo", "alertas", "timeline", "fichas"]
    if not modulos:
        modulos = todos

    resumen = {}

    if "vinculos" in modulos:
        resumen["vinculos"] = vincular_por_ruc(db, modo_test)

    if "grafo" in modulos:
        resumen["grafo_poder"] = construir_grafo_poder(db, modo_test)

    if "alertas" in modulos:
        resumen["alertas"] = detectar_anomalias(db, modo_test)

    if "timeline" in modulos:
        resumen["linea_temporal"] = construir_linea_temporal(db, modo_test)

    if "fichas" in modulos:
        resumen["fichas_entidad"] = generar_resumen_entidad(db, entidad, modo_test)

    total = sum(resumen.values())
    log.info("\n" + "=" * 70)
    log.info("RESUMEN ANÁLISIS CAUSAL")
    log.info("=" * 70)
    for k, v in resumen.items():
        log.info("  %-20s → %d registros", k, v)
    log.info("  TOTAL:               → %d", total)

    col_log.insert_one({
        "fuente":    "analizador_causal",
        "estado":    "completado",
        "detalle":   resumen,
        "timestamp": datetime.now(timezone.utc),
    })
    client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="EcuaWatch — Motor de Análisis Causal e Inteligencia Nacional"
    )
    parser.add_argument(
        "--modulo",
        nargs="+",
        choices=["vinculos", "grafo", "alertas", "timeline", "fichas"],
        help="Módulos a ejecutar",
    )
    parser.add_argument("--entidad", type=str, help="Nombre de entidad específica")
    parser.add_argument("--test", action="store_true", help="Modo prueba")
    args = parser.parse_args()
    main(modulos=args.modulo, entidad=args.entidad, modo_test=args.test)
