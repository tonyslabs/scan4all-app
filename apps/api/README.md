# Scan4All API

Proxy HTTP desarrollado con **FastAPI** para intermediar peticiones entre los clientes de Scan4All y la API v3 de **VirusTotal**. Su objetivo principal es centralizar y resguardar la clave privada de VirusTotal (`VT_API_KEY`), aplicar políticas de control de tasa (*rate limiting*) en memoria, validar entradas y limitar el tamaño de subida.

---

## Requisitos previos

- Python 3.10 o superior
- Clave de API de VirusTotal (v3)

---

## Instalación y ejecución

1. **Crear y activar el entorno virtual:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   # En Windows:
   # venv\Scripts\activate
   ```

2. **Instalar dependencias:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configurar variables de entorno:**
   Crear un archivo `.env` en la raíz de `apps/api/` con base en las variables descritas a continuación.

4. **Iniciar el servidor con Uvicorn:**
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8008
   ```
   *(Opcional para desarrollo: agregar la bandera `--reload`)*.

---

## Variables de entorno

Todas las variables se cargan desde el entorno o desde un archivo `.env` mediante `python-dotenv`:

| Variable | Requerida | Valor por defecto | Descripción |
|---|:---:|---|---|
| `VT_API_KEY` | **Sí** | *(Ninguno)* | Clave de acceso a la API v3 de VirusTotal. El servicio falla al iniciar si no está definida. |
| `API_TOKEN` | **Sí** | *(Ninguno)* | Secreto compartido para autenticar clientes mediante el header `X-API-Key`. Debe tener **al menos 16 caracteres**; de lo contrario, el servicio falla al iniciar. |
| `VT_BASE` | No | `https://www.virustotal.com/api/v3` | URL base del servicio de VirusTotal. |
| `MAX_UPLOAD_MB` | No | `650` | Tamaño máximo permitido para archivos en megabytes (MB). Hasta 32 MB se sube directo; por encima se usa una URL de subida de un solo uso, internamente. En producción se fija en `100` por el límite de Cloudflare (plan Free). |
| `RATE_SCAN_PER_MIN` | No | `10` | Límite de peticiones por minuto por IP para escaneos (`/scan/upload` y `/scan/url`). |
| `RATE_STATUS_PER_MIN` | No | `60` | Límite de peticiones por minuto por IP para consultar estado (`/scan/status/{analysis_id}`). |
| `RATE_LOOKUP_PER_MIN` | No | `60` | Límite de peticiones por minuto por IP para consultas (`/lookup/*`, `/search`). |
| `RATE_WRITE_PER_MIN` | No | `10` | Límite de peticiones por minuto por IP para operaciones de escritura (rescan, comentarios, votos). |
| `ALLOWED_ORIGINS` | No | `tauri://localhost,http://tauri.localhost,https://tauri.localhost,http://localhost:1420` | Lista de orígenes CORS permitidos, separados por comas. |
| `TRUST_PROXY` | No | `0` | Con `1`, el rate limit usa la cabecera `CF-Connecting-IP`. Activar solo si la API solo es alcanzable por el túnel o la tailnet. |
| `ALLOW_WRITES` | No | `1` | Con `0`, las peticiones `POST` de comentarios y votos responden `403`. |

### Ejemplo de archivo `.env`

```ini
VT_API_KEY=tu_virustotal_api_key_aqui
API_TOKEN=un_token_secreto_de_al_menos_16_caracteres
VT_BASE=https://www.virustotal.com/api/v3
MAX_UPLOAD_MB=650
RATE_SCAN_PER_MIN=10
RATE_STATUS_PER_MIN=60
RATE_LOOKUP_PER_MIN=60
RATE_WRITE_PER_MIN=10
ALLOWED_ORIGINS=tauri://localhost,http://tauri.localhost,https://tauri.localhost,http://localhost:1420
TRUST_PROXY=0
ALLOW_WRITES=1
```

---

## Autenticación

- Todos los endpoints bajo `/scan/*` requieren autenticación.
- El cliente debe incluir la cabecera HTTP:
  ```http
  X-API-Key: <API_TOKEN>
  ```
