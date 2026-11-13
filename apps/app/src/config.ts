// Dirección de la API (apps/api). Valor de fábrica: VITE_API_URL en apps/app/.env al compilar.
// La persona puede cambiarla en Ajustes sin recompilar (útil en Android y Windows, donde "localhost" no sirve).
// En Android, la versión de producción exige HTTPS salvo para localhost.
const BUILD_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8008";
const KEY = "scan4all.server";

export const DEFAULT_API_URL = BUILD_URL;
export const API_TOKEN = import.meta.env.VITE_API_TOKEN ?? "";

export function getApiUrl(): string {
  try { return localStorage.getItem(KEY) || BUILD_URL; } catch { return BUILD_URL; }
}
/** `null` restablece el valor de fábrica. Devuelve false si la URL no es http(s) válida. */
export function setApiUrl(value: string | null): boolean {
  try {
    if (value === null || value.trim() === "") { localStorage.removeItem(KEY); return true; }
    const parsed = new URL(value.trim());
    if (!["http:", "https:"].includes(parsed.protocol) || !parsed.hostname) return false;
    localStorage.setItem(KEY, parsed.origin + parsed.pathname.replace(/\/$/, ""));
    return true;
  } catch { return false; }
}

// Tope de subida: el túnel de Cloudflare (plan Free) acepta 100 MB por petición. Debe coincidir con MAX_UPLOAD_MB de la API.
export const MAX_UPLOAD_MB = 100;
