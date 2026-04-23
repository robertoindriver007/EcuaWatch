"""
scraper_sercop.py — Scraper del SERCOP (Contratación Pública)
==============================================================
Portal:  https://datosabiertos.compraspublicas.gob.ec
API:     OCDS (Open Contracting Data Standard)
Datos:   Contrataciones públicas del Estado ecuatoriano
           - Procesos de contratación (licitaciones, compras directas, etc.)
           - Entidades contratantes (institución, monto, fecha)
           - Proveedores adjudicados (RUC, nombre, monto)
           - Contratos firmados y su ejecución
           - Vinculación con presupuesto público

Colección MongoDB: ecuador_intel.contratacion.procesos
                   ecuador_intel.contratacion.contratos
                   ecuador_intel.contratacion.proveedores
                   ecuador_intel.contratacion.entidades

IMPORTANCIA PARA ANÁLISIS CAUSAL:
  → Vincula autoridades que contratan ↔ empresas que reciben dinero público
  → Permite detectar concentración de contratos en pocos proveedores
  → Cruza con SRI (catastro RUC) y SuperCias (accionistas) para rastrear
    quiénes se benefician realmente del gasto público

Uso:
    python scraper_sercop.py                    # Todo
    python scraper_sercop.py --anio 2024        # Solo 2024
    python scraper_sercop.py --test             # Modo prueba (100 registros)
"""

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from typing import Optional

import requests
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

# API OCDS del SERCOP
SERCOP_API = "https://datosabiertos.compraspublicas.gob.ec/PLATAFORMA/api"
SERCOP_RECORD  = f"{SERCOP_API}/record"
SERCOP_RELEASE = f"{SERCOP_API}/release"
SERCOP_SEARCH  = f"{SERCOP_API}/search"

# CKAN complementario
CKAN_API = "https://www.datosabiertos.gob.ec/api/3/action"