- La validación se realiza mediante comparación segura (`hmac.compare_digest`) para prevenir ataques de temporización.
- Si el encabezado falta o el token no coincide, se devuelve HTTP `401 Unauthorized`.
- El endpoint raíz (`GET /`) es público y no requiere autenticación.

---

## Límites y validaciones

- **Archivos:**
  - Tamaño máximo de 650 MB por defecto (ajustable con `MAX_UPLOAD_MB`; en producción se fija en 100 por el límite de Cloudflare Free).
  - Verificación anticipada de la cabecera `Content-Length`.
  - Validación de streaming por fragmentos en memoria; no se aceptan archivos vacíos (0 bytes).
- **URLs:**
  - Esquema restringido estrictamente a `http://` o `https://`.
  - Debe contener un dominio/host válido (`netloc`).
  - Longitud máxima permitida: 2048 caracteres.
- **Identificador de análisis (`analysis_id`):**
  - Debe coincidir con la expresión regular `^[A-Za-z0-9=_\-]{8,128}$`.
- **Control de tasa (*Rate Limiting*):**
  - Implementado en memoria por IP del cliente (`request.client.host`) con ventana deslizante de 60 segundos.
  - Cubo `scan`: controlado por `RATE_SCAN_PER_MIN` (por defecto 10 req/min).
  - Cubo `status`: controlado por `RATE_STATUS_PER_MIN` (por defecto 60 req/min).
  - Al exceder el límite, devuelve HTTP `429` e incluye el encabezado `Retry-After` con los segundos de espera requeridos.

---

## Endpoints

Todas las rutas requieren el header `X-API-Key` (a excepción del endpoint de salud `GET /`). Los comentarios y votos se publican con la cuenta de la clave del servidor (`VT_API_KEY`).

| Método | Ruta | Descripción | Bucket de rate limit |
|---|---|---|---|
| `POST` | `/scan/upload` | Sube un archivo para análisis (hasta 32 MB directo; por encima se usa una URL de subida de un solo uso, internamente) | `scan` |
| `POST` | `/scan/url` | Envía una URL para análisis | `scan` |
| `GET` | `/scan/status/{analysis_id}` | Consulta el estado de un análisis previo | `status` |
| `GET` | `/lookup/{kind}/{ident}` | Informe completo (`kind` = `file` \| `url` \| `domain` \| `ip`; `file` = hash MD5/SHA-1/SHA-256, `url` = id base64url sin relleno o SHA-256, `domain`, `ip`) | `lookup` |
| `POST` | `/lookup/{kind}/{ident}/rescan` | Solicita un nuevo análisis del recurso; devuelve el ID para consultar `/scan/status/{analysis_id}` | `write` |
| `GET` | `/lookup/{kind}/{ident}/relationships/{rel}` | Consulta objetos relacionados (`limit`, `cursor`) según la lista cerrada por tipo (`RELATIONSHIPS`) | `lookup` |
| `GET` | `/lookup/file/{ident}/behaviour` | Resumen de comportamiento en sandbox (puede no estar disponible con la cuenta del servidor) | `lookup` |
| `GET` | `/lookup/{kind}/{ident}/comments` | Lista comentarios asociados al recurso (`limit`, `cursor`) | `lookup` |
| `POST` | `/lookup/{kind}/{ident}/comments` | Publica un comentario en el recurso (`{"text": "..."}`) | `write` |
| `GET` | `/lookup/{kind}/{ident}/votes` | Lista votos asociados al recurso (`limit`, `cursor`) | `lookup` |
| `POST` | `/lookup/{kind}/{ident}/votes` | Envía un voto sobre el recurso (`verdict`: `harmless` \| `malicious`) | `write` |
| `GET` | `/search?q=` | Búsqueda libre: hashes, dominios, IPs, URLs y consultas avanzadas (`limit`, `cursor`) | `lookup` |

### Relaciones permitidas por tipo (`RELATIONSHIPS`)

