/**
 * Compute effective agent status from real signals instead of the static DB field.
 *
 * Priority (highest wins):
 *   1. disabled  — isEnabled === false OR stored status === "off"
 *   2. running   — lastActiveAt within RUNNING_THRESHOLD_MS
 *   3. blocked   — has assigned active tasks, but ALL are blocked/needsInput
 *   4. not running — default
 */

export type EffectiveStatus = "active" | "idle" | "off" | "blocked";

/** How recently lastActiveAt must be to count as "running". */
const RUNNING_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

interface AgentLike {
  _id: string;
  status: string;
  isEnabled?: boolean;
  lastActiveAt?: number;
}

interface TaskLike {
  assigneeIds: string[];
  status: string;
  blockedBy?: string;
  needsInput?: boolean;
}

export function getEffectiveStatus(
  agent: AgentLike,
  tasks: TaskLike[],
  now: number = Date.now(),
): EffectiveStatus {
  // 1. Disabled
  if (agent.isEnabled === false || agent.status === "off") {
    return "off";
  }

  // 2. Running — recent heartbeat / session activity
  if (agent.lastActiveAt && now - agent.lastActiveAt < RUNNING_THRESHOLD_MS) {
    return "active";
  }

  // 3. Blocked — has open tasks but every one is blocked
  const assignedTasks = tasks.filter(
    (t) =>
      t.assigneeIds.includes(agent._id) &&
      t.status !== "done" &&
      t.status !== "archived" &&
      t.status !== "inbox",
  );

  if (assignedTasks.length > 0) {
    const allBlocked = assignedTasks.every(
      (t) => !!t.blockedBy || !!t.needsInput,
    );
    if (allBlocked) return "blocked";
  }

  // 4. Not running
  return "idle";
}

/**
 * Batch-compute effective statuses for a list of agents.
 * Returns a Map keyed by agent._id.
 */
export function getEffectiveStatuses(
  agents: AgentLike[],
  tasks: TaskLike[],
  now: number = Date.now(),
): Map<string, EffectiveStatus> {
  const map = new Map<string, EffectiveStatus>();
  for (const agent of agents) {
    map.set(agent._id, getEffectiveStatus(agent, tasks, now));
  }
  return map;
}
