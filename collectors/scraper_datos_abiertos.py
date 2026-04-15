"""
scraper_datos_abiertos.py — Cliente CKAN para datosabiertos.gob.ec
======================================================================
Portal: https://www.datosabiertos.gob.ec
API:    CKAN REST API v3 (estándar internacional)

Descarga el catálogo completo de datasets del gobierno ecuatoriano,
filtra por categorías prioritarias, baja los recursos CSV/XLS y los 
almacena en MongoDB como documentos normalizados.

Colección MongoDB: ecuador_intel.datos_abiertos.catalogo
                   ecuador_intel.datos_abiertos.recursos

Uso:
    python scraper_datos_abiertos.py               # Todo el catálogo
    python scraper_datos_abiertos.py --grupos salud economia
    python scraper_datos_abiertos.py --test        # Solo 5 datasets
"""

import argparse
import io
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
DB_NAME = "ecuador_intel"
COL_CATALOGO = "datos_abiertos.catalogo"
COL_RECURSOS  = "datos_abiertos.recursos"
COL_SYNC_LOG  = "_sync_log"

CKAN_BASE = "https://www.datosabiertos.gob.ec"
CKAN_API  = f"{CKAN_BASE}/api/3/action"

# Grupos y tags de interés para mapeo gubernamental
GRUPOS_PRIORITARIOS = {
    "economia",
    "finanzas",
    "salud",
    "educacion",
    "seguridad",
    "justicia",
    "trabajo-y-empleo",
    "medio-ambiente",
    "transporte",
    "energia",
    "agricultura",
    "turismo",
    "gobierno-y-sector-publico",
    "ciencia-y-tecnologia",
    "poblacion-y-sociedad",
}

FORMATOS_DESCARGABLES = {"CSV", "XLS", "XLSX", "JSON", "XML"}

HEADERS = {
    "User-Agent": "EcuaWatch-Bot/1.0 (datosabiertos.gob.ec research; contact: bot@ecuawatch.org)"
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("scraper_datos_abiertos")

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _get(url: str, params: dict = None, timeout: int = 30) -> Optional[dict]:
    """GET con reintentos y manejo de errores."""
    for intento in range(3):
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=timeout)
            r.raise_for_status()
            data = r.json()
            if data.get("success"):
                return data.get("result")
            log.warning("CKAN retornó success=False en %s: %s", url, data.get("error"))
            return None
        except requests.RequestException as e:
            log.warning("Intento %d fallido para %s: %s", intento + 1, url, e)
            time.sleep(2 ** intento)
    return None


# ---------------------------------------------------------------------------
# CKAN: obtener catálogo completo
# ---------------------------------------------------------------------------

def obtener_ids_todos_datasets() -> list[str]:
    """Devuelve la lista de IDs de todos los datasets del portal."""
    resultado = _get(f"{CKAN_API}/package_list")
    if resultado is None:
        log.error("No se pudo obtener la lista de datasets.")
        return []
    log.info("Total datasets en el portal: %d", len(resultado))
    return resultado


def obtener_ids_por_grupo(grupo: str) -> list[str]:
    """Datasets de un grupo específico."""
    resultado = _get(
        f"{CKAN_API}/group_package_show",
        params={"id": grupo, "limit": 9999},
    )
    if not resultado:
        return []
    return [d["name"] for d in resultado]


def obtener_metadatos_dataset(dataset_id: str) -> Optional[dict]:
    """Metadatos completos de un dataset (con lista de recursos)."""
    return _get(f"{CKAN_API}/package_show", params={"id": dataset_id})


# ---------------------------------------------------------------------------
# Normalización de documentos
# ---------------------------------------------------------------------------