- **`file`**: `contacted_domains`, `contacted_ips`, `contacted_urls`, `dropped_files`, `execution_parents`, `bundled_files`, `compressed_parents`, `itw_urls`, `itw_domains`, `itw_ips`, `similar_files`
- **`url`**: `contacted_domains`, `contacted_ips`, `downloaded_files`, `last_serving_ip_address`, `redirecting_urls`, `redirects_to`, `referrer_files`, `communicating_files`
- **`domain`**: `resolutions`, `subdomains`, `siblings`, `urls`, `communicating_files`, `downloaded_files`, `referrer_files`, `historical_ssl_certificates`
- **`ip`**: `resolutions`, `urls`, `communicating_files`, `downloaded_files`, `referrer_files`, `historical_ssl_certificates`

---

## Ejemplos de uso con `curl`

### 1. Comprobación de salud (Health check)
```bash
curl -X GET http://localhost:8008/
```

### 2. Subir un archivo para análisis
```bash
curl -X POST http://localhost:8008/scan/upload \
  -H "X-API-Key: tu_token_secreto_aqui" \
  -F "file=@/ruta/a/tu/archivo.pdf"
```

### 3. Enviar una URL para análisis
```bash
curl -X POST http://localhost:8008/scan/url \
  -H "X-API-Key: tu_token_secreto_aqui" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'
```

### 4. Consultar estado de un análisis
```bash
curl -X GET http://localhost:8008/scan/status/ZTI0YjA3... \
  -H "X-API-Key: tu_token_secreto_aqui"
```

---

## Formato de errores

Todas las respuestas de error (incluidos los errores de validación de esquema) mantienen una estructura JSON homogénea con mensaje de texto:

```json
{
  "detail": "Mensaje descriptivo del error"
}
```

### Códigos de estado HTTP

- **`400 Bad Request`:** Solicitud inválida (archivo vacío, `analysis_id` malformado o VirusTotal rechazó la petición).
- **`401 Unauthorized`:** Encabezado `X-API-Key` ausente o no coincide con `API_TOKEN`.
- **`404 Not Found`:** El análisis o recurso solicitado no existe en VirusTotal.
- **`413 Request Entity Too Large`:** El archivo enviado supera el límite establecido (`MAX_UPLOAD_MB`).
- **`422 Unprocessable Entity`:** Parámetros o cuerpo no superan las validaciones de esquema (ej. URL vacía, mayor a 2048 caracteres o con protocolo distinto a `http`/`https`).
- **`429 Too Many Requests`:** Límite de peticiones alcanzado localmente (incluye cabecera `Retry-After`) o cuota agotada en VirusTotal.
- **`502 Bad Gateway`:** Error al contactar a VirusTotal, clave de VirusTotal del servidor inválida/sin permisos, o respuesta inesperada del proveedor upstream.

---

## Tests

Desde `apps/api`:

```bash
pip install -r requirements-dev.txt
python -m pytest -q
```

---

## Despliegue en el homelab

La API se despliega en el homelab dentro del contenedor `scan4all-api`, cuya imagen se construye en el servidor a partir de `apps/api/Dockerfile`:

- **Carpeta:** `~/docker/apps/scan4all`.
- **Red Docker:** `core` (la red de `cloudflared`).
- **Puerto de prueba por tailnet:** `100.76.255.29:8101` (para verificar funcionamiento dentro de la tailnet).
- **Hostname público del túnel:** `scan4all.drskxll.io` -> `http://scan4all-api:8008` (se crea en el dashboard de Cloudflare).
- **Variables de producción:** El archivo `.env` (`VT_API_KEY`, `API_TOKEN`, con permisos `600`) vive solo en el homelab y se crea una vez a mano.
- **Comando de despliegue:** `./deploy/deploy.sh` (idempotente, requiere tener configurado el alias ssh `hl`).

---

## Consideraciones de seguridad

- **Naturaleza del `API_TOKEN`:** El token no es un secreto criptográfico fuerte si se distribuye o incrusta en binarios de clientes públicos (aplicaciones de escritorio, móviles o frontends web), ya que puede ser extraído mediante ingeniería inversa o inspección de tráfico.
- **Entorno de red:** Este servicio está pensado para ejecutarse dentro de una red local confiable (LAN) o a través de una red privada mallada como **Tailscale** / WireGuard.
- **No exponer a internet abierto sin capas adicionales:** No debe exponerse directamente a internet público sin mecanismos de protección complementarios (reverse proxy con HTTPS, autenticación de usuarios individuales por sesión/OAuth, firewall o WAF).
