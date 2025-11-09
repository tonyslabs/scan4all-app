# Scan4All API

Backend desarrollado en **Python + FastAPI**, encargado de comunicarse con la **API pública de VirusTotal**.

Permite analizar **archivos y URLs**, devolver el ID del análisis y consultar su estado hasta obtener el resultado final.

---

## Descripción general

Este servicio actúa como un *proxy limpio y seguro* entre la app móvil y VirusTotal.

Evita exponer directamente tu `VT_API_KEY` en el cliente y añade control sobre:
- Tipos de archivos permitidos
- Tamaño máximo
- Control de errores
- CORS y seguridad básica

---

## Tecnologías

| Área | Tecnología |
|------|-------------|
| Framework | FastAPI |
| HTTP Client | httpx (asíncrono) |
| CORS | fastapi.middleware.cors |
| Variables | python-dotenv |
| API externa | VirusTotal v3 |
| Servidor local | Uvicorn |

---

## Requisitos previos

- Python 3.10 o superior
- Cuenta en [VirusTotal](https://www.virustotal.com/)
- Clave API gratuita o premium (`VT_API_KEY`)

---

## Instalación y ejecución

```bash
# Clonar el repositorio
git clone https://github.com/tuusuario/scan4all-api.git
cd scan4all-api

# Crear entorno virtual
python3 -m venv venv
source venv/bin/activate

# Instalar dependencias
pip install -r requirements.txt

# Crear archivo .env
echo "VT_API_KEY=tu_api_key_aqui" > .env