#!/usr/bin/env bash
# ============================================================
# OpenClaw Phase Swap Manager
# Manages Ollama model loading for coding/reasoning phases
# ============================================================
# Usage:
#   ./phase-swap.sh coding     # Load Qwen 2.5 Coder 32B
#   ./phase-swap.sh reasoning   # Load Phi-4 14B
#   ./phase-swap.sh status      # Show current state
#   ./phase-swap.sh auto        # Auto-decide based on Convex queue
#   ./phase-swap.sh health      # Full health check
# ============================================================

set -euo pipefail

# ============================================================
# CONFIG
# ============================================================
OLLAMA_HOST="${OLLAMA_HOST:-http://localhost:11434}"
CONVEX_URL="${CONVEX_URL:-}"  # Your Convex deployment URL
CONVEX_DEPLOY_KEY="${CONVEX_DEPLOY_KEY:-}"

CODING_MODEL="qwen2.5-coder:32b"
REASONING_MODEL="phi4:14b"

# RAM thresholds (bytes)
RAM_TOTAL_GB=36
RAM_WARN_THRESHOLD=90   # percent
RAM_CRITICAL_THRESHOLD=95

# Swap timing
SWAP_COOLDOWN_SECONDS=60  # Minimum time between swaps
STATE_FILE="${HOME}/.openclaw-phase-state"
LOG_FILE="${HOME}/.openclaw-phase-swap.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================
# LOGGING
# ============================================================
log() {
    local level="$1"
    shift
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*"
    echo -e "$msg" >> "$LOG_FILE"
    case "$level" in
        ERROR)   echo -e "${RED}$msg${NC}" ;;
        WARN)    echo -e "${YELLOW}$msg${NC}" ;;
        OK)      echo -e "${GREEN}$msg${NC}" ;;
        INFO)    echo -e "${BLUE}$msg${NC}" ;;
        *)       echo "$msg" ;;
    esac
}

# ============================================================
# STATE MANAGEMENT
# ============================================================
get_state() {
    if [[ -f "$STATE_FILE" ]]; then
        cat "$STATE_FILE"
    else
        echo "unknown|0"
    fi
}

set_state() {
    local phase="$1"
    echo "${phase}|$(date +%s)" > "$STATE_FILE"
}

get_current_phase() {
    local state
    state=$(get_state)
    echo "$state" | cut -d'|' -f1
}

get_last_swap_time() {
    local state
    state=$(get_state)
    echo "$state" | cut -d'|' -f2
}

check_cooldown() {
    local last_swap
    last_swap=$(get_last_swap_time)
    local now
    now=$(date +%s)
    local elapsed=$((now - last_swap))

    if [[ $elapsed -lt $SWAP_COOLDOWN_SECONDS ]]; then
        local remaining=$((SWAP_COOLDOWN_SECONDS - elapsed))
        log WARN "Cooldown active. ${remaining}s remaining before next swap allowed."
        return 1
    fi
    return 0
}

# ============================================================
# OLLAMA OPERATIONS
# ============================================================
ollama_is_running() {
    curl -s --connect-timeout 3 "${OLLAMA_HOST}/api/tags" > /dev/null 2>&1
}

get_loaded_models() {
    # Returns currently loaded (in-memory) models
    curl -s "${OLLAMA_HOST}/api/ps" 2>/dev/null | \
        python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    models = data.get('models', [])
    for m in models:
        name = m.get('name', 'unknown')
        size_gb = m.get('size', 0) / (1024**3)
        print(f'{name}|{size_gb:.1f}GB')
except:
    pass
" 2>/dev/null || echo ""
}

get_available_models() {
    curl -s "${OLLAMA_HOST}/api/tags" 2>/dev/null | \
        python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    for m in data.get('models', []):
        name = m.get('name', 'unknown')
        size_gb = m.get('size', 0) / (1024**3)
        print(f'{name}|{size_gb:.1f}GB')
except:
    pass
" 2>/dev/null || echo ""
}

unload_model() {
    local model="$1"
    log INFO "Unloading model: $model"

    # Ollama unloads via setting keep_alive to 0
    local response
    response=$(curl -s -X POST "${OLLAMA_HOST}/api/generate" \
        -H "Content-Type: application/json" \
        -d "{\"model\": \"${model}\", \"keep_alive\": 0}" 2>&1)

    if [[ $? -eq 0 ]]; then
        log OK "Unloaded: $model"
    else
        log WARN "Unload may have failed for $model: $response"
    fi
}

