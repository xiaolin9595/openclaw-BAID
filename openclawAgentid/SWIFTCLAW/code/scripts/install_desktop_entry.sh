#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DEST_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
DEST_FILE="${DEST_DIR}/SwiftClaw.desktop"
RUN_SCRIPT="${PROJECT_DIR}/scripts/start_visible_desktop.sh"

mkdir -p "${DEST_DIR}"

cat > "${DEST_FILE}" <<EOF
[Desktop Entry]
Type=Application
Name=SwiftClaw
Comment=Run SwiftClaw Telegram bot in a desktop session
Exec=${RUN_SCRIPT}
Path=${PROJECT_DIR}
Terminal=true
Categories=Network;Chat;
EOF

chmod 644 "${DEST_FILE}"

echo "Installed desktop entry to: ${DEST_FILE}"
echo "Launch it from your desktop app menu or run: ${RUN_SCRIPT}"
