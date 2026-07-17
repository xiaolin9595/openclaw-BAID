#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if [[ -z "${DISPLAY:-}" && -z "${WAYLAND_DISPLAY:-}" ]]; then
  echo "SwiftClaw desktop mode requires a graphical session." >&2
  echo "Start this script from a desktop terminal with DISPLAY or WAYLAND_DISPLAY set." >&2
  exit 1
fi

cd "${PROJECT_DIR}"

if [[ -f ".venv/bin/activate" ]]; then
  # shellcheck disable=SC1091
  source ".venv/bin/activate"
fi

export BROWSER_HEADLESS=false

if [[ -z "${BROWSER_CHANNEL:-}" ]]; then
  export BROWSER_CHANNEL=""
fi

if [[ -z "${BROWSER_EXECUTABLE_PATH:-}" ]]; then
  for candidate in google-chrome chromium chromium-browser msedge microsoft-edge; do
    if command -v "${candidate}" >/dev/null 2>&1; then
      export BROWSER_EXECUTABLE_PATH="$(command -v "${candidate}")"
      break
    fi
  done
fi

exec python main.py
