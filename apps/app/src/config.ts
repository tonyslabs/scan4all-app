// URL de la API (apps/api). Se cambia con VITE_API_URL en apps/app/.env
// En Android (emulador) apunta al host con http://10.0.2.2:8008; en dispositivo físico, a la IP de la PC.
export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8008";
