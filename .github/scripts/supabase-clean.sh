#!/usr/bin/env bash
# Removes every local Supabase stack on the CI runner (containers, volumes, networks) and anything
# else still holding the local stack's ports (54320-54329), then waits until those ports are free.
# Used by database.yml before `supabase start` and between start attempts. CI only: it force-removes
# containers and kills processes, so never run it on a machine with a stack you want to keep.
set -uo pipefail

PORTS=$(seq 54320 54329)

echo "Stopping any Supabase stacks the CLI knows about"
supabase stop --all --no-backup || true

echo "Removing leftover Supabase containers, volumes and networks"
docker ps -aq --filter 'label=com.supabase.cli.project' | xargs -r docker rm -f
docker ps -aq --filter 'name=^supabase_' | xargs -r docker rm -f
for port in $PORTS; do
  docker ps -aq --filter "publish=$port" | xargs -r docker rm -f
done
docker volume ls -q --filter 'label=com.supabase.cli.project' | xargs -r docker volume rm -f
docker network ls -q --filter 'label=com.supabase.cli.project' | xargs -r docker network rm

echo "Killing non-Docker processes on the stack's ports"
for port in $PORTS; do
  sudo fuser -k -n tcp "$port" 2>/dev/null || true
done

port_busy() { sudo ss -Hltn "( sport >= :54320 and sport <= :54329 )" | grep -q .; }
for _ in $(seq 1 30); do
  port_busy || { echo "Ports 54320-54329 are free"; exit 0; }
  sleep 1
done
echo "::error title=supabase cleanup::ports still in use after cleanup"
sudo ss -ltnp "( sport >= :54320 and sport <= :54329 )" || true
docker ps -a || true
exit 1
