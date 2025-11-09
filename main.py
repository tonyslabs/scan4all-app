# main.py
import os
import base64
import httpx
from fastapi import FastAPI, UploadFile, File, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

VT_API_KEY = os.getenv("VT_API_KEY")
VT_BASE = os.getenv("VT_BASE", "https://www.virustotal.com/api/v3")

if not VT_API_KEY:
    raise RuntimeError("Error: la variable de entorno VT_API_KEY no está configurada.")

app = FastAPI(title="Scan4All API", version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # en producción: limita a tu dominio o LAN
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

HEADERS = {"x-apikey": VT_API_KEY}


# --- Analizar archivos ---
@app.post("/scan/upload")
async def scan_upload(file: UploadFile = File(...)):
    """Sube un archivo a VirusTotal y devuelve el ID de análisis."""
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            files = {"file": (file.filename, await file.read(), file.content_type or "application/octet-stream")}
            vt_resp = await client.post(f"{VT_BASE}/files", headers=HEADERS, files=files)
        if vt_resp.status_code >= 400:
            raise HTTPException(vt_resp.status_code, vt_resp.text)
        data = vt_resp.json()
        return {"ok": True, "vt": data}
    except httpx.RequestError as e:
        raise HTTPException(502, f"Error al contactar VirusTotal: {e}") from e


# --- Consultar estado de análisis ---
@app.get("/scan/status/{analysis_id}")
async def scan_status(analysis_id: str):
    """Consulta el estado de un análisis previo."""
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            vt_resp = await client.get(f"{VT_BASE}/analyses/{analysis_id}", headers=HEADERS)
        if vt_resp.status_code >= 400:
            raise HTTPException(vt_resp.status_code, vt_resp.text)
        return vt_resp.json()
    except httpx.RequestError as e:
        raise HTTPException(502, f"Error al contactar VirusTotal: {e}") from e


# --- Analizar URLs ---
@app.post("/scan/url")
async def scan_url(data: dict = Body(...)):
    """
    Envía una URL a análisis.
    VirusTotal requiere que las URLs se envíen codificadas en Base64 (sin padding).
    """
    url = data.get("url")
    if not url:
        raise HTTPException(400, "Campo 'url' requerido")

    try:
        encoded_url = base64.urlsafe_b64encode(url.encode()).decode().strip("=")
        async with httpx.AsyncClient(timeout=30) as client:
            vt_resp = await client.post(f"{VT_BASE}/urls", headers=HEADERS, data={"url": url})
        if vt_resp.status_code >= 400:
            raise HTTPException(vt_resp.status_code, vt_resp.text)
        return {"ok": True, "vt": vt_resp.json()}
    except httpx.RequestError as e:
        raise HTTPException(502, f"Error al contactar VirusTotal: {e}") from e


# --- Endpoint raíz ---
@app.get("/")
def root():
    return {"service": "Scan4All API", "status": "ok"}
