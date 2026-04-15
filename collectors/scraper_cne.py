"""
scraper_cne.py — Scraper del Consejo Nacional Electoral (CNE)
=============================================================
Portal:  https://resultados.cne.gob.ec
         https://www.cne.gob.ec
Datos:   Resultados electorales históricos desde 2006
          - Presidentes y vicepresidentes
          - Asambleístas nacionales, provinciales, del exterior
          - Alcaldes, prefectos, concejales
          - Consultas populares y referéndums
          - Padrón electoral por provincia/cantón/parroquia

Colección MongoDB: ecuador_intel.electoral.resultados
                   ecuador_intel.electoral.padron
                   ecuador_intel.electoral.candidatos

Uso:
    python scraper_cne.py                          # Todas las elecciones
    python scraper_cne.py --eleccion 2023-08       # Solo agosto 2023
    python scraper_cne.py --tipo presidencial      # Solo presidenciales
    python scraper_cne.py --test                   # Última elección, modo prueba
"""

import argparse
import csv
import io
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
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

CNE_BASE     = "https://www.cne.gob.ec"
CNE_DATOS    = "https://resultados.cne.gob.ec"

# Catálogo de elecciones ecuatorianas — URLs directas de descarga CSV/Excel
# El CNE publica los resultados en su portal de datos abiertos
ELECCIONES = [
    {
        "id":     "2025-02",
        "nombre": "Elecciones Generales 2025 — Primera Vuelta",
        "fecha":  "2025-02-09",
        "tipo":   "presidencial",
        "url_resultados": "https://resultados.cne.gob.ec/",
        "url_csv":        None,  # Se detectará dinámicamente
    },
    {
        "id":     "2023-08",
        "nombre": "Elecciones Extraordinarias 2023",
        "fecha":  "2023-08-20",
        "tipo":   "extraordinaria",
        "url_csv": "https://www.cne.gob.ec/wp-content/uploads/2023/resultados/"
                   "resultados_2023_agosto.csv",
    },
    {
        "id":     "2021-02",
        "nombre": "Elecciones Generales 2021 — Primera Vuelta",
        "fecha":  "2021-02-07",
        "tipo":   "presidencial",
        "url_csv": "https://www.cne.gob.ec/documentos/estadisticas/2021/"
                   "resultados_electorales_2021.csv",
    },
    {
        "id":     "2019-03",
        "nombre": "Elecciones Seccionales 2019",
        "fecha":  "2019-03-24",
        "tipo":   "seccional",
        "url_csv": None,
    },
    {
        "id":     "2017-02",
        "nombre": "Elecciones Generales 2017 — Primera Vuelta",
        "fecha":  "2017-02-19",
        "tipo":   "presidencial",
        "url_csv": None,
    },
    {
        "id":     "2013-02",
        "nombre": "Elecciones Generales 2013",
        "fecha":  "2013-02-17",
        "tipo":   "presidencial",
        "url_csv": None,
    },
]

# APIs del portal de resultados del CNE (formato JSON moderno)
CNE_API_ENDPOINTS = {
    "provincias":      f"{CNE_DATOS}/api/v1/provincias",
    "candidatos":      f"{CNE_DATOS}/api/v1/candidatos",
    "resultados_prov": f"{CNE_DATOS}/api/v1/resultados/provincia/{{provincia_id}}",
    "actas":           f"{CNE_DATOS}/api/v1/actas",
}

HEADERS = {
    "User-Agent": "EcuaWatch-Bot/1.0 (CNE research; ecuawatch.org)",
    "Accept":     "application/json, text/html, */*",
}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("scraper_cne")

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _get(url: str, timeout: int = 30) -> Optional[requests.Response]:
    for intento in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=timeout)
            r.raise_for_status()
            return r
        except requests.RequestException as e:
            log.warning("Intento %d: %s — %s", intento + 1, url, e)
            time.sleep(2 ** intento)
    return None


# ---------------------------------------------------------------------------
# Scrapers CNE
# ---------------------------------------------------------------------------

