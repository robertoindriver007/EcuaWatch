"""
scraper_lotaip.py — Recolector de Empleados Públicos (Literal b1)
===================================================================
Descarga nóminas de servidores públicos de datosabiertos.gob.ec y ministerios clave.
Utiliza el motor de resiliencia para evadir bloqueos.

Características principales:
1. Reconstrucción de Cédulas: Dado que por ley de protección de datos algunas entidades
   ocultan los números de cédula, este script implementa un motor probabilístico que
   cruza los Nombres Completos con la base del SRI y Contraloría para recuperar la Cédula.
2. Validación de Módulo 10: Verifica matemática y estandarizadamente las cédulas.

Colección: ecuador_intel.estado.funcionarios
"""

import argparse
import csv
import io
import logging
import re
import sys
import os
from datetime import datetime, timezone

# Add parent directory to path so we can import resiliencia
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient, UpdateOne
from resiliencia import HttpResilient, guardar_metricas_mongo

MONGO_URI = "mongodb+srv://scraperbot:GJqMqljz4GYBT0PU@cluster0.nz7wcxv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME = "ecuador_intel"

log = logging.getLogger("scraper_lotaip")

def validar_cedula_ecuador(cedula: str) -> bool:
    """Valida cédulas ecuatorianas mediante Módulo 10 (R.C. y Ley)."""
    if len(cedula) != 10 or not cedula.isdigit():
        return False
    provincia = int(cedula[0:2])
    if provincia < 1 or (provincia > 24 and provincia != 30):
        return False
    tercer_digito = int(cedula[2])
    if tercer_digito >= 6:
        return False  # Cédulas naturales son < 6
    
    coeficientes = [2, 1, 2, 1, 2, 1, 2, 1, 2]
    suma = 0
    for i in range(9):
        valor = int(cedula[i]) * coeficientes[i]
        if valor >= 10:
            valor -= 9
        suma += valor
    
    decena_superior = ((suma + 9) // 10) * 10
    digito_verificador = decena_superior - suma
    if digito_verificador == 10:
        digito_verificador = 0
        
    return digito_verificador == int(cedula[9])

def inferir_cedula(nombre_completo: str, db) -> str:
    """Busca en el catastro del SRI y proveedores SERCOP si este nombre tiene una cédula asociada."""
    if not nombre_completo:
        return ""
    # Evitar consultas completas repetitivas si el nombre es muy común (ej. "JUAN PEREZ")
    candidato = db["tributario.catastro_ruc"].find_one({"razon_social": {"$regex": re.escape(nombre_completo), "$options": "i"}})
    if candidato and candidato.get("ruc"):
        cedula = str(candidato.get("ruc"))[:10]
        if validar_cedula_ecuador(cedula):
            return cedula
            
    candidato_sercop = db["contratacion.proveedores"].find_one({"nombre": {"$regex": re.escape(nombre_completo), "$options": "i"}})
    if candidato_sercop and candidato_sercop.get("ruc"):
        cedula = str(candidato_sercop.get("ruc"))[:10]
        if validar_cedula_ecuador(cedula):
            return cedula
            
    return ""

def recolectar_datos_gobierno(db, test=False):
    log.info("Iniciando recolección de funcionarios públicos...")
    http = HttpResilient("lotaip_funcionarios", max_reintentos=4)
    
    # Fuentes de Datos Abiertos (CKAN) que contienen el distributivo de personal (ejemplo real de urls)
    # Por temas de demostración usaremos URLs persistentes o mock datos de estructura real del portal ecuatoriano.
    fuentes_csv = [
        # Dataset de prueba / estructural
        "https://datosabiertos.planificacion.gob.ec/dataset/50e1816e-e5cf-4d94-a90c-eb99eaca7d56/resource/ec4a243e-3296-4191-8406-8ae1dddb681a/download/distributivopersonal.csv"
    ]
    
    if test:
        log.info("Modo TEST: Generando conjunto de datos inicial semilla para pruebas de nepotismo...")
        semilla_funcionarios = [
            {"nombres_completos": "MARTINEZ RUIZ CARLOS ALBERTO", "institucion": "MINISTERIO DE SALUD PUBLICA", "puesto": "DIRECTOR NACIONAL", "rmu": 3200},
            {"nombres_completos": "LARA MENDOZA MARIA FERNANDA", "institucion": "MINISTERIO DE EDUCACION", "puesto": "COORDINADORA ZONAL", "rmu": 2500},
            {"nombres_completos": "ZAMBRANO VELEZ JUAN CARLOS", "institucion": "PETROECUADOR EP", "puesto": "GERENTE DE COMPRAS", "rmu": 5500},
            {"nombres_completos": "PEREZ SUAREZ ANA LUCIA", "institucion": "ASAMBLEA NACIONAL", "puesto": "ASESOR NIVEL 1", "rmu": 3000},
        ]
        
        ops = []
        for emp in semilla_funcionarios:
            cedula_inferida = inferir_cedula(emp["nombres_completos"], db)
            emp["cedula"] = cedula_inferida
            emp["_ingestado"] = datetime.now(timezone.utc)
            ops.append(UpdateOne({"nombres_completos": emp["nombres_completos"]}, {"$set": emp}, upsert=True))
            
        if ops:
            res = db["estado.funcionarios"].bulk_write(ops)
            log.info(f"Test mode: {res.upserted_count + res.modified_count} funcionarios semilla insertados.")
        return
        
    for idx, url in enumerate(fuentes_csv):
        log.info(f"Descargando {url}...")
        contenido = http.descargar_archivo(url, validar_minimo_bytes=5000)
        if not contenido:
            log.warning(f"Error descargando {url}")
            continue
            
        try:
            texto = contenido.decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(texto), delimiter=';')
            if not reader.fieldnames:
                reader = csv.DictReader(io.StringIO(texto), delimiter=',')
                
            ops = []
            for row in reader:
                nombre = row.get("Nombres y Apellidos", row.get("Nombre", "")).strip()
                if not nombre:
                    continue
                    
                puesto = row.get("Puesto Institucional", row.get("Cargo", "")).strip()
                institucion = row.get("Nombre Institución", row.get("Entidad", "Desconocida")).strip()
                
                cedula = row.get("Cedula", "")
                if not validar_cedula_ecuador(cedula):
                    cedula = inferir_cedula(nombre, db)
                    
                doc = {
                    "nombres_completos": nombre,
                    "institucion": institucion,
                    "puesto": puesto,
                    "rmu": row.get("Salario", row.get("RMU", 0)),
                    "cedula": cedula,
                    "origen": url,
                    "_ingestado": datetime.now(timezone.utc)
                }
                ops.append(UpdateOne({"nombres_completos": nombre, "institucion": institucion}, {"$set": doc}, upsert=True))
                
                if len(ops) >= 500:
                    db["estado.funcionarios"].bulk_write(ops)
                    ops = []
                    
            if ops:
                db["estado.funcionarios"].bulk_write(ops)
                
        except Exception as e:
            log.error(f"Error procesando CSV {url}: {e}")

    guardar_metricas_mongo(db, "lotaip")
    log.info("Scraping LOTAIP completado.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--test", action="store_true", help="Insertar data semilla de prueba")
    args = parser.parse_args()
    client = MongoClient(MONGO_URI)
    recolectar_datos_gobierno(client[DB_NAME], test=args.test)
    client.close()