unload_all_models() {
    local loaded
    loaded=$(get_loaded_models)

    if [[ -z "$loaded" ]]; then
        log INFO "No models currently loaded"
        return
    fi

    while IFS='|' read -r name size; do
        unload_model "$name"
    done <<< "$loaded"

    # Wait for memory to free
    sleep 3
}

preload_model() {
    local model="$1"
    log INFO "Preloading model: $model"

    # Send a minimal prompt to force model into memory
    local start_time
    start_time=$(date +%s)

    local response
    response=$(curl -s --max-time 300 -X POST "${OLLAMA_HOST}/api/generate" \
        -H "Content-Type: application/json" \
        -d "{
            \"model\": \"${model}\",
            \"prompt\": \"Hello\",
            \"stream\": false,
            \"options\": {\"num_predict\": 1}
        }" 2>&1)

    local end_time
    end_time=$(date +%s)
    local load_time=$((end_time - start_time))

    if echo "$response" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
        log OK "Loaded $model in ${load_time}s"
        return 0
    else
        log ERROR "Failed to load $model after ${load_time}s"
        log ERROR "Response: $response"
        return 1
    fi
}

# ============================================================
# RAM MONITORING
# ============================================================
get_ram_usage() {
    # macOS-specific memory check
    local mem_info
    mem_info=$(vm_stat 2>/dev/null)

    if [[ -n "$mem_info" ]]; then
        # Parse vm_stat output (macOS)
        local page_size
        page_size=$(sysctl -n hw.pagesize 2>/dev/null || echo 16384)

        local pages_free pages_active pages_inactive pages_speculative pages_wired
        pages_free=$(echo "$mem_info" | awk '/Pages free/ {gsub(/[^0-9]/,"",$3); print $3}')
        pages_active=$(echo "$mem_info" | awk '/Pages active/ {gsub(/[^0-9]/,"",$3); print $3}')
        pages_inactive=$(echo "$mem_info" | awk '/Pages inactive/ {gsub(/[^0-9]/,"",$3); print $3}')
        pages_speculative=$(echo "$mem_info" | awk '/Pages speculative/ {gsub(/[^0-9]/,"",$3); print $3}')
        pages_wired=$(echo "$mem_info" | awk '/Pages wired/ {gsub(/[^0-9]/,"",$4); print $4}')

        local total_bytes
        total_bytes=$(sysctl -n hw.memsize 2>/dev/null || echo $((RAM_TOTAL_GB * 1073741824)))

        local used_pages=$(( ${pages_active:-0} + ${pages_wired:-0} ))
        local total_pages=$((total_bytes / page_size))
        local percent=$((used_pages * 100 / total_pages))

        local used_gb
        used_gb=$(python3 -c "print(f'{$used_pages * $page_size / (1024**3):.1f}')")
        local total_gb
        total_gb=$(python3 -c "print(f'{$total_bytes / (1024**3):.1f}')")

        echo "${percent}|${used_gb}|${total_gb}"
    else
        # Fallback: try /proc/meminfo (Linux)
        if [[ -f /proc/meminfo ]]; then
            local total avail
            total=$(awk '/MemTotal/ {print $2}' /proc/meminfo)
            avail=$(awk '/MemAvailable/ {print $2}' /proc/meminfo)
            local used=$((total - avail))
            local percent=$((used * 100 / total))
            local used_gb
            used_gb=$(python3 -c "print(f'{$used / (1024**2):.1f}')")
            local total_gb
            total_gb=$(python3 -c "print(f'{$total / (1024**2):.1f}')")
            echo "${percent}|${used_gb}|${total_gb}"
        else
            echo "0|0|${RAM_TOTAL_GB}"
        fi
    fi
}

check_ram() {
    local ram_info
    ram_info=$(get_ram_usage)

    local percent used_gb total_gb
    percent=$(echo "$ram_info" | cut -d'|' -f1)
    used_gb=$(echo "$ram_info" | cut -d'|' -f2)
    total_gb=$(echo "$ram_info" | cut -d'|' -f3)

    if [[ $percent -ge $RAM_CRITICAL_THRESHOLD ]]; then
        log ERROR "RAM CRITICAL: ${percent}% used (${used_gb}GB / ${total_gb}GB)"
        return 2
    elif [[ $percent -ge $RAM_WARN_THRESHOLD ]]; then
        log WARN "RAM HIGH: ${percent}% used (${used_gb}GB / ${total_gb}GB)"
        return 1
    else
        log INFO "RAM OK: ${percent}% used (${used_gb}GB / ${total_gb}GB)"
        return 0
    fi
}