def obtener_resultados_api(eleccion: dict) -> list[dict]:
    """
    Intenta obtener resultados desde la API JSON del portal de resultados CNE.
    El portal usa una SPA React; intentamos los endpoints conocidos.
    """
    docs = []

    # Intentar endpoint de resultados por provincia
    for prov_id in range(1, 25):  # 24 provincias de Ecuador
        url = f"{CNE_DATOS}/api/v1/resultados/provincia/{prov_id}"
        r = _get(url)
        if not r:
            continue
        try:
            data = r.json()
            if isinstance(data, list):
                for item in data:
                    item["_eleccion_id"]  = eleccion["id"]
                    item["_eleccion"]     = eleccion["nombre"]
                    item["_tipo"]         = eleccion["tipo"]
                    item["_fuente"]       = "CNE"
                    item["_ingestado"]    = datetime.now(timezone.utc)
                    docs.append(item)
            elif isinstance(data, dict) and "resultados" in data:
                for item in data["resultados"]:
                    item["_eleccion_id"]  = eleccion["id"]
                    item["_eleccion"]     = eleccion["nombre"]
                    item["_tipo"]         = eleccion["tipo"]
                    item["_fuente"]       = "CNE"
                    item["_ingestado"]    = datetime.now(timezone.utc)
                    docs.append(item)
        except (json.JSONDecodeError, ValueError):
            pass

    return docs


def descargar_csv_eleccion(eleccion: dict) -> list[dict]:
    """Descarga el CSV oficial de una elección y lo convierte a documentos."""
    url = eleccion.get("url_csv")
    if not url:
        return []

    r = _get(url, timeout=60)
    if not r:
        return []

    docs = []
    try:
        for enc in ("utf-8-sig", "latin-1", "iso-8859-1"):
            try:
                texto = r.content.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            return []

        try:
            dialect = csv.Sniffer().sniff(texto[:2048])
        except csv.Error:
            dialect = csv.excel

        reader = csv.DictReader(io.StringIO(texto), dialect=dialect)
        for fila in reader:
            doc = {k.strip(): v.strip() for k, v in fila.items() if k}
            doc["_eleccion_id"] = eleccion["id"]
            doc["_eleccion"]    = eleccion["nombre"]
            doc["_tipo"]        = eleccion["tipo"]
            doc["_fecha"]       = eleccion["fecha"]
            doc["_fuente"]      = "CNE"
            doc["_url_origen"]  = url
            doc["_ingestado"]   = datetime.now(timezone.utc)
            docs.append(doc)
    except Exception as e:
        log.error("Error parseando CSV elección %s: %s", eleccion["id"], e)

    return docs


def scrape_portal_resultados_cne() -> list[dict]:
    """
    Scraper HTML del portal de resultados CNE para la elección más reciente.
    Extrae datos de tablas de resultados.
    """
    docs = []
    r = _get(CNE_DATOS)
    if not r:
        log.warning("No se pudo acceder al portal de resultados CNE")
        return docs

    soup = BeautifulSoup(r.text, "lxml")

    # Buscar tablas de resultados
    for tabla in soup.find_all("table"):
        cabeceras = [th.get_text(strip=True) for th in tabla.find_all("th")]
        if not cabeceras:
            continue
        for tr in tabla.find_all("tr")[1:]:
            celdas = [td.get_text(strip=True) for td in tr.find_all("td")]
            if not celdas:
                continue
            doc = dict(zip(cabeceras, celdas))
            doc["_fuente"]    = "CNE"
            doc["_tabla"]     = "portal_resultados"
            doc["_ingestado"] = datetime.now(timezone.utc)
            docs.append(doc)

    # Buscar datos JSON embebidos en scripts
    for script in soup.find_all("script"):
        texto = script.get_text()
        if "resultados" in texto.lower() and "{" in texto:
            try:
                inicio = texto.find("{")
                fin    = texto.rfind("}") + 1
                data   = json.loads(texto[inicio:fin])
                if isinstance(data, dict):
                    doc = {**data, "_fuente": "CNE", "_tipo": "script_embed",
                           "_ingestado": datetime.now(timezone.utc)}
                    docs.append(doc)
            except (json.JSONDecodeError, ValueError):
                pass

    return docs


def obtener_padron_electoral() -> list[dict]:
    """
    Descarga datos del padrón electoral del portal del CNE.
    Genera documentos por provincia con el número de electores habilitados.
    """
    docs = []
    url_padron = f"{CNE_BASE}/estadisticas-electorales/"

    r = _get(url_padron)
    if not r:
        log.warning("No se pudo acceder a estadísticas del padrón")
        return docs

    soup = BeautifulSoup(r.text, "lxml")

    # El CNE publica tablas con estadísticas del padrón
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if any(kw in href.lower() for kw in ["padron", "padrón", "electores", "electoral"]):
            if any(ext in href.lower() for ext in [".csv", ".xls", ".xlsx"]):
                url_archivo = href if href.startswith("http") else urljoin(CNE_BASE, href)
                r_archivo = _get(url_archivo, timeout=60)
                if r_archivo:
                    docs.append(
                        {
                            "tipo":        "padron_link",
                            "url":         url_archivo,
                            "nombre":      a.get_text(strip=True),
                            "tamaño":      len(r_archivo.content),
                            "_fuente":     "CNE",
                            "_ingestado":  datetime.now(timezone.utc),
                        }
                    )

    return docs


