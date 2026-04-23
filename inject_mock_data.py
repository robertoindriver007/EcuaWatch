import os
from pymongo import MongoClient
from datetime import datetime, timezone

MONGO_URI = "mongodb+srv://scraperbot:GJqMqljz4GYBT0PU@cluster0.nz7wcxv.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
DB_NAME = "ecuador_intel"

def inject():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    # 1. Mock Proveedores
    proveedores = [
        {"ruc": "1790011223001", "nombre": "CONSTRUCTORA DEL NORTE S.A."},
        {"ruc": "1791122334001", "nombre": "IMPORTADORA MEDICOS ECUADOR"},
        {"ruc": "0998877665001", "nombre": "TECNOLOGIA Y SISTEMAS CIA. LTDA."},
        {"ruc": "0102030405001", "nombre": "SOLUCIONES CIVILES S.A."},
    ]
    db["contratacion.proveedores"].delete_many({})
    db["contratacion.proveedores"].insert_many(proveedores)

    # 2. Mock Entidades
    entidades = [
        {"ruc": "1760001230001", "nombre": "MINISTERIO DE TRANSPORTE"},
        {"ruc": "1760004560001", "nombre": "MINISTERIO DE SALUD"},
        {"ruc": "1760007890001", "nombre": "CONSEJO DE LA JUDICATURA"},
    ]
    db["contratacion.entidades"].delete_many({})
    db["contratacion.entidades"].insert_many(entidades)

    # 3. Mock Contratos (Relaciones)
    contratos = [
        {"ocid": "ocds-1", "entidad_id": "1760001230001", "entidad_nombre": "MINISTERIO DE TRANSPORTE", "proveedor_ruc": "1790011223001", "proveedor_nombre": "CONSTRUCTORA DEL NORTE S.A.", "monto": 1500000, "fecha_firma": "2024-01-10"},
        {"ocid": "ocds-2", "entidad_id": "1760001230001", "entidad_nombre": "MINISTERIO DE TRANSPORTE", "proveedor_ruc": "0102030405001", "proveedor_nombre": "SOLUCIONES CIVILES S.A.", "monto": 800000, "fecha_firma": "2024-02-15"},
        {"ocid": "ocds-3", "entidad_id": "1760004560001", "entidad_nombre": "MINISTERIO DE SALUD", "proveedor_ruc": "1791122334001", "proveedor_nombre": "IMPORTADORA MEDICOS ECUADOR", "monto": 2500000, "fecha_firma": "2024-03-20"},
        {"ocid": "ocds-4", "entidad_id": "1760007890001", "entidad_nombre": "CONSEJO DE LA JUDICATURA", "proveedor_ruc": "0998877665001", "proveedor_nombre": "TECNOLOGIA Y SISTEMAS CIA. LTDA.", "monto": 300000, "fecha_firma": "2024-04-05"},
        # Nepotismo mock (Mismo apellido)
        {"ocid": "ocds-5", "entidad_id": "1760001230001", "entidad_nombre": "MINISTERIO DE TRANSPORTE", "proveedor_ruc": "1790011223001", "proveedor_nombre": "MARTINEZ RUIZ CIA.", "monto": 450000, "fecha_firma": "2024-05-12"},
    ]
    db["contratacion.contratos"].delete_many({})
    db["contratacion.contratos"].insert_many(contratos)

    print("Mock data injected successfully.")
    client.close()

if __name__ == "__main__":
    inject()