# ============================================================
# CONVEX INTEGRATION
# ============================================================
notify_convex_phase_change() {
    local phase="$1"

    if [[ -z "$CONVEX_URL" || -z "$CONVEX_DEPLOY_KEY" ]]; then
        log WARN "Convex not configured. Skipping phase notification."
        return
    fi

    # Call the swapPhase mutation via Convex HTTP API
    local response
    response=$(curl -s --max-time 10 -X POST \
        "${CONVEX_URL}/api/mutation" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${CONVEX_DEPLOY_KEY}" \
        -d "{
            \"path\": \"orchestrator:swapPhase\",
            \"args\": {\"targetPhase\": \"${phase}\"}
        }" 2>&1)

    if [[ $? -eq 0 ]]; then
        log OK "Convex notified: phase -> $phase"
        log INFO "Convex response: $response"
    else
        log WARN "Convex notification failed: $response"
    fi
}

query_convex_queue() {
    # Query Convex for queued task counts per phase
    if [[ -z "$CONVEX_URL" || -z "$CONVEX_DEPLOY_KEY" ]]; then
        echo "0|0"
        return
    fi

    local response
    response=$(curl -s --max-time 10 -X POST \
        "${CONVEX_URL}/api/query" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${CONVEX_DEPLOY_KEY}" \
        -d "{
            \"path\": \"orchestrator:getPhaseStatus\",
            \"args\": {}
        }" 2>&1)

    if [[ $? -eq 0 ]]; then
        local coding reasoning
        coding=$(echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('value', {}).get('queuedCoding', 0))
except:
    print(0)
" 2>/dev/null)
        reasoning=$(echo "$response" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(data.get('value', {}).get('queuedReasoning', 0))
except:
    print(0)
" 2>/dev/null)
        echo "${coding}|${reasoning}"
    else
        echo "0|0"
    fi
}

# ============================================================
# PHASE SWAP LOGIC
# ============================================================
swap_to_coding() {
    log INFO "=== SWAPPING TO CODING PHASE ==="
    log INFO "Target model: $CODING_MODEL"

    # 1. Check RAM before swap
    check_ram || true

    # 2. Unload all current models
    unload_all_models

    # 3. Check RAM after unload
    sleep 2
    check_ram || true

    # 4. Load coding model
    if preload_model "$CODING_MODEL"; then
        set_state "coding"
        notify_convex_phase_change "coding"
        log OK "=== CODING PHASE ACTIVE ==="
        log OK "Agents enabled: backend-dev, frontend-dev, auto-eng, devops"

        # 5. Verify
        verify_phase "coding"
    else
        log ERROR "Failed to load coding model. System in degraded state."
        set_state "error"
        return 1
    fi
}

swap_to_reasoning() {
    log INFO "=== SWAPPING TO REASONING PHASE ==="
    log INFO "Target model: $REASONING_MODEL"

    # 1. Check RAM
    check_ram || true

    # 2. Unload all
    unload_all_models

    # 3. Check RAM after unload
    sleep 2
    check_ram || true

    # 4. Load reasoning model
    if preload_model "$REASONING_MODEL"; then
        set_state "reasoning"
        notify_convex_phase_change "reasoning"
        log OK "=== REASONING PHASE ACTIVE ==="
        log OK "Agents enabled: qa, finance, dispatcher, fleet"

        # 5. Verify
        verify_phase "reasoning"
    else
        log ERROR "Failed to load reasoning model. System in degraded state."
        set_state "error"
        return 1
    fi
}

verify_phase() {
    local expected_phase="$1"
    local expected_model

    if [[ "$expected_phase" == "coding" ]]; then
        expected_model="$CODING_MODEL"
    else
        expected_model="$REASONING_MODEL"
    fi

    local loaded
    loaded=$(get_loaded_models)

    if echo "$loaded" | grep -q "$expected_model"; then
        log OK "Verification passed: $expected_model is loaded"
        check_ram || true
        return 0
    else
        log ERROR "Verification FAILED: $expected_model not found in loaded models"
        log ERROR "Currently loaded: $loaded"
        return 1
    fi
}

# ============================================================
# AUTO MODE
# ============================================================
auto_decide() {
    log INFO "=== AUTO PHASE DECISION ==="

    local current_phase
    current_phase=$(get_current_phase)
    log INFO "Current phase: $current_phase"

    # Query Convex for queue status
    local queue_info
    queue_info=$(query_convex_queue)
    local coding_queued reasoning_queued
    coding_queued=$(echo "$queue_info" | cut -d'|' -f1)
    reasoning_queued=$(echo "$queue_info" | cut -d'|' -f2)

    log INFO "Queued tasks - Coding: $coding_queued | Reasoning: $reasoning_queued"

    # Decision logic
    if [[ "$current_phase" == "coding" ]]; then
        if [[ $coding_queued -eq 0 && $reasoning_queued -gt 0 ]]; then
            log INFO "Decision: Swap to REASONING (coding queue empty, reasoning has work)"
            swap_to_reasoning
        else
            log INFO "Decision: STAY in coding (coding=$coding_queued, reasoning=$reasoning_queued)"
        fi
    elif [[ "$current_phase" == "reasoning" ]]; then
        if [[ $reasoning_queued -eq 0 && $coding_queued -gt 0 ]]; then
            log INFO "Decision: Swap to CODING (reasoning queue empty, coding has work)"
            swap_to_coding
        else
            log INFO "Decision: STAY in reasoning (coding=$coding_queued, reasoning=$reasoning_queued)"
        fi
    else
        # Unknown or error state - default to coding
        log WARN "Unknown phase state. Defaulting to coding."
        swap_to_coding
    fi
}

# ============================================================
# STATUS & HEALTH
# ============================================================
show_status() {
    echo ""
    echo "============================================"
    echo "  OpenClaw Phase Manager Status"
    echo "============================================"
    echo ""

    # Current phase
    local current_phase
    current_phase=$(get_current_phase)
    local last_swap
    last_swap=$(get_last_swap_time)
    local now
    now=$(date +%s)
    local elapsed=$((now - last_swap))

    echo "Phase:         $current_phase"
    echo "Last swap:     ${elapsed}s ago ($(date -r "$last_swap" '+%H:%M:%S' 2>/dev/null || echo 'unknown'))"
    echo ""

    # Ollama status
    if ollama_is_running; then
        echo -e "Ollama:        ${GREEN}Running${NC}"

        echo ""
        echo "Loaded models:"
        local loaded
        loaded=$(get_loaded_models)
        if [[ -n "$loaded" ]]; then
            while IFS='|' read -r name size; do
                echo "  - $name ($size)"
            done <<< "$loaded"
        else
            echo "  (none)"
        fi

        echo ""
        echo "Available models:"
        local available
        available=$(get_available_models)
        if [[ -n "$available" ]]; then
            while IFS='|' read -r name size; do
                echo "  - $name ($size)"
            done <<< "$available"
        fi
    else
        echo -e "Ollama:        ${RED}Not running${NC}"
    fi

    echo ""

    # RAM
    local ram_info
    ram_info=$(get_ram_usage)
    local percent used_gb total_gb
    percent=$(echo "$ram_info" | cut -d'|' -f1)
    used_gb=$(echo "$ram_info" | cut -d'|' -f2)
    total_gb=$(echo "$ram_info" | cut -d'|' -f3)

    local ram_color="$GREEN"
    [[ $percent -ge $RAM_WARN_THRESHOLD ]] && ram_color="$YELLOW"
    [[ $percent -ge $RAM_CRITICAL_THRESHOLD ]] && ram_color="$RED"

    echo -e "RAM:           ${ram_color}${percent}%${NC} (${used_gb}GB / ${total_gb}GB)"

    # Queue status (if Convex is configured)
    if [[ -n "$CONVEX_URL" ]]; then
        local queue_info
        queue_info=$(query_convex_queue)
        local coding_q reasoning_q
        coding_q=$(echo "$queue_info" | cut -d'|' -f1)
        reasoning_q=$(echo "$queue_info" | cut -d'|' -f2)
        echo ""
        echo "Task queue:"
        echo "  Coding:    $coding_q queued"
        echo "  Reasoning: $reasoning_q queued"
    fi

    echo ""
    echo "============================================"
}

health_check() {
    echo ""
    echo "============================================"
    echo "  OpenClaw System Health Check"
    echo "============================================"
    echo ""

    local issues=0

    # 1. Ollama
    echo -n "Ollama service:     "
    if ollama_is_running; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAIL - Ollama not responding at ${OLLAMA_HOST}${NC}"
        ((issues++))
    fi

    # 2. Models available
    echo -n "Coding model:       "
    local available
    available=$(get_available_models)
    if echo "$available" | grep -q "$CODING_MODEL"; then
        echo -e "${GREEN}OK${NC} ($CODING_MODEL available)"
    else
        echo -e "${RED}FAIL - $CODING_MODEL not pulled${NC}"
        echo "  Fix: ollama pull $CODING_MODEL"
        ((issues++))
    fi

    echo -n "Reasoning model:    "
    if echo "$available" | grep -q "$(echo $REASONING_MODEL | cut -d: -f1)"; then
        echo -e "${GREEN}OK${NC} ($REASONING_MODEL available)"
    else
        echo -e "${RED}FAIL - $REASONING_MODEL not pulled${NC}"
        echo "  Fix: ollama pull $REASONING_MODEL"
        ((issues++))
    fi

    # 3. RAM
    echo -n "RAM:                "
    local ram_info
    ram_info=$(get_ram_usage)
    local percent
    percent=$(echo "$ram_info" | cut -d'|' -f1)
    if [[ $percent -lt $RAM_WARN_THRESHOLD ]]; then
        echo -e "${GREEN}OK${NC} (${percent}% used)"
    elif [[ $percent -lt $RAM_CRITICAL_THRESHOLD ]]; then
        echo -e "${YELLOW}WARN${NC} (${percent}% used)"
        ((issues++))
    else
        echo -e "${RED}CRITICAL${NC} (${percent}% used)"
        ((issues++))
    fi

    # 4. LiteLLM proxy
    echo -n "LiteLLM proxy:      "
    if curl -s --connect-timeout 3 "http://localhost:4000/health" > /dev/null 2>&1; then
        echo -e "${GREEN}OK${NC}"
    else
        echo -e "${RED}FAIL - LiteLLM not responding on :4000${NC}"
        echo "  Fix: litellm --config litellm-config.yaml --port 4000"
        ((issues++))
    fi

    # 5. Convex
    echo -n "Convex backend:     "
    if [[ -n "$CONVEX_URL" ]]; then
        if curl -s --connect-timeout 5 "${CONVEX_URL}" > /dev/null 2>&1; then
            echo -e "${GREEN}OK${NC}"
        else
            echo -e "${RED}FAIL - Convex not responding${NC}"
            ((issues++))
        fi
    else
        echo -e "${YELLOW}NOT CONFIGURED${NC} (set CONVEX_URL)"
    fi

    # 6. State file
    echo -n "Phase state:        "
    if [[ -f "$STATE_FILE" ]]; then
        local current
        current=$(get_current_phase)
        echo -e "${GREEN}OK${NC} (phase: $current)"
    else
        echo -e "${YELLOW}INIT${NC} (no state file, will default to coding on first swap)"
    fi

    echo ""
    if [[ $issues -eq 0 ]]; then
        echo -e "${GREEN}All checks passed.${NC}"
    else
        echo -e "${RED}${issues} issue(s) found.${NC}"
    fi
    echo "============================================"

    return $issues
}

# ============================================================
# MAIN
# ============================================================
main() {
    local command="${1:-status}"

    # Ensure log file exists
    touch "$LOG_FILE"

    case "$command" in
        coding)
            if ! ollama_is_running; then
                log ERROR "Ollama is not running. Start it first: ollama serve"
                exit 1
            fi
            if ! check_cooldown; then
                exit 1
            fi
            swap_to_coding
            ;;

        reasoning)
            if ! ollama_is_running; then
                log ERROR "Ollama is not running. Start it first: ollama serve"
                exit 1
            fi
            if ! check_cooldown; then
                exit 1
            fi
            swap_to_reasoning
            ;;

        auto)
            if ! ollama_is_running; then
                log ERROR "Ollama is not running."
                exit 1
            fi
            if ! check_cooldown; then
                log INFO "Cooldown active, skipping auto-swap check."
                exit 0
            fi
            auto_decide
            ;;

        status)
            show_status
            ;;

        health)
            health_check
            ;;

        unload)
            unload_all_models
            ;;

        *)
            echo "Usage: $0 {coding|reasoning|auto|status|health|unload}"
            echo ""
            echo "Commands:"
            echo "  coding     Load Qwen 2.5 Coder 32B (coding phase)"
            echo "  reasoning  Load Phi-4 14B (reasoning phase)"
            echo "  auto       Auto-decide based on Convex task queue"
            echo "  status     Show current phase and system status"
            echo "  health     Full system health check"
            echo "  unload     Unload all models from memory"
            exit 1
            ;;
    esac
}

main "$@"
