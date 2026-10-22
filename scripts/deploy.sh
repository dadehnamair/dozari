#!/usr/bin/env bash
# Production deploy. Run from anywhere on the server:
#   scripts/deploy.sh                # build + start the stack (migrate and seed stay off)
#   scripts/deploy.sh setup          # apply DB migrations first, then deploy
#   scripts/deploy.sh seed           # run the seed first, then deploy
#   scripts/deploy.sh setup seed     # migrations, then seed, then deploy
# Env file: .env (override with ENV_FILE=...). Details: docs/deploy.md
# After the stack is up, leftovers from the build (dangling images, build cache older than PRUNE_KEEP) are removed; PRUNE=0 skips it.
set -euo pipefail

cd "$(dirname "$0")/.."
ENV_FILE="${ENV_FILE:-.env}"
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE (cp .env.example $ENV_FILE and edit it)" >&2; exit 1; }
dc=(docker compose --env-file "$ENV_FILE")

do_setup=0
do_seed=0
for step in "$@"; do
  case "$step" in
    setup) do_setup=1 ;;
    seed) do_seed=1 ;;
    *) echo "usage: scripts/deploy.sh [setup] [seed]" >&2; exit 1 ;;
  esac
done

if [ "$do_setup" = 1 ] || [ "$do_seed" = 1 ]; then
  "${dc[@]}" up -d --wait s-dozari-mysql
fi
if [ "$do_setup" = 1 ]; then
  echo "==> migrate"
  "${dc[@]}" --profile setup run --rm --build s-dozari-migrate
fi
if [ "$do_seed" = 1 ]; then
  echo "==> seed (SEED_ON_START from $ENV_FILE: empty|1|0)"
  "${dc[@]}" --profile setup run --rm s-dozari-seed
fi

echo "==> up"
"${dc[@]}" up -d --build
"${dc[@]}" ps

if [ "${PRUNE:-1}" = 1 ]; then
  echo "==> cleanup"
  docker image prune -f
  # Recent cache stays so the next deploy still reuses the pnpm store and dependency layers.
  docker builder prune -f --filter "until=${PRUNE_KEEP:-72h}"
fi