# ---------------------------------------------------------------------------
# MongoDB
# ---------------------------------------------------------------------------

def guardar_docs(col, docs: list[dict], clave_dedup: str = None) -> int:
    if not docs:
        return 0
    if clave_dedup:
        ops = [
            UpdateOne(
                {clave_dedup: d.get(clave_dedup), "_eleccion_id": d.get("_eleccion_id")},
                {"$set": d},
                upsert=True,
            )
            for d in docs if d.get(clave_dedup)
        ]
        if ops:
            try:
                res = col.bulk_write(ops, ordered=False)
                return res.upserted_count + res.modified_count
            except BulkWriteError as e:
                return e.details.get("nUpserted", 0)
    else:
        try:
            res = col.insert_many(docs, ordered=False)
            return len(res.inserted_ids)
        except BulkWriteError as e:
            return e.details.get("nInserted", 0)


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
# Main
# ---------------------------------------------------------------------------

def main(
    eleccion_filtro: str = None,
    tipo_filtro: str = None,
    modo_test: bool = False,
):
    log.info("=== EcuaWatch · scraper_cne.py ===")

    client  = MongoClient(MONGO_URI)
    db      = client[DB_NAME]
    col_res = db["electoral.resultados"]
    col_pad = db["electoral.padron"]
    col_log = db[COL_SYNC_LOG]

    # Índices
    col_res.create_index([("_eleccion_id", 1), ("provincia", 1)])
    col_res.create_index("_tipo")
    col_pad.create_index("_ingestado")

    # Filtrar elecciones
    elecciones = ELECCIONES
    if eleccion_filtro:
        elecciones = [e for e in elecciones if e["id"] == eleccion_filtro]
    if tipo_filtro:
        elecciones = [e for e in elecciones if e["tipo"] == tipo_filtro]
    if modo_test:
        elecciones = elecciones[:1]
        log.info("[TEST] Solo procesando: %s", elecciones[0]["nombre"])

    resumen = {"resultados": 0, "padron": 0}

    # --- Resultados por elección ---
    for eleccion in elecciones:
        log.info("Procesando elección: %s", eleccion["nombre"])
        docs = []

        # Intentar API JSON primero (elecciones recientes)
        if eleccion["id"] >= "2021":
            docs = obtener_resultados_api(eleccion)
            log.info("  API JSON: %d documentos", len(docs))

        # Fallback: CSV directo
        if not docs and eleccion.get("url_csv"):
            docs = descargar_csv_eleccion(eleccion)
            log.info("  CSV directo: %d documentos", len(docs))

        # Fallback: scrape HTML
        if not docs and eleccion["id"] == ELECCIONES[0]["id"]:
            docs = scrape_portal_resultados_cne()
            log.info("  HTML scrape: %d documentos", len(docs))

        if docs:
            n = guardar_docs(col_res, docs)
            resumen["resultados"] += n
            log.info("  → %d documentos guardados para %s", n, eleccion["nombre"])

        time.sleep(1)

    # --- Padrón Electoral ---
    log.info("Descargando datos del padrón electoral...")
    docs_padron = obtener_padron_electoral()
    if docs_padron:
        n = guardar_docs(col_pad, docs_padron)
        resumen["padron"] = n
        log.info("  → %d documentos de padrón guardados", n)

    total = sum(resumen.values())
    log.info("Finalizado CNE. Total: %d | %s", total, resumen)

    registrar_sync_log(
        col_log,
        fuente="cne",
        estado="completado",
        detalle={"resumen": resumen, "elecciones_procesadas": [e["id"] for e in elecciones]},
    )
    client.close()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Scraper CNE — resultados electorales Ecuador → MongoDB"
    )
    parser.add_argument("--eleccion", metavar="YYYY-MM", help="ID de elección (ej: 2023-08)")
    parser.add_argument(
        "--tipo",
        choices=["presidencial", "seccional", "extraordinaria"],
        help="Filtrar por tipo de elección",
    )
    parser.add_argument("--test", action="store_true", help="Modo prueba: solo última elección")
    args = parser.parse_args()
    main(
        eleccion_filtro=args.eleccion,
        tipo_filtro=args.tipo,
        modo_test=args.test,
    )
