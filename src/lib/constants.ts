// Design tokens and color maps from the plan spec

export const TIER_COLORS: Record<string, string> = {
  T1: "#f59e0b",
  T2: "#3b82f6",
  T3: "#6b7280",
};

export const PRIORITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  urgent: "#f97316",
  high: "#f97316",
  normal: "#3b82f6",
  medium: "#3b82f6",
  low: "#6b7280",
};

export const PHASE_COLORS: Record<string, string> = {
  coding: "#3b82f6",
  reasoning: "#8b5cf6",
  any: "#6b7280",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "active",
  idle: "idle",
  off: "disabled",
  blocked: "blocked",
};

export const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  idle: "#6b7280",
  blocked: "#eab308",
  off: "#ef4444",
  ok: "#22c55e",
  warn: "#eab308",
  error: "#ef4444",
};

export const TASK_STATUS_COLORS: Record<string, string> = {
  inbox: "#6b7280",
  assigned: "#3b82f6",
  in_progress: "#22c55e",
  review: "#eab308",
  done: "#6366f1",
  archived: "#55556a",
};

export const BUSINESS_UNITS = ["automagic", "chemdry", "cross"] as const;
export const AGENT_CATEGORIES = [
  "engineering", "operations", "marketing", "finance", "research",
  "sales", "content", "customer", "hr", "family", "strategy",
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  engineering: "#3b82f6",
  operations: "#22c55e",
  marketing: "#f59e0b",
  finance: "#8b5cf6",
  research: "#06b6d4",
  sales: "#f97316",
  content: "#14b8a6",
  customer: "#ec4899",
  hr: "#a855f7",
  family: "#84cc16",
  strategy: "#ef4444",
};

export const BUSINESS_UNIT_COLORS: Record<string, string> = {
  automagic: "#6366f1",
  chemdry: "#22c55e",
  cross: "#f59e0b",
  unassigned: "#6b7280",
};

export const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: "IconLayoutDashboard" },
  { path: "/projects", label: "Projects", icon: "IconColumns3" },
  { path: "/tasks", label: "Tasks", icon: "IconChecklist" },
  { path: "/agents", label: "Agents", icon: "IconUsers" },
  { path: "/opus", label: "Opus Budget", icon: "IconCoin" },
  { path: "/phase", label: "Phase", icon: "IconToggleRight" },
  { path: "/logs", label: "Activity Log", icon: "IconTerminal2" },
  { path: "/settings", label: "Settings", icon: "IconSettings" },
] as const;
