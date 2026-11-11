# scan4all

Monorepo: app móvil (Expo/React Native) y API proxy hacia VirusTotal.

```
apps/
  mobile/   App Expo (SDK 54), TypeScript
  api/      FastAPI, proxy a VirusTotal
```

## Mobile
```bash
pnpm install
pnpm mobile        # expo start
pnpm android
pnpm typecheck
```
Builds con EAS: correr `eas build` desde `apps/mobile` (ahí vive `eas.json`).

## API
```bash
cd apps/api
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
echo "VT_API_KEY=..." > .env
uvicorn main:app --host 127.0.0.1 --port 8000   # o `pnpm api` desde la raíz
```

Más detalle en `apps/mobile/README.md` y `apps/api/README.md`.
