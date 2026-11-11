import Constants from "expo-constants";

// Puerto de la API (apps/api). Se levanta con: uvicorn main:app --host 0.0.0.0 --port 8008
const API_PORT = 8008;

// Orden de prioridad:
// 1. EXPO_PUBLIC_API_URL (ej. en apps/mobile/.env o en el build de EAS)
// 2. Host del dev server de Expo: es la IP de la PC, sirve para teléfono físico y emulador
// 3. Emulador Android sin dev server: 10.0.2.2
const devHost = Constants.expoConfig?.hostUri?.split(":")[0];

export const BASE_URL: string =
  process.env.EXPO_PUBLIC_API_URL ??
  (devHost ? `http://${devHost}:${API_PORT}` : `http://10.0.2.2:${API_PORT}`);