HEADERS = {
    "User-Agent": "EcuaWatch-Bot/1.0 (SERCOP research; ecuawatch.org)",
    "Accept": "application/json",
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("scraper_sercop")

# ---------------------------------------------------------------------------
# API OCDS helpers
# ---------------------------------------------------------------------------

def consultar_api_ocds(endpoint: str, params: dict = None, timeout: int = 60) -> Optional[dict]:
    """Consulta la API OCDS del SERCOP con reintentos."""
    for intento in range(3):
        try:
            r = requests.get(endpoint, params=params, headers=HEADERS, timeout=timeout)
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            log.warning("Intento %d fallido para %s: %s", intento + 1, endpoint, e)
            time.sleep(3 ** intento)
        except json.JSONDecodeError as e:
            log.error("Error JSON de %s: %s", endpoint, e)
            return None
    return None


def obtener_registros_por_fecha(anio: int, mes: int = None, page_size: int = 100,
                                  max_pages: int = 50) -> list[dict]:
    """
    Descarga registros OCDS del SERCOP por año (y opcionalmente mes).
    Usa paginación para recorrer todos los resultados.
    """
    registros = []
    params = {
        "year": anio,
        "pageSize": page_size,
        "page": 0,
    }
    if mes:
        params["month"] = mes

    for pagina in range(max_pages):
        params["page"] = pagina
        log.info("  OCDS page %d (año=%d)", pagina, anio)

        data = consultar_api_ocds(SERCOP_RECORD, params)
        if not data:
            break

        records = data.get("records", data.get("releases", []))
        if not records:
            log.info("  Sin más registros en page %d", pagina)
            break

        registros.extend(records)
        time.sleep(0.5)  # Respetar rate limits

        # Si recibimos menos del tamaño de página, es la última
        if len(records) < page_size:
            break

    return registros


# ---------------------------------------------------------------------------
# Procesamiento OCDS → documentos MongoDB
# ---------------------------------------------------------------------------

def extraer_proceso(record: dict) -> dict:
    """
    Extrae datos clave de un registro OCDS y lo normaliza para MongoDB.
    Un registro OCDS tiene: planning, tender, awards, contracts.
    """
    compilado = record.get("compiledRelease", record)

    # Datos del proceso licitatorio
    tender = compilado.get("tender", {})
    buyer  = compilado.get("buyer", {})

    doc = {
        "ocid":              compilado.get("ocid", ""),
        "titulo":            tender.get("title", ""),
        "descripcion":       tender.get("description", ""),
        "estado":            tender.get("status", ""),
        "metodo_contratacion": tender.get("procurementMethod", ""),
        "categoria":         tender.get("mainProcurementCategory", ""),
        "monto_estimado":    tender.get("value", {}).get("amount"),
        "moneda":            tender.get("value", {}).get("currency", "USD"),
        "fecha_inicio":      tender.get("tenderPeriod", {}).get("startDate"),
        "fecha_cierre":      tender.get("tenderPeriod", {}).get("endDate"),
        "num_oferentes":     tender.get("numberOfTenderers", 0),
        # Entidad contratante
        "entidad_id":        buyer.get("id", ""),
        "entidad_nombre":    buyer.get("name", ""),
        # Metadatos de vinculación
        "_fuente":           "SERCOP",
        "_tipo":             "proceso_contratacion",
        "_ingestado":        datetime.now(timezone.utc),
    }

    return doc


def extraer_contratos(record: dict) -> list[dict]:
    """Extrae contratos firmados de un registro OCDS."""
    compilado = record.get("compiledRelease", record)
    contratos_raw = compilado.get("contracts", [])
    buyer = compilado.get("buyer", {})
    docs = []

    for contrato in contratos_raw:
        doc = {
            "ocid":           compilado.get("ocid", ""),
            "contrato_id":    contrato.get("id", ""),
            "titulo":         contrato.get("title", ""),
            "estado":         contrato.get("status", ""),
            "monto":          contrato.get("value", {}).get("amount"),
            "moneda":         contrato.get("value", {}).get("currency", "USD"),
            "fecha_firma":    contrato.get("dateSigned"),
            "periodo_inicio": contrato.get("period", {}).get("startDate"),
            "periodo_fin":    contrato.get("period", {}).get("endDate"),
            # Entidad
            "entidad_id":     buyer.get("id", ""),
            "entidad_nombre": buyer.get("name", ""),
            # Metadatos
            "_fuente":        "SERCOP",
            "_tipo":          "contrato",
            "_ingestado":     datetime.now(timezone.utc),
        }

        # Proveedor adjudicado
        suppliers = contrato.get("suppliers", [])
        if suppliers:
            doc["proveedor_id"]     = suppliers[0].get("id", "")
            doc["proveedor_nombre"] = suppliers[0].get("name", "")
            doc["proveedor_ruc"]    = suppliers[0].get("identifier", {}).get("id", "")

        docs.append(doc)

    return docs


def extraer_proveedores(record: dict) -> list[dict]:
    """Extrae la lista de proveedores/oferentes de un registro OCDS."""
    compilado = record.get("compiledRelease", record)
    parties = compilado.get("parties", [])
    docs = []

    for party in parties:
        roles = party.get("roles", [])
        if "supplier" in roles or "tenderer" in roles:
            doc = {
                "ocid":         compilado.get("ocid", ""),
                "proveedor_id": party.get("id", ""),
                "nombre":       party.get("name", ""),
                "ruc":          party.get("identifier", {}).get("id", ""),
                "esquema_id":   party.get("identifier", {}).get("scheme", ""),
                "direccion":    party.get("address", {}).get("streetAddress", ""),
                "localidad":    party.get("address", {}).get("locality", ""),
                "region":       party.get("address", {}).get("region", ""),
                "contacto":     party.get("contactPoint", {}).get("name", ""),
                "email":        party.get("contactPoint", {}).get("email", ""),
                "roles":        roles,
                "_fuente":      "SERCOP",
                "_tipo":        "proveedor",
                "_ingestado":   datetime.now(timezone.utc),
            }
            docs.append(doc)

    return docs


def extraer_entidades(record: dict) -> list[dict]:
    """Extrae entidades contratantes (instituciones públicas) del registro OCDS."""
    compilado = record.get("compiledRelease", record)
    parties = compilado.get("parties", [])
    docs = []

    for party in parties:
        roles = party.get("roles", [])
        if "buyer" in roles or "procuringEntity" in roles:
            doc = {
                "ocid":        compilado.get("ocid", ""),
                "entidad_id":  party.get("id", ""),
                "nombre":      party.get("name", ""),
                "ruc":         party.get("identifier", {}).get("id", ""),
                "direccion":   party.get("address", {}).get("streetAddress", ""),
                "localidad":   party.get("address", {}).get("locality", ""),
                "region":      party.get("address", {}).get("region", ""),
                "roles":       roles,
                "_fuente":     "SERCOP",
                "_tipo":       "entidad_contratante",
                "_ingestado":  datetime.now(timezone.utc),
            }
            docs.append(doc)

    return docs


# ---------------------------------------------------------------------------
# Driver principal
# ---------------------------------------------------------------------------

def procesar_anio(anio: int, db, modo_test: bool) -> dict:
    """Procesa todos los registros OCDS de un año dado."""
    col_procesos     = db["contratacion.procesos"]
    col_contratos    = db["contratacion.contratos"]
    col_proveedores  = db["contratacion.proveedores"]
    col_entidades    = db["contratacion.entidades"]

    # Índices para vinculación
    col_procesos.create_index("ocid", unique=True)
    col_procesos.create_index("entidad_id")
    col_procesos.create_index("metodo_contratacion")
    col_contratos.create_index("ocid")
    col_contratos.create_index("proveedor_ruc")
    col_contratos.create_index("entidad_id")
    col_proveedores.create_index("ruc")
    col_proveedores.create_index("nombre")
    col_entidades.create_index("ruc")
    col_entidades.create_index("nombre")

    max_pages = 3 if modo_test else 50
    registros = obtener_registros_por_fecha(anio, max_pages=max_pages)

    if modo_test:
        registros = registros[:100]

    log.info("  Año %d: %d registros OCDS descargados", anio, len(registros))

    stats = {"procesos": 0, "contratos": 0, "proveedores": 0, "entidades": 0}

    batch_procesos    = []
    batch_contratos   = []
    batch_proveedores = []
    batch_entidades   = []

    for record in registros:
        # Procesos
        proc = extraer_proceso(record)
        if proc.get("ocid"):
            batch_procesos.append(
                UpdateOne({"ocid": proc["ocid"]}, {"$set": proc}, upsert=True)
            )

        # Contratos
        for contrato in extraer_contratos(record):
            batch_contratos.append(
                UpdateOne(
                    {"ocid": contrato["ocid"], "contrato_id": contrato["contrato_id"]},
                    {"$set": contrato}, upsert=True
                )
            )

        # Proveedores
        for prov in extraer_proveedores(record):
            if prov.get("ruc"):
                batch_proveedores.append(
                    UpdateOne({"ruc": prov["ruc"]}, {"$set": prov}, upsert=True)
                )

        # Entidades
        for ent in extraer_entidades(record):
            if ent.get("ruc"):
                batch_entidades.append(
                    UpdateOne({"ruc": ent["ruc"]}, {"$set": ent}, upsert=True)
                )

    # Bulk writes
    if batch_procesos:
        r = col_procesos.bulk_write(batch_procesos, ordered=False)
        stats["procesos"] = r.upserted_count + r.modified_count
    if batch_contratos:
        r = col_contratos.bulk_write(batch_contratos, ordered=False)
        stats["contratos"] = r.upserted_count + r.modified_count
    if batch_proveedores:
        r = col_proveedores.bulk_write(batch_proveedores, ordered=False)
        stats["proveedores"] = r.upserted_count + r.modified_count
    if batch_entidades:
        r = col_entidades.bulk_write(batch_entidades, ordered=False)
        stats["entidades"] = r.upserted_count + r.modified_count

    log.info("  Año %d stats: %s", anio, stats)
    return stats


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main(anios: list[int] = None, modo_test: bool = False):
    log.info("=== EcuaWatch · scraper_sercop.py ===")

    client  = MongoClient(MONGO_URI)
    db      = client[DB_NAME]
    col_log = db[COL_SYNC_LOG]

    if not anios:
        anio_actual = datetime.now().year
        anios = list(range(anio_actual - 2, anio_actual + 1))  # Últimos 3 años

    resumen = {}
    for anio in anios:
        log.info("Procesando SERCOP año %d", anio)
        stats = procesar_anio(anio, db, modo_test)
        resumen[str(anio)] = stats

    total = sum(
        sum(s.values()) for s in resumen.values()
    )
    log.info("Finalizado SERCOP. Total: %d | %s", total, resumen)

    col_log.insert_one({
        "fuente":    "sercop",
        "estado":    "completado",
        "detalle":   {"resumen": resumen, "total": total},
        "timestamp": datetime.now(timezone.utc),
    })
    client.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Scraper SERCOP — contratación pública → MongoDB"
    )
    parser.add_argument("--anio", nargs="+", type=int, help="Años a procesar")
    parser.add_argument("--test", action="store_true", help="Modo prueba")
    args = parser.parse_args()
    main(anios=args.anio, modo_test=args.test)
