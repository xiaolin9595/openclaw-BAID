#!/bin/sh
# Sandbox entrypoint script
# Changes to workspace directory and executes the provided command

cd /workspace || exit 1
exec "$@"
