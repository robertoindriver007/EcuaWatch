# EcuaWatch 🇪🇨 — Plataforma de Inteligencia Gubernamental

> **Sistema automatizado de recolección, vinculación y análisis de todos los datos abiertos del Gobierno del Ecuador.**

## Arquitectura

```
EcuaWatch/
├── collectors/                    # Scrapers individuales
│   ├── scraper_datos_abiertos.py  ✅ CKAN Portal (500+ datasets)
│   ├── scraper_inec.py            ✅ INEC (empleo, inflación, census)
│   ├── scraper_bce.py             ✅ Banco Central (PIB, reservas)
│   └── scraper_cne.py             ✅ CNE (resultados electorales)
├── scraper_asamblea.py            ✅ Asamblea Nacional (proyectos de ley)
├── scraper_registro_oficial.py    ✅ Registro Oficial (leyes publicadas)
├── linker_asamblea_ro.py          ✅ Vincula Asamblea ↔ R.O.
├── orquestador.py                 ✅ Motor central de ejecución
├── requirements.txt               ✅
└── .github/workflows/
    └── ecuawatch_sync.yml         ✅ GitHub Actions (auto 24/7)
```

## MongoDB — Base de Datos `ecuador_intel`

| Colección | Fuente | Descripción |
|-----------|--------|-------------|
| `legislativo.proyectos` | Asamblea | Proyectos de ley activos e históricos |
| `legislativo.registro_oficial` | R.O. | Leyes publicadas con PDF |
| `datos_abiertos.catalogo` | CKAN | Catálogo de 500+ datasets |
| `demografico.empleo` | INEC | ENEMDU trimestral |
| `demografico.inflacion` | INEC | IPC mensual |
| `demografico.pobreza` | INEC | Tasas de pobreza y GINI |
| `demografico.censo` | INEC | Censo 2022 |
| `economico.pib` | BCE | PIB trimestral |
| `economico.inflacion_bce` | BCE | Deflactores |
| `economico.comercio_exterior` | BCE | Exportaciones/importaciones |
| `economico.tasas_interes` | BCE | Activas y pasivas |
| `economico.reservas_internacionales` | BCE | RILD |
| `economico.remesas` | BCE | Remesas del exterior |
| `electoral.resultados` | CNE | Resultados por elección |
| `electoral.padron` | CNE | Padrón por provincia |
| `_sync_log` | Sistema | Log de sincronización |

## Uso

```bash
# Instalar dependencias
pip install -r requirements.txt

# Ejecutar todos los scrapers
python orquestador.py --fuente all

# Solo fuentes específicas
python orquestador.py --fuente datos_abiertos inec

# Modo prueba (volumen reducido)
python orquestador.py --fuente all --test

# Ver estado del último sync
python orquestador.py --status

# Scraper individual
python collectors/scraper_datos_abiertos.py --test
python collectors/scraper_inec.py --indicador empleo inflacion
python collectors/scraper_bce.py --serie pib comercio_exterior
python collectors/scraper_cne.py --eleccion 2023-08
```

## GitHub Actions (24/7)

| Horario | Fuentes |
|---------|---------|
| Diario 02:00 UTC | Asamblea + Registro Oficial + CKAN + Linker |
| Mensual 1ro 04:00 UTC | BCE + INEC |
| Semanal lunes 06:00 UTC | CNE Electoral |

## Secrets requeridos en GitHub

- `MONGO_URI` — Connection string de MongoDB Atlas
- `GOOGLE_CREDS_JSON` — Credenciales de servicio de Google Drive
- `DRIVE_FOLDER_ID` — ID de la carpeta raíz en Google Drive

## Próximos scrapers (Sprint 2+)

- [ ] `scraper_minfin.py` — Ministerio de Finanzas (presupuesto abierto)
- [ ] `scraper_contraloria.py` — Contraloría (auditorías, indicios penales)
- [ ] `scraper_sri.py` — SRI (recaudación tributaria mensual)
- [ ] `api/main.py` — FastAPI REST para consultas
- [ ] `dashboard/` — React + D3.js visualizaciones
