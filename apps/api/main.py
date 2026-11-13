# main.py
import hmac
import ipaddress
import os
import re
import time
from collections import defaultdict, deque
from urllib.parse import urlsplit

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator

load_dotenv()

VT_API_KEY = os.getenv("VT_API_KEY")
VT_BASE = os.getenv("VT_BASE", "https://www.virustotal.com/api/v3")
# Token que deben enviar los clientes en el header X-API-Key.
API_TOKEN = os.getenv("API_TOKEN")
# El endpoint directo de subida acepta hasta 32 MB; por encima se usa una URL de subida (hasta 650 MB).
DIRECT_UPLOAD_BYTES = 32 * 1024 * 1024
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "650")) * 1024 * 1024
# Peticiones por minuto y por IP.
RATE_SCAN_PER_MIN = int(os.getenv("RATE_SCAN_PER_MIN", "10"))
RATE_STATUS_PER_MIN = int(os.getenv("RATE_STATUS_PER_MIN", "60"))
RATE_LOOKUP_PER_MIN = int(os.getenv("RATE_LOOKUP_PER_MIN", "60"))
RATE_WRITE_PER_MIN = int(os.getenv("RATE_WRITE_PER_MIN", "10"))
# Detrás de Cloudflare Tunnel la IP del socket es la del proxy: con TRUST_PROXY=1 se usa CF-Connecting-IP.
# Activar solo si la API únicamente es alcanzable por el túnel o la tailnet (si no, el header se puede falsificar).
TRUST_PROXY = os.getenv("TRUST_PROXY", "0") == "1"
# Publicar comentarios y votos usa la cuenta de la clave del servidor; ALLOW_WRITES=0 lo desactiva.
ALLOW_WRITES = os.getenv("ALLOW_WRITES", "1") == "1"

DEFAULT_ORIGINS = [
    "tauri://localhost",  # Tauri (Linux/macOS/iOS)
    "http://tauri.localhost",  # Tauri (Windows/Android)
    "https://tauri.localhost",
    "http://localhost:1420",  # vite en desarrollo
]
ALLOWED_ORIGINS = [
    o.strip() for o in os.getenv("ALLOWED_ORIGINS", ",".join(DEFAULT_ORIGINS)).split(",") if o.strip()
]

if not VT_API_KEY:
    raise RuntimeError("Error: la variable de entorno VT_API_KEY no está configurada.")
if not API_TOKEN or len(API_TOKEN) < 16:
    raise RuntimeError("Error: API_TOKEN no está configurado o es muy corto (mínimo 16 caracteres).")

app = FastAPI(title="Scan4All API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["X-API-Key", "Content-Type"],
)

HEADERS = {"x-apikey": VT_API_KEY}


# Los errores de validación también salen como {"detail": "mensaje"} (string), como el resto.
@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    first = exc.errors()[0] if exc.errors() else {}
    msg = str(first.get("msg", "Solicitud inválida")).removeprefix("Value error, ")
    return JSONResponse(status_code=422, content={"detail": msg})

# --- Autenticación ---
async def require_token(request: Request) -> None:
    sent = request.headers.get("x-api-key", "")
    if not hmac.compare_digest(sent.encode(), API_TOKEN.encode()):
        raise HTTPException(401, "Token inválido o ausente")


# --- Rate limit en memoria (ventana deslizante de 60 s por IP y bucket) ---
_hits: dict[tuple[str, str], deque[float]] = defaultdict(deque)


def client_ip(request: Request) -> str:
    if TRUST_PROXY:
        forwarded = request.headers.get("cf-connecting-ip", "").strip()
        if forwarded:
            return forwarded
    return request.client.host if request.client else "?"


def rate_limit(bucket: str, limit: int):
    async def dep(request: Request) -> None:
        ip = client_ip(request)
        now = time.monotonic()
        q = _hits[(bucket, ip)]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= limit:
            retry = max(1, int(60 - (now - q[0])))
            raise HTTPException(429, f"Demasiadas solicitudes, reintenta en {retry} s", headers={"Retry-After": str(retry)})
        q.append(now)

    return dep


# --- Errores de VirusTotal: no exponer el cuerpo crudo ---
# Los mensajes llegan tal cual al front, que no debe nombrar al proveedor.
VT_ERRORS = {
    400: (400, "El servicio de análisis rechazó la solicitud"),
    401: (502, "La clave del servicio de análisis no es válida"),
    403: (403, "Esta función no está disponible con la cuenta del servidor"),
    404: (404, "No se encontró información"),
    409: (409, "El servicio de análisis reportó un conflicto"),
    413: (413, "Archivo demasiado grande"),
    429: (429, "Hay demasiadas consultas, reintenta en un momento"),
}


async def vt_request(method: str, path: str, *, timeout: float, **kwargs) -> dict:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            url = path if path.startswith("https://www.virustotal.com/") else f"{VT_BASE}{path}"
            resp = await client.request(method, url, headers=HEADERS, **kwargs)
    except httpx.RequestError as e:
        raise HTTPException(502, "No se pudo contactar al servicio de análisis") from e
    if resp.status_code >= 400:
        status, msg = VT_ERRORS.get(resp.status_code, (502, "Error del servicio de análisis"))
        raise HTTPException(status, msg)
    try:
        return resp.json()
    except ValueError as e:
        raise HTTPException(502, "Respuesta inválida del servicio de análisis") from e


# --- Analizar archivos ---
@app.post(
    "/scan/upload",
    dependencies=[Depends(require_token), Depends(rate_limit("scan", RATE_SCAN_PER_MIN))],
)
async def scan_upload(request: Request, file: UploadFile = File(...)):
    """Sube un archivo a análisis y devuelve el ID del análisis."""
    declared = request.headers.get("content-length")
    limit_mb = MAX_UPLOAD_BYTES // (1024 * 1024)
    if declared and declared.isdigit() and int(declared) > MAX_UPLOAD_BYTES + 1024 * 64:
        raise HTTPException(413, f"El archivo supera el máximo de {limit_mb} MB")

    # Starlette ya dejó el archivo en disco (SpooledTemporaryFile): se mide sin cargarlo a memoria.
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_UPLOAD_BYTES:
        raise HTTPException(413, f"El archivo supera el máximo de {limit_mb} MB")
    if size == 0:
        raise HTTPException(400, "El archivo está vacío")

    files = {"file": (file.filename or "file.bin", file.file, file.content_type or "application/octet-stream")}
    if size <= DIRECT_UPLOAD_BYTES:
        return {"ok": True, "vt": await vt_request("POST", "/files", timeout=120, files=files)}
    # Archivos grandes: el servicio entrega una URL de subida de un solo uso.
    target = (await vt_request("GET", "/files/upload_url", timeout=30)).get("data")
    if not isinstance(target, str) or not target.startswith("https://www.virustotal.com/"):
        raise HTTPException(502, "Respuesta inválida del servicio de análisis")
    return {"ok": True, "vt": await vt_request("POST", target, timeout=900, files=files)}


# --- Consultar estado de análisis ---
ANALYSIS_ID = re.compile(r"^[A-Za-z0-9=_\-]{8,128}$")


@app.get(
    "/scan/status/{analysis_id}",
    dependencies=[Depends(require_token), Depends(rate_limit("status", RATE_STATUS_PER_MIN))],
)
async def scan_status(analysis_id: str):
    """Consulta el estado de un análisis previo."""
    if not ANALYSIS_ID.fullmatch(analysis_id):
        raise HTTPException(400, "analysis_id inválido")
    return await vt_request("GET", f"/analyses/{analysis_id}", timeout=30)


