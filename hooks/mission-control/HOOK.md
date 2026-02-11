---
name: mission-control
description: "Sync agent lifecycle events to Control Tower dashboard"
homepage: https://github.com/manish-raana/openclaw-mission-control
metadata:
  {
    "openclaw":
      {
        "emoji": "📊",
        "events": ["gateway:startup", "agent:bootstrap", "command:new"],
        "install": [{ "id": "user", "kind": "user", "label": "User-installed hook" }],
      },
  }
---

# Control Tower Integration

Sends agent lifecycle events to the Control Tower Convex backend for real-time task tracking.

## How It Works

1. On `gateway:startup`, registers a persistent listener via `onAgentEvent()`
2. The listener watches for lifecycle events (`stream: "lifecycle"`)
3. On `phase: "start"` or `phase: "end"`, POSTs to Control Tower

## Configuration

Add to `~/.openclaw/openclaw.json`:

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "mission-control": {
          "enabled": true,
          "env": {
            "MISSION_CONTROL_URL": "http://127.0.0.1:3211/openclaw/event"
          }
        }
      }
    }
  }
}
```

For production (Convex cloud), use:
```json
"MISSION_CONTROL_URL": "https://your-project.convex.site/openclaw/event"
```

Alternatively, set the `MISSION_CONTROL_URL` environment variable (hook config takes priority).

## What It Does

- On agent start: Creates task in Control Tower (status: in_progress)
- On agent end: Marks task as done
- On agent error: Marks task for review

## Disabling

```bash
openclaw hooks disable mission-control
```
