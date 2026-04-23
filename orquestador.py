"""
orquestador.py — Punto de entrada central del sistema EcuaWatch
================================================================
Ejecuta, coordina y monitorea todos los scrapers del sistema.

Uso:
    python orquestador.py --fuente all              # Todos
    python orquestador.py --fuente datos_abiertos   # Solo CKAN
    python orquestador.py --fuente inec bce         # INEC + BCE
    python orquestador.py --fuente all --test        # Modo prueba
    python orquestador.py --status                   # Ver último sync_log
    python orquestador.py --fuente asamblea          # Asamblea (repo original)

Fuentes disponibles:
    datos_abiertos  → datosabiertos.gob.ec    (CKAN API)
    inec            → ecuadorencifras.gob.ec   (Empleo, IPC, Censo)
    bce             → bce.fin.ec               (PIB, inflación, reservas)
    cne             → resultados.cne.gob.ec    (Resultados electorales)
    minfin          → finanzas.gob.ec          (Presupuesto, deuda pública)
    contraloria     → contraloria.gob.ec       (Auditorías, resoluciones)
    sri             → sri.gob.ec               (Recaudación tributaria)
    asamblea        → asambleanacional.gob.ec  (Proyectos de ley)
    registro        → registroficial.gob.ec    (Leyes publicadas)
    linker          → Vincula Asamblea ↔ RO
"""

import argparse
import importlib
import logging
import os
import subprocess
import sys
import time
from datetime import datetime, timezone

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

# Mapeo: nombre interno → módulo Python o script externo
FUENTES = {
    "datos_abiertos": {
        "modulo":   "collectors.scraper_datos_abiertos",
        "script":   "collectors/scraper_datos_abiertos.py",
        "horario":  "diario",
        "desc":     "Portal CKAN datos abiertos del gobierno",
        "prioridad": 1,
    },
    "inec": {
        "modulo":   "collectors.scraper_inec",
        "script":   "collectors/scraper_inec.py",
        "horario":  "mensual",
        "desc":     "INEC: empleo, inflacion, pobreza, censo",
        "prioridad": 2,
    },
    "bce": {
        "modulo":   "collectors.scraper_bce",
        "script":   "collectors/scraper_bce.py",
        "horario":  "mensual",
        "desc":     "Banco Central: PIB, reservas, tasas",
        "prioridad": 3,
    },
    "cne": {
        "modulo":   "collectors.scraper_cne",
        "script":   "collectors/scraper_cne.py",
        "horario":  "semanal",
        "desc":     "CNE: resultados electorales historicos",
        "prioridad": 4,
    },
    "minfin": {
        "modulo":   "collectors.scraper_minfin",
        "script":   "collectors/scraper_minfin.py",
        "horario":  "mensual",
        "desc":     "Min. Finanzas: presupuesto, deuda pública, GADs",
        "prioridad": 5,
    },
    "contraloria": {
        "modulo":   "collectors.scraper_contraloria",
        "script":   "collectors/scraper_contraloria.py",
        "horario":  "semanal",
        "desc":     "Contraloría: auditorías, resoluciones",
        "prioridad": 6,
    },
    "sri": {
        "modulo":   "collectors.scraper_sri",
        "script":   "collectors/scraper_sri.py",
        "horario":  "mensual",
        "desc":     "SRI: recaudación tributaria, catastro RUC",
        "prioridad": 7,
    },
    "sercop": {
        "modulo":   "collectors.scraper_sercop",
        "script":   "collectors/scraper_sercop.py",
        "horario":  "semanal",
        "desc":     "SERCOP: contratación pública (OCDS)",
        "prioridad": 8,
    },
    "judicial": {
        "modulo":   "collectors.scraper_judicial",
        "script":   "collectors/scraper_judicial.py",
        "horario":  "mensual",
        "desc":     "Función Judicial: causas, sentencias, estadísticas",
        "prioridad": 9,
    },
    "analizador": {
        "modulo":   None,
        "script":   "cerebro.py",
        "horario":  "diario",
        "desc":     "Cerebro v2: diagnóstico + anomalías + tendencias + críticas",
        "prioridad": 99,  # Siempre al final (necesita datos de todos los demás)
    },
    "asamblea": {
        "modulo":   None,
        "script":   "scraper_asamblea.py",   # Script original del repo
        "horario":  "diario",
        "desc":     "Asamblea Nacional: proyectos de ley",
        "prioridad": 8,
        "externo":  True,
    },
    "registro": {
        "modulo":   None,
        "script":   "scraper_registro_oficial.py",
        "horario":  "diario",
        "desc":     "Registro Oficial: leyes publicadas",
        "prioridad": 9,
        "externo":  True,
    },
    "linker": {
        "modulo":   None,
        "script":   "linker_asamblea_ro.py",
        "horario":  "diario",
        "desc":     "Vincula proyectos de ley ↔ Registro Oficial",
        "prioridad": 10,
        "externo":  True,
    },
}

