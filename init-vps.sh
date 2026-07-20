#!/bin/bash
set -euo pipefail

cat <<'MSG'
init-vps.sh no longer stores VPS credentials or resets production data.

Use the GitHub Actions Deploy VPS workflow for normal deploys:
  gh workflow run deploy-vps.yml --repo devabalacom/ai

For emergency server administration, use an SSH key from your local operator
environment and run explicit commands manually.
MSG
