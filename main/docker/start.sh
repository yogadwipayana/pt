#!/bin/bash
set -euo pipefail

cleanup() {
  if [[ -n "${NODE_PID:-}" ]] && kill -0 "$NODE_PID" 2>/dev/null; then
    kill "$NODE_PID"
  fi

  if [[ -n "${NGINX_PID:-}" ]] && kill -0 "$NGINX_PID" 2>/dev/null; then
    kill "$NGINX_PID"
  fi
}

trap cleanup EXIT
trap 'exit 143' INT TERM

node server.js &
NODE_PID=$!

nginx -g 'daemon off;' &
NGINX_PID=$!

wait -n "$NODE_PID" "$NGINX_PID"
