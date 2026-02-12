#!/usr/bin/env bash
# ============================================================
# OpenClaw Stack Launcher
# Starts all services in correct order
# ============================================================
# Usage:
#   ./start-openclaw.sh          # Start everything
#   ./start-openclaw.sh stop     # Stop everything
#   ./start-openclaw.sh restart  # Restart
# ============================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OPENCLAW_DIR="${HOME}/.openclaw"
PID_DIR="${OPENCLAW_DIR}/pids"

# Source environment
if [[ -f "${SCRIPT_DIR}/.env" ]]; then
    set -a
    source "${SCRIPT_DIR}/.env"
    set +a
else
    echo "ERROR: .env file not found. Copy env.template to .env and fill in keys."
    exit 1
fi

mkdir -p "$OPENCLAW_DIR" "$PID_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ============================================================
# SERVICE MANAGEMENT
# ============================================================
start_ollama() {
    echo -n "Starting Ollama... "
    if pgrep -x "ollama" > /dev/null 2>&1; then
        echo -e "${YELLOW}already running${NC}"
    else
        ollama serve > "${OPENCLAW_DIR}/ollama.log" 2>&1 &
        echo $! > "${PID_DIR}/ollama.pid"
        sleep 3

        if curl -s --connect-timeout 3 "${OLLAMA_HOST}/api/tags" > /dev/null 2>&1; then
            echo -e "${GREEN}OK${NC}"
        else
            echo -e "${RED}FAILED${NC} (check ${OPENCLAW_DIR}/ollama.log)"
            return 1
        fi
    fi
}

start_litellm() {
    echo -n "Starting LiteLLM proxy... "

    if curl -s --connect-timeout 3 "http://localhost:4000/health" > /dev/null 2>&1; then
        echo -e "${YELLOW}already running${NC}"
        return 0
    fi

    litellm \
        --config "${SCRIPT_DIR}/litellm-config.yaml" \
        --port 4000 \
        --detailed_debug \
        > "${OPENCLAW_DIR}/litellm.log" 2>&1 &
    echo $! > "${PID_DIR}/litellm.pid"

    # Wait for startup
    local retries=15
    while [[ $retries -gt 0 ]]; do
        if curl -s --connect-timeout 2 "http://localhost:4000/health" > /dev/null 2>&1; then
            echo -e "${GREEN}OK${NC} (http://localhost:4000)"
            return 0
        fi
        sleep 2
        ((retries--))
    done

    echo -e "${RED}FAILED${NC} (check ${OPENCLAW_DIR}/litellm.log)"
    return 1
}

load_default_model() {
    echo -n "Loading default model (coding phase)... "
    bash "${SCRIPT_DIR}/phase-swap.sh" coding
}

start_phase_scheduler() {
    echo -n "Starting phase auto-scheduler (every 30s)... "

    # Background loop that checks queue and auto-swaps
    (
        while true; do
            bash "${SCRIPT_DIR}/phase-swap.sh" auto >> "${OPENCLAW_DIR}/scheduler.log" 2>&1
            sleep 30
        done
    ) &
    echo $! > "${PID_DIR}/scheduler.pid"
    echo -e "${GREEN}OK${NC} (PID: $(cat "${PID_DIR}/scheduler.pid"))"
}

# ============================================================
# STOP
# ============================================================
stop_all() {
    echo "Stopping OpenClaw stack..."

    for pidfile in "${PID_DIR}"/*.pid; do
        if [[ -f "$pidfile" ]]; then
            local name
            name=$(basename "$pidfile" .pid)
            local pid
            pid=$(cat "$pidfile")

            echo -n "  Stopping ${name} (PID: ${pid})... "
            if kill "$pid" 2>/dev/null; then
                # Wait up to 5s for graceful shutdown
                local wait=5
                while [[ $wait -gt 0 ]] && kill -0 "$pid" 2>/dev/null; do
                    sleep 1
                    ((wait--))
                done

                if kill -0 "$pid" 2>/dev/null; then
                    kill -9 "$pid" 2>/dev/null || true
                    echo -e "${YELLOW}force killed${NC}"
                else
                    echo -e "${GREEN}stopped${NC}"
                fi
            else
                echo -e "${YELLOW}already stopped${NC}"
            fi
            rm -f "$pidfile"
        fi
    done

    # Unload Ollama models to free RAM
    echo -n "  Unloading models... "
    bash "${SCRIPT_DIR}/phase-swap.sh" unload 2>/dev/null || true
    echo -e "${GREEN}done${NC}"

    echo "OpenClaw stack stopped."
}

# ============================================================
# MAIN
# ============================================================
case "${1:-start}" in
    start)
        echo "============================================"
        echo "  Starting OpenClaw Stack"
        echo "============================================"
        echo ""

        start_ollama
        start_litellm
        load_default_model
        start_phase_scheduler

        echo ""
        echo "============================================"
        echo -e "  ${GREEN}OpenClaw is running${NC}"
        echo ""
        echo "  LiteLLM proxy:  http://localhost:4000"
        echo "  Ollama:         ${OLLAMA_HOST}"
        echo "  Logs:           ${OPENCLAW_DIR}/"
        echo "  Phase control:  ./phase-swap.sh {coding|reasoning|auto|status}"
        echo "  Health check:   ./phase-swap.sh health"
        echo "============================================"
        ;;

    stop)
        stop_all
        ;;

    restart)
        stop_all
        sleep 2
        exec "$0" start
        ;;

    *)
        echo "Usage: $0 {start|stop|restart}"
        exit 1
        ;;
esac
