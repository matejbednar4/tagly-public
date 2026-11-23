#!/bin/sh
set -e

echo "Starting worker: ${WORKER}"

case "$WORKER" in
  cleanup)       exec node dist/workers/cleanup/run.js ;;
  maintenance)   exec node dist/workers/maintenance/run.js ;;
  notifications) exec node dist/workers/notifications/run.js ;;
  igInsights)    exec node dist/workers/igInsights/run.js ;;
  igSnapshots)   exec node dist/workers/igSnapshot/run.js ;;
  stripe)        exec node dist/workers/stripe/run.js ;;
  sharePayment)  exec node dist/workers/sharePayment/run.js ;;
  *) echo "Unknown WORKER='$WORKER'"; exit 2 ;;
esac