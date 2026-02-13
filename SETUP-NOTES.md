# Control Tower (Convex-based) - Setup Notes

## Installation Summary

**Date:** 2026-02-09  
**Location:** `/Users/aidenhdee/.openclaw/shared/projects/control-tower-convex`
**Repository:** https://github.com/manish-raana/openclaw-mission-control  
**Author:** manish-raana

---

## ✅ Installation Steps Completed

### 1. Repository Cloned
```bash
git clone https://github.com/manish-raana/openclaw-mission-control.git \
  /Users/aidenhdee/.openclaw/shared/projects/control-tower-convex
```

### 2. Dependencies Installed
```bash
cd /Users/aidenhdee/.openclaw/shared/projects/control-tower-convex
npm install
```

**Note:** Project originally uses `bun` but installed with `npm` as requested. `lucia@3.2.2` deprecation warning present (for auth library).

### 3. Convex Backend Deployed

Created a **new, separate** Convex deployment:

- **Project Name:** `mission-control-convex`
- **Team:** `mikecourt`
- **Deployment:** `dev:qualified-sheep-733`
- **Dashboard:** https://dashboard.convex.dev/t/mikecourt/mission-control-convex
- **Deployment URL:** https://dashboard.convex.dev/d/qualified-sheep-733

Environment variables auto-generated in `.env.local`:
```
CONVEX_DEPLOYMENT=dev:qualified-sheep-733
VITE_CONVEX_URL=https://qualified-sheep-733.convex.cloud
VITE_CONVEX_SITE_URL=https://qualified-sheep-733.convex.site
```

**Tables & Indexes Created:**
- `activities` (by_tenant, by_tenant_target)
- `agents` (by_tenant)
- `apiTokens` (by_tenant, by_tokenHash)
- `authAccounts` (providerAndAccountId, userIdAndProvider)
- `authRateLimits` (identifier)
- `authRefreshTokens` (sessionId, sessionIdAndParentRefreshTokenId)
- `authSessions` (userId)
- `authVerificationCodes` (accountId, code)
- `authVerifiers` (signature)
- `documents` (by_tenant, by_tenant_task)
- `messages` (by_tenant, by_tenant_task)
- `rateLimits` (by_tenant)
- `tasks` (by_tenant)
- `tenantSettings` (by_tenant)
- `users` (email, phone)

### 4. Seed Data Populated

```bash
npx convex run seed:run
```

Populated with:
- **11 agents:** Manish (LEAD), Friday (Developer), Fury (Customer Researcher), Jarvis (Squad Lead), Loki (Content Writer), Pepper (Email Marketing), Quill (Social Media), Shuri (Product Analyst), Vision (SEO Analyst), Wanda (Designer), Wong (Documentation)
- **4 sample tasks:** SiteName Dashboard docs, Product demo script, Zendesk comparison, Shopify landing page
- **3 initial activities/comments**

Each agent has detailed `systemPrompt`, `character`, and `lore` attributes — designed for AI persona simulation.

### 5. Frontend Started

```bash
npx vite --port 3002 --host 0.0.0.0
```

**Access URLs:**
- Local: http://localhost:3002
- Network: http://192.168.4.63:3002 (Mac Studio LAN)
- Network: http://192.168.4.31:3002
- Tailscale: http://100.114.112.107:3002

**Port 3002** chosen to avoid conflict with the crshdn version running on port 3001.

**Status:** ✅ Accessible and running

---

## 🔗 OpenClaw Hooks Integration

### Hook Handler Location

The project includes a comprehensive hook handler at:
```
/Users/aidenhdee/.openclaw/shared/projects/control-tower-convex/hooks/control-tower/handler.ts
```

### What the Hook Does

**Event Tracking:**
1. **Lifecycle Events:**
   - `start` → Creates new task with user prompt as title
   - `end` → Marks task complete, captures agent response
   - `error` → Moves task to "Review" with error details

2. **Progress Updates:**
   - Tool usage (e.g., "🔧 Using tool: web_search")
   - Thinking events ("💭 Thinking...")

3. **Document Capture:**
   - Automatically captures files created with the `write` tool
   - Detects media files from `exec` output (images, audio, etc.)
   - Associates documents with the task

