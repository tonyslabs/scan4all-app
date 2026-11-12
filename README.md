# scan4all

Escáner de archivos y URLs con VirusTotal. Una sola base de código para **Linux, Windows y Android**.

## Stack
- **Cliente:** [Tauri 2](https://tauri.app) + React + Vite + TypeScript (`apps/app`). Un mismo frontend, empaquetado como app de escritorio (Linux/Windows) y Android.
- **API:** FastAPI, proxy a VirusTotal (`apps/api`). La clave de VirusTotal vive solo aquí, nunca en el cliente.
- **Monorepo:** pnpm workspaces.

```
apps/
  app/              Cliente Tauri (src/ = React, src-tauri/ = Rust)
  api/              FastAPI
  mobile-legacy/    App Expo original, solo como referencia mientras se porta (se borra después)
```

## Requisitos (Linux)
```bash
sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev patchelf
```
Además: Rust (rustup), Node, pnpm. Para Android: JDK 17+, Android SDK/NDK (`ANDROID_HOME`, `NDK_HOME`) y
`rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android`.

## Desarrollo
```bash
pnpm install
pnpm api            # API en :8008 (necesita apps/api/.env con VT_API_KEY)
pnpm dev            # app de escritorio (tauri dev)
pnpm dev:web        # solo el frontend en el navegador (vite, :1420)
pnpm typecheck
```
La URL de la API se configura con `VITE_API_URL` (por defecto `http://localhost:8008`).

## Builds
```bash
pnpm build                          # Linux: .deb / .rpm / AppImage en apps/app/src-tauri/target/release/bundle
pnpm android:init                   # una sola vez
pnpm android:dev                    # correr en un dispositivo/emulador
pnpm android:build --apk
```
**Windows** no se compila de forma fiable desde Linux: se construye en CI (`.github/workflows/build.yml`, runner `windows-latest`) o en una PC Windows. El workflow genera también Linux y Android y se dispara a mano o con un tag `v*`.

## API
```bash
cd apps/api
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
echo "VT_API_KEY=..." > .env
uvicorn main:app --host 0.0.0.0 --port 8008
```
Más detalle en `apps/api/README.md`.