# Orden de ejecución en modo 'all'
ORDEN_EJECUCION = sorted(FUENTES.items(), key=lambda x: x[1]["prioridad"])

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("orquestador")

# ---------------------------------------------------------------------------
# Ejecución de scrapers
# ---------------------------------------------------------------------------

def ejecutar_modulo(nombre: str, cfg: dict, modo_test: bool) -> dict:
    """
    Ejecuta el scraper como módulo Python importado (más eficiente).
    """
    resultado = {
        "fuente":     nombre,
        "inicio":     datetime.now(timezone.utc),
        "estado":     "error",
        "tiempo_s":   0,
        "error":      None,
    }
    t0 = time.time()
    try:
        modulo = importlib.import_module(cfg["modulo"])
        if hasattr(modulo, "main"):
            modulo.main(modo_test=modo_test)
            resultado["estado"] = "completado"
        else:
            log.error("El módulo %s no tiene función main()", cfg["modulo"])
            resultado["estado"] = "error"
            resultado["error"]  = "Sin función main()"
    except Exception as e:
        log.error("Error ejecutando %s: %s", nombre, e, exc_info=True)
        resultado["error"] = str(e)
    finally:
        resultado["tiempo_s"] = round(time.time() - t0, 2)
        resultado["fin"]      = datetime.now(timezone.utc)
    return resultado


def ejecutar_script(nombre: str, cfg: dict, modo_test: bool) -> dict:
    """
    Ejecuta el scraper como subprocess (para scripts externos del repo original).
    """
    resultado = {
        "fuente":   nombre,
        "inicio":   datetime.now(timezone.utc),
        "estado":   "error",
        "tiempo_s": 0,
        "error":    None,
    }
    t0  = time.time()
    cmd = [sys.executable, cfg["script"]]
    if modo_test:
        cmd.append("--test")

    log.info("Ejecutando script externo: %s", " ".join(cmd))
    try:
        proc = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=3600,  # 1 hora máximo por scraper
        )
        if proc.returncode == 0:
            resultado["estado"] = "completado"
            log.info("  ✓ %s finalizado correctamente", nombre)
        else:
            resultado["estado"] = "error"
            resultado["error"]  = proc.stderr[-2000:] if proc.stderr else "returncode != 0"
            log.error("  ✗ %s falló (code %d): %s", nombre, proc.returncode, resultado["error"])

        if proc.stdout:
            log.debug("  stdout: %s", proc.stdout[-1000:])

    except subprocess.TimeoutExpired:
        resultado["estado"] = "timeout"
        resultado["error"]  = "Timeout superado (3600s)"
        log.error("  ✗ %s: TIMEOUT", nombre)
    except Exception as e:
        resultado["error"] = str(e)
        log.error("  ✗ %s: %s", nombre, e)
    finally:
        resultado["tiempo_s"] = round(time.time() - t0, 2)
        resultado["fin"]      = datetime.now(timezone.utc)

    return resultado


def ejecutar_fuente(nombre: str, modo_test: bool = False) -> dict:
    """Dispatcher: elige entre módulo importado o subprocess según config."""
    cfg = FUENTES.get(nombre)
    if not cfg:
        log.error("Fuente desconocida: %s", nombre)
        return {"fuente": nombre, "estado": "error", "error": "Fuente desconocida"}

    log.info("=" * 60)
    log.info("INICIANDO: %s — %s", nombre.upper(), cfg["desc"])
    log.info("=" * 60)

    if cfg.get("externo") or not cfg.get("modulo"):
        return ejecutar_script(nombre, cfg, modo_test)
    else:
        return ejecutar_modulo(nombre, cfg, modo_test)