def normalizar_dataset(raw: dict) -> dict:
    """Convierte un dataset CKAN al schema de MongoDB."""
    recursos_normalizados = []
    for r in raw.get("resources", []):
        recursos_normalizados.append(
            {
                "id":        r.get("id"),
                "nombre":    r.get("name", ""),
                "formato":   r.get("format", "").upper(),
                "url":       r.get("url", ""),
                "tamaño_mb": round((r.get("size") or 0) / 1_048_576, 3),
                "creado":    _parse_fecha(r.get("created")),
                "modificado": _parse_fecha(r.get("last_modified")),
                "descargado": False,
                "descargado_en": None,
            }
        )

    return {
        "dataset_id":    raw.get("id"),
        "nombre":        raw.get("name"),
        "titulo":        raw.get("title", ""),
        "descripcion":   raw.get("notes", ""),
        "organizacion":  (raw.get("organization") or {}).get("title", ""),
        "grupos":        [g.get("name") for g in raw.get("groups", [])],
        "tags":          [t.get("name") for t in raw.get("tags", [])],
        "licencia":      raw.get("license_title", ""),
        "estado":        raw.get("state", ""),
        "tipo":          raw.get("type", ""),
        "url_portal":    f"{CKAN_BASE}/dataset/{raw.get('name')}",
        "creado":        _parse_fecha(raw.get("metadata_created")),
        "modificado":    _parse_fecha(raw.get("metadata_modified")),
        "num_recursos":  len(raw.get("resources", [])),
        "recursos":      recursos_normalizados,
        "actualizado_en": datetime.now(timezone.utc),
        "fuente":        "datosabiertos.gob.ec",
    }


def _parse_fecha(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(s[:19], fmt[:len(fmt)]).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


# ---------------------------------------------------------------------------
# MongoDB helpers
# ---------------------------------------------------------------------------

def upsert_catalogo(col, docs: list[dict]) -> int:
    """Upsert masivo por dataset_id."""
    if not docs:
        return 0
    ops = [
        UpdateOne(
            {"dataset_id": d["dataset_id"]},
            {"$set": d},
            upsert=True,
        )
        for d in docs
    ]
    try:
        res = col.bulk_write(ops, ordered=False)
        return res.upserted_count + res.modified_count
    except BulkWriteError as e:
        log.error("Error bulk_write: %s", e.details)
        return 0


def registrar_sync_log(col_log, fuente: str, estado: str, detalle: dict):
    col_log.insert_one(
        {
            "fuente":    fuente,
            "estado":    estado,
            "detalle":   detalle,
            "timestamp": datetime.now(timezone.utc),
        }
    )


# ---------------------------------------------------------------------------
# Motor principal
# ---------------------------------------------------------------------------

def main(grupos_filtro: list[str] = None, modo_test: bool = False):
    log.info("=== EcuaWatch · scraper_datos_abiertos.py ===")

    # Conexión MongoDB
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    col_catalogo = db[COL_CATALOGO]
    col_log      = db[COL_SYNC_LOG]

    # Índices
    col_catalogo.create_index("dataset_id", unique=True)
    col_catalogo.create_index("grupos")
    col_catalogo.create_index("organizacion")
    col_catalogo.create_index("modificado")

    # Obtener IDs
    if grupos_filtro:
        ids = []
        for g in grupos_filtro:
            ids.extend(obtener_ids_por_grupo(g))
        ids = list(set(ids))
        log.info("Datasets en grupos %s: %d únicos", grupos_filtro, len(ids))
    else:
        ids = obtener_ids_todos_datasets()

    if modo_test:
        ids = ids[:5]
        log.info("[TEST] Limitado a 5 datasets")

    total = len(ids)
    procesados = 0
    errores = 0
    batch = []
    BATCH_SIZE = 50

    for i, did in enumerate(ids):
        raw = obtener_metadatos_dataset(did)
        if not raw:
            errores += 1
            continue

        doc = normalizar_dataset(raw)
        batch.append(doc)
        procesados += 1

        if len(batch) >= BATCH_SIZE or i == total - 1:
            guardados = upsert_catalogo(col_catalogo, batch)
            log.info(
                "  Progreso: %d/%d · Batch guardado: %d documentos",
                i + 1, total, guardados,
            )
            batch = []

        time.sleep(0.2)  # Rate limiting

    log.info("Finalizado: %d procesados, %d errores de %d totales.", procesados, errores, total)

    registrar_sync_log(
        col_log,
        fuente="datos_abiertos",
        estado="completado" if errores < total * 0.1 else "completado_con_errores",
        detalle={
            "total":      total,
            "procesados": procesados,
            "errores":    errores,
            "grupos":     grupos_filtro or ["todos"],
        },
    )

    client.close()
    log.info("Conexión MongoDB cerrada.")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Scraper CKAN — datosabiertos.gob.ec → MongoDB"
    )
    parser.add_argument(
        "--grupos",
        nargs="+",
        metavar="GRUPO",
        help="Filtrar por grupos CKAN (ej: economia salud educacion)",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Modo prueba: procesa solo los primeros 5 datasets",
    )
    args = parser.parse_args()
    main(grupos_filtro=args.grupos, modo_test=args.test)