# --- Analizar URLs ---
class UrlBody(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def valid_url(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 2048:
            raise ValueError("URL vacía o demasiado larga")
        parts = urlsplit(v)
        if parts.scheme not in ("http", "https") or not parts.netloc:
            raise ValueError("Solo se aceptan URLs http:// o https://")
        return v


@app.post(
    "/scan/url",
    dependencies=[Depends(require_token), Depends(rate_limit("scan", RATE_SCAN_PER_MIN))],
)
async def scan_url(body: UrlBody):
    """Envía una URL a análisis (el servicio la recibe como form-data)."""
    return {"ok": True, "vt": await vt_request("POST", "/urls", timeout=30, data={"url": body.url})}



# ===================== Consulta: archivos, URLs, dominios e IPs =====================
COLLECTIONS = {"file": "files", "url": "urls", "domain": "domains", "ip": "ip_addresses"}
HEX_HASH = re.compile(r"^(?:[A-Fa-f0-9]{32}|[A-Fa-f0-9]{40}|[A-Fa-f0-9]{64})$")
URL_ID = re.compile(r"^[A-Za-z0-9_\-=]{8,2800}$")
DOMAIN = re.compile(r"^(?=.{1,253}$)(?:[A-Za-z0-9_](?:[A-Za-z0-9_-]{0,61}[A-Za-z0-9_])?\.)+[A-Za-z0-9-]{2,63}$")
CURSOR = re.compile(r"^[A-Za-z0-9_\-=+/.]{1,512}$")

# Relaciones permitidas por tipo (lista cerrada: nada del cliente llega a la ruta sin validar).
RELATIONSHIPS = {
    "file": {"contacted_domains", "contacted_ips", "contacted_urls", "dropped_files", "execution_parents",
             "bundled_files", "compressed_parents", "itw_urls", "itw_domains", "itw_ips", "similar_files"},
    "url": {"contacted_domains", "contacted_ips", "downloaded_files", "last_serving_ip_address",
            "redirecting_urls", "redirects_to", "referrer_files", "communicating_files"},
    "domain": {"resolutions", "subdomains", "siblings", "urls", "communicating_files", "downloaded_files",
               "referrer_files", "historical_ssl_certificates"},
    "ip": {"resolutions", "urls", "communicating_files", "downloaded_files", "referrer_files",
           "historical_ssl_certificates"},
}


def entity_path(kind: str, ident: str) -> str:
    """Valida el identificador según el tipo y devuelve la ruta base del objeto."""
    if kind not in COLLECTIONS:
        raise HTTPException(400, "Tipo inválido")
    ident = ident.strip()
    ok = False
    if kind == "file":
        ok = bool(HEX_HASH.fullmatch(ident))
    elif kind == "url":
        ok = bool(URL_ID.fullmatch(ident))
    elif kind == "domain":
        ok = bool(DOMAIN.fullmatch(ident))
    else:
        try:
            ipaddress.ip_address(ident)
            ok = True
        except ValueError:
            ok = False
    if not ok:
        raise HTTPException(400, "Identificador inválido")
    return f"/{COLLECTIONS[kind]}/{ident}"


def page_params(limit: int, cursor: str | None) -> dict:
    params: dict = {"limit": limit}
    if cursor:
        if not CURSOR.fullmatch(cursor):
            raise HTTPException(400, "Cursor inválido")
        params["cursor"] = cursor
    return params


def require_writes() -> None:
    if not ALLOW_WRITES:
        raise HTTPException(403, "Esta función está desactivada en el servidor")


READ = [Depends(require_token), Depends(rate_limit("lookup", RATE_LOOKUP_PER_MIN))]
WRITE = [Depends(require_token), Depends(rate_limit("write", RATE_WRITE_PER_MIN))]


@app.get("/lookup/{kind}/{ident}", dependencies=READ)
async def lookup(kind: str, ident: str):
    """Informe completo de un archivo (hash), URL (id), dominio o IP."""
    return await vt_request("GET", entity_path(kind, ident), timeout=30)


@app.post("/lookup/{kind}/{ident}/rescan", dependencies=WRITE)
async def rescan(kind: str, ident: str):
    """Pide un nuevo análisis; devuelve el ID para consultar /scan/status."""
    return {"ok": True, "vt": await vt_request("POST", f"{entity_path(kind, ident)}/analyse", timeout=30)}


@app.get("/lookup/{kind}/{ident}/relationships/{rel}", dependencies=READ)
async def relationships(kind: str, ident: str, rel: str, limit: int = Query(10, ge=1, le=40), cursor: str | None = None):
    base = entity_path(kind, ident)
    if rel not in RELATIONSHIPS[kind]:
        raise HTTPException(400, "Relación inválida")
    return await vt_request("GET", f"{base}/{rel}", timeout=30, params=page_params(limit, cursor))


@app.get("/lookup/file/{ident}/behaviour", dependencies=READ)
async def behaviour(ident: str):
    """Resumen de comportamiento en sandbox (puede no estar disponible con la cuenta del servidor)."""
    return await vt_request("GET", f"{entity_path('file', ident)}/behaviour_summary", timeout=30)


@app.get("/lookup/{kind}/{ident}/comments", dependencies=READ)
async def comments(kind: str, ident: str, limit: int = Query(10, ge=1, le=40), cursor: str | None = None):
    return await vt_request("GET", f"{entity_path(kind, ident)}/comments", timeout=30, params=page_params(limit, cursor))


class CommentBody(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def valid_text(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 2000:
            raise ValueError("El comentario debe tener entre 1 y 2000 caracteres")
        return v


@app.post("/lookup/{kind}/{ident}/comments", dependencies=WRITE)
async def add_comment(kind: str, ident: str, body: CommentBody):
    require_writes()
    payload = {"data": {"type": "comment", "attributes": {"text": body.text}}}
    return await vt_request("POST", f"{entity_path(kind, ident)}/comments", timeout=30, json=payload)


@app.get("/lookup/{kind}/{ident}/votes", dependencies=READ)
async def votes(kind: str, ident: str, limit: int = Query(10, ge=1, le=40), cursor: str | None = None):
    return await vt_request("GET", f"{entity_path(kind, ident)}/votes", timeout=30, params=page_params(limit, cursor))


class VoteBody(BaseModel):
    verdict: str

    @field_validator("verdict")
    @classmethod
    def valid_verdict(cls, v: str) -> str:
        if v not in ("harmless", "malicious"):
            raise ValueError("El voto debe ser harmless o malicious")
        return v


@app.post("/lookup/{kind}/{ident}/votes", dependencies=WRITE)
async def add_vote(kind: str, ident: str, body: VoteBody):
    require_writes()
    payload = {"data": {"type": "vote", "attributes": {"verdict": body.verdict}}}
    return await vt_request("POST", f"{entity_path(kind, ident)}/votes", timeout=30, json=payload)


@app.get("/search", dependencies=READ)
async def search(q: str = Query(..., min_length=1, max_length=500), limit: int = Query(20, ge=1, le=40), cursor: str | None = None):
    """Búsqueda libre: hashes, dominios, IPs, URLs y consultas avanzadas."""
    params = page_params(limit, cursor)
    params["query"] = q.strip()
    return await vt_request("GET", "/search", timeout=30, params=params)


# --- Endpoint raíz (sin auth, no expone nada) ---
@app.get("/")
def root():
    return {"service": "Scan4All API", "status": "ok"}