# ---------------------------------------------------------------------------
# Status report
# ---------------------------------------------------------------------------

def mostrar_status(col_log):
    """Muestra el último registro de sincronización de cada fuente."""
    pipeline = [
        {"$sort": {"timestamp": -1}},
        {"$group": {
            "_id":       "$fuente",
            "estado":    {"$first": "$estado"},
            "timestamp": {"$first": "$timestamp"},
            "detalle":   {"$first": "$detalle"},
        }},
        {"$sort": {"_id": 1}},
    ]
    resultados = list(col_log.aggregate(pipeline))

    if not resultados:
        log.info("No hay registros en _sync_log todavía.")
        return

    log.info("\n%-25s %-15s %-30s", "FUENTE", "ESTADO", "ÚLTIMO SYNC")
    log.info("-" * 70)
    for r in resultados:
        ts = r["timestamp"].strftime("%Y-%m-%d %H:%M UTC") if r.get("timestamp") else "N/A"
        log.info("%-25s %-15s %-30s", r["_id"], r["estado"], ts)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="EcuaWatch Orquestador — Ejecuta scrapers del gobierno del Ecuador",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="\n".join(
            [f"  {k:18} {v['desc']}" for k, v in FUENTES.items()]
        ),
    )
    parser.add_argument(
        "--fuente",
        nargs="+",
        choices=list(FUENTES.keys()) + ["all"],
        default=["all"],
        help="Fuente(s) a ejecutar. 'all' ejecuta todas en orden de prioridad.",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Modo prueba: volumen reducido de datos, sin escribir a Drive",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Muestra estado del último sync de cada fuente y sale",
    )
    parser.add_argument(
        "--excluir",
        nargs="+",
        choices=list(FUENTES.keys()),
        default=[],
        help="Fuentes a excluir cuando se usa --fuente all",
    )
    args = parser.parse_args()

    log.info("=" * 60)
    log.info("EcuaWatch Orquestador v1.0 — %s", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"))
    log.info("=" * 60)

    client  = MongoClient(MONGO_URI)
    db      = client[DB_NAME]
    col_log = db[COL_SYNC_LOG]
    col_log.create_index([("fuente", 1), ("timestamp", -1)])

    if args.status:
        mostrar_status(col_log)
        client.close()
        return

    # Resolver lista de fuentes
    if "all" in args.fuente:
        fuentes = [k for k, _ in ORDEN_EJECUCION if k not in args.excluir]
    else:
        fuentes = [f for f in args.fuente if f not in args.excluir]

    log.info("Fuentes a ejecutar: %s", fuentes)
    log.info("Modo prueba: %s", args.test)

    # Ejecutar y recopilar resultados
    resultados = []
    for nombre in fuentes:
        r = ejecutar_fuente(nombre, modo_test=args.test)
        resultados.append(r)

        # Guardar en sync_log
        col_log.insert_one(
            {
                "fuente":    r["fuente"],
                "estado":    r["estado"],
                "tiempo_s":  r.get("tiempo_s", 0),
                "error":     r.get("error"),
                "timestamp": datetime.now(timezone.utc),
                "modo_test": args.test,
            }
        )

        # Pausa entre scrapers para no saturar los portales
        if nombre != fuentes[-1]:
            log.info("Pausa de 5 segundos antes del siguiente scraper...")
            time.sleep(5)

    # Resumen final
    log.info("\n" + "=" * 60)
    log.info("RESUMEN DE EJECUCIÓN")
    log.info("=" * 60)
    ok   = [r for r in resultados if r["estado"] == "completado"]
    fail = [r for r in resultados if r["estado"] != "completado"]
    log.info("✓ Completados: %d", len(ok))
    log.info("✗ Con errores: %d", len(fail))
    for r in resultados:
        icono = "✓" if r["estado"] == "completado" else "✗"
        log.info("  %s %s (%s) — %.1fs", icono, r["fuente"], r["estado"], r.get("tiempo_s", 0))

    client.close()
    sys.exit(0 if not fail else 1)


if __name__ == "__main__":
    main()
