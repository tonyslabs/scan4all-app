#!/usr/bin/env bash
# Despliega la API en el homelab (alias ssh "hl"). Idempotente: se puede correr las veces que haga falta.
# El .env de producción NO viaja desde aquí: se crea una sola vez en el homelab (ver README).
set -euo pipefail
cd "$(dirname "$0")/.."
DEST='~/docker/apps/scan4all'
ssh hl "mkdir -p $DEST"
tar czf - Dockerfile .dockerignore requirements.txt main.py | ssh hl "tar xzf - -C $DEST"
scp -q deploy/docker-compose.yml "hl:$DEST/docker-compose.yml"
ssh hl "cd $DEST && test -f .env && docker compose up -d --build && docker image prune -f >/dev/null"
echo "Listo: http://100.76.255.29:8101/"
