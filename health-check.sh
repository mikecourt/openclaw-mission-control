#!/bin/bash
# Control Tower Health Check
# Checks: Vite server, Convex deployment, GitHub updates

REPORT=""
ISSUES=0

# 1. Check Vite dev server
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3002 | grep -q "200"; then
    REPORT="$REPORT\n✅ Vite server: running on :3002"
else
    REPORT="$REPORT\n❌ Vite server: DOWN on :3002"
    ISSUES=$((ISSUES + 1))
    
    # Try to restart it
    cd /Users/aidenhdee/.openclaw/workspace/projects/mission-control-convex
    nohup npx vite --port 3002 --host 0.0.0.0 > /tmp/mc-vite.log 2>&1 &
    REPORT="$REPORT\n🔄 Attempting restart..."
fi

# 2. Check Convex deployment
CONVEX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://qualified-sheep-733.convex.cloud")
if [ "$CONVEX_STATUS" = "200" ] || [ "$CONVEX_STATUS" = "404" ]; then
    REPORT="$REPORT\n✅ Convex backend: reachable (qualified-sheep-733)"
else
    REPORT="$REPORT\n❌ Convex backend: unreachable (HTTP $CONVEX_STATUS)"
    ISSUES=$((ISSUES + 1))
fi

# 3. Check for GitHub updates
cd /Users/aidenhdee/.openclaw/workspace/projects/mission-control-convex
git fetch origin 2>/dev/null
LOCAL=$(git rev-parse HEAD 2>/dev/null)
REMOTE=$(git rev-parse origin/main 2>/dev/null || git rev-parse origin/master 2>/dev/null)

if [ -n "$LOCAL" ] && [ -n "$REMOTE" ]; then
    if [ "$LOCAL" = "$REMOTE" ]; then
        REPORT="$REPORT\n✅ GitHub: up to date"
    else
        BEHIND=$(git rev-list --count HEAD..origin/main 2>/dev/null || git rev-list --count HEAD..origin/master 2>/dev/null)
        REPORT="$REPORT\n🔔 GitHub: $BEHIND new commits available"
        
        # Show what changed
        CHANGES=$(git log --oneline HEAD..origin/main 2>/dev/null || git log --oneline HEAD..origin/master 2>/dev/null)
        if [ -n "$CHANGES" ]; then
            REPORT="$REPORT\n   Recent changes:\n$(echo "$CHANGES" | head -5 | sed 's/^/   /')"
        fi
    fi
else
    REPORT="$REPORT\n⚠️ GitHub: couldn't check (git issue)"
fi

# 4. Check hook status
HOOK_STATUS=$(openclaw hooks list 2>&1 | grep "mission-control")
if echo "$HOOK_STATUS" | grep -q "ready"; then
    REPORT="$REPORT\n✅ MC hook: enabled and ready"
else
    REPORT="$REPORT\n❌ MC hook: not ready"
    ISSUES=$((ISSUES + 1))
fi

# Output
echo -e "🏗️ Control Tower Health Report"
echo -e "================================"
echo -e "$REPORT"
echo ""
if [ $ISSUES -gt 0 ]; then
    echo "⚠️ $ISSUES issue(s) found"
else
    echo "✅ All systems nominal"
fi