4. **Smart Filtering:**
   - Skips heartbeat runs (doesn't create tasks for background checks)
   - Distinguishes user-initiated runs from system follow-ups
   - Links follow-up runs to the original task

5. **Source Detection:**
   - Extracts message source (Telegram, Discord, Webchat, etc.)
   - Cleans metadata from prompts
   - Displays source prefix in task title

### Webhook Endpoint

The Convex backend exposes:
```
POST https://qualified-sheep-733.convex.site/openclaw/event
```

**Payload Format:**
```json
{
  "runId": "unique-run-id",
  "action": "start" | "end" | "error" | "progress" | "document",
  "sessionKey": "session-key",
  "prompt": "user prompt text",
  "source": "Telegram",
  "response": "agent response",
  "error": "error message",
  "message": "progress message",
  "document": {
    "title": "filename.ext",
    "content": "file content or path",
    "type": "markdown" | "code" | "image" | "note",
    "path": "/full/path/to/file"
  }
}
```

### Installation Steps

#### Option 1: Copy Hook to OpenClaw Hooks Directory

```bash
# Copy the hook handler
mkdir -p ~/.openclaw/hooks/control-tower
cp /Users/aidenhdee/.openclaw/shared/projects/control-tower-convex/hooks/control-tower/handler.ts \
   ~/.openclaw/hooks/control-tower/handler.ts
```

#### Option 2: Symlink (Easier for Development)

```bash
# Symlink for automatic updates when handler.ts changes
mkdir -p ~/.openclaw/hooks
ln -s /Users/aidenhdee/.openclaw/shared/projects/control-tower-convex/hooks/control-tower \
      ~/.openclaw/hooks/control-tower
```

#### Configure OpenClaw

Add to `~/.openclaw/config.jsonc`:

```jsonc
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "control-tower": {
          "enabled": true,
          "env": {
            "MISSION_CONTROL_URL": "https://qualified-sheep-733.convex.site/openclaw/event"
          }
        }
      }
    }
  }
}
```

Or set as environment variable:
```bash
export MISSION_CONTROL_URL="https://qualified-sheep-733.convex.site/openclaw/event"
```

#### Restart OpenClaw Gateway

```bash
openclaw gateway restart
```

### Verification

After setup, all agent runs will automatically:
- Appear as tasks in Control Tower at http://localhost:3002
- Show real-time progress updates as comments
- Capture created documents as resources
- Track duration and completion status

---

## 🔐 Authentication

**Method:** Convex Auth (secure terminal login)

**First-Time Setup:**
1. Open http://localhost:3002
2. Click **Sign Up** to create commander credentials
3. Use email/password or configured OAuth providers

**Note:** Multi-tenancy is built-in via `tenantId` field on all tables. Default tenant is `"default"`.

---

## 📊 Comparison: Convex Version vs crshdn Version

### Architecture

| Aspect | **Convex Version** (manish-raana) | **crshdn Version** |
|--------|-----------------------------------|---------------------|
| **Backend** | Convex (serverless, real-time) | Local Node.js server |
| **Database** | Convex Cloud | JSON files (local FS) |
| **Sync** | Real-time via WebSocket | Polling or manual refresh |
| **Deployment** | Cloud-hosted (Convex) | Self-hosted (localhost) |
| **Port** | 3002 | 3001 |
| **Location** | `projects/control-tower-convex` | `projects/mission-control-app` |

### Features

| Feature | **Convex Version** | **crshdn Version** |
|---------|-------------------|---------------------|
| **Real-time Updates** | ✅ Native (WebSocket) | ❓ TBD |
| **OpenClaw Hooks** | ✅ Comprehensive (lifecycle + tools) | ❓ TBD |
| **Document Capture** | ✅ Automatic (write/exec tools) | ❓ TBD |
| **Agent Personas** | ✅ Rich (systemPrompt, character, lore) | ❓ TBD |
| **Multi-tenancy** | ✅ Built-in | ❓ TBD |
| **Authentication** | ✅ Convex Auth | ❓ TBD |
| **Kanban Board** | ✅ Drag-and-drop (dnd-kit) | ❓ TBD |
| **Comments/Activity** | ✅ Real-time feed | ❓ TBD |
| **Task Assignment** | ✅ Multi-agent | ❓ TBD |
| **API Tokens** | ✅ Built-in | ❓ TBD |

### Data Models

**Convex Version** has richer schema:
- **Agents:** name, role, level (LEAD/INT/SPC), status, avatar, systemPrompt, character, lore, tenantId
- **Tasks:** title, description, status (inbox/assigned/in_progress/review/done), assigneeIds, tags, borderColor, openclawRunId, tenantId
- **Documents:** taskId, title, content, type, path, agentId, tenantId
- **Messages:** taskId, agentId, content, tenantId
- **Activities:** type, agentId, targetId, message, tenantId

**crshdn Version:** TBD (needs inspection)

### UI/UX

| Aspect | **Convex Version** | **crshdn Version** |
|--------|-------------------|---------------------|
| **Design System** | Tailwind CSS, Tabler Icons | TBD |
| **Kanban Columns** | Inbox → Assigned → In Progress → Review → Done | TBD |
| **Task Detail Panel** | ✅ Slide-out with tabs (Comments, Resources) | TBD |
| **Agent Roster** | ✅ Header with live counts | TBD |
| **Activity Feed** | ✅ Real-time with filters | TBD |
| **Drag-and-Drop** | ✅ dnd-kit library | TBD |
| **Responsive** | ✅ Mobile-friendly | TBD |

### Performance

| Metric | **Convex Version** | **crshdn Version** |
|--------|-------------------|---------------------|
| **Startup Time** | ~3s (Vite + Convex connection) | TBD |
| **Latency** | ~100ms (real-time updates) | TBD |
| **Scalability** | Cloud-hosted, auto-scales | Limited by local machine |
| **Concurrent Users** | Unlimited (Convex handles) | Single user (localhost) |

### Development Experience

| Aspect | **Convex Version** | **crshdn Version** |
|--------|-------------------|---------------------|
| **Hot Reload** | ✅ Vite + Convex dev | TBD |
| **TypeScript** | ✅ Full typing (Convex codegen) | TBD |
| **Local Dev** | Requires Convex account | Fully local |
| **Deployment** | One command (`convex deploy`) | Manual (systemd, pm2, etc.) |

---

## 🎯 Recommended Use Case

### Use Convex Version When:
- Need real-time collaboration (multiple users/agents)
- Want cloud-hosted, zero-maintenance backend
- Building a production agent team dashboard
- Need built-in auth, multi-tenancy, and API tokens
- Want rich agent personas and activity tracking

### Use crshdn Version When:
- Prefer fully local/self-hosted (no external dependencies)
- Need complete data privacy (no cloud)
- Want simpler setup (no Convex account required)
- Building a personal, single-user dashboard
- Need to customize backend logic extensively

---

## 🚀 Next Steps

### To Use This Version:

1. **Install the hook handler** (see "OpenClaw Hooks Integration" above)
2. **Restart OpenClaw gateway:** `openclaw gateway restart`
3. **Sign up** at http://localhost:3002
4. **Run an agent command** (e.g., from Telegram) and watch it appear in Control Tower
5. **Explore the dashboard:**
   - Drag tasks between columns
   - Click a task to view details, comments, and documents
   - Monitor the activity feed in the right panel

### To Compare Versions:

1. **Inspect crshdn version** at `/Users/aidenhdee/.openclaw/shared/projects/mission-control-app`
2. **Document its features** in a similar format
3. **Run both side-by-side** (different ports) and compare UX
4. **Load test** with multiple simultaneous agent runs
5. **Decide which to use** based on needs (real-time vs local, cloud vs self-hosted)

### To Customize:

- **Edit agent roster:** Modify `convex/seed.ts` and re-run `npx convex run seed:run`
- **Change task statuses:** Edit `convex/schema.ts` and `convex/tasks.ts`
- **Customize UI:** Edit React components in `src/` (uses Tailwind for styling)
- **Add integrations:** Create new HTTP routes in `convex/http.ts`
- **Extend hook handler:** Modify `hooks/control-tower/handler.ts` for custom event processing

---

## 📝 Notes

- **No conflicts** with crshdn version (different ports, different deployments)
- **Separate Convex deployment** from `agent-team-db` (isolated data)
- **Hook handler is sophisticated** — handles heartbeats, system follow-ups, document capture, source detection
- **Seed data is Marvel-themed** — agents named after Avengers characters (can be changed)
- **Real-time is the killer feature** — every action syncs instantly across all clients
- **Multi-tenancy ready** — can support multiple teams/organizations with isolated data

---

## 🐛 Potential Issues

1. **Auth library deprecation:** `lucia@3.2.2` is deprecated. May need migration to a newer auth solution.
2. **Convex account required:** Can't run fully offline (needs internet for Convex Cloud).
3. **Port 3002 hardcoded:** Change in `npx vite --port 3002` command if needed.
4. **Hook requires gateway restart:** Changes to hook handler need `openclaw gateway restart`.
5. **Seed script is idempotent:** Re-running `npx convex run seed:run` will **delete and recreate** all agents and tasks. Use with caution in production.

---

## 🔧 Useful Commands

```bash
# Development (runs both Vite and Convex dev in parallel)
npm run dev

# Run only frontend (Convex already running)
npx vite --port 3002 --host 0.0.0.0

# Run only backend
npx convex dev

# Seed database
npx convex run seed:run

# Deploy to production
npx convex deploy
npm run build

# Access Convex dashboard
open https://dashboard.convex.dev/d/qualified-sheep-733

# Check running processes
ps aux | grep -E "(vite|convex)"

# Kill Vite server
pkill -f "vite --port 3002"

# Kill Convex dev watcher
pkill -f "convex dev"
```

---

**Setup completed by:** Subagent (d6c31544-183c-4287-a526-9ea3f07cf859)  
**Date:** 2026-02-09 15:27 MST
