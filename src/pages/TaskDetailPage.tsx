import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import { Id } from "../../convex/_generated/dataModel";
import PriorityBadge from "../components/shared/PriorityBadge";
import BusinessUnitBadge from "../components/shared/BusinessUnitBadge";
import ModelBadge from "../components/shared/ModelBadge";
import TimeAgo from "../components/shared/TimeAgo";
import MetricCard from "../components/shared/MetricCard";
import EscalationTimeline from "../components/tasks/EscalationTimeline";
import { TASK_STATUS_COLORS } from "../lib/constants";
import { formatDuration, formatCost } from "../lib/utils";
import { IconArrowLeft, IconRefresh, IconArrowUp } from "@tabler/icons-react";

export default function TaskDetailPage() {
	const { id } = useParams<{ id: string }>();
	const tasks = useQuery(api.queries.listTasks, { tenantId: DEFAULT_TENANT_ID });
	const agents = useQuery(api.queries.listAgents, { tenantId: DEFAULT_TENANT_ID });
	const messages = useQuery(
		api.queries.listMessages,
		id ? { taskId: id as Id<"tasks">, tenantId: DEFAULT_TENANT_ID } : "skip",
	);

	const task = tasks?.find((t) => t._id === id);
	const agentMap = new Map((agents || []).map((a) => [a._id, a]));

	if (!task) {
		return (
			<div>
				<Link to="/tasks" style={{ color: "var(--mc-text-secondary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
					<IconArrowLeft size={16} /> Back to Tasks
				</Link>
				<div style={{ padding: 40, textAlign: "center", color: "var(--mc-text-muted)" }}>
					{tasks === undefined ? "Loading..." : "Task not found"}
				</div>
			</div>
		);
	}

	const assigneeNames = task.assigneeIds.map((aid) => agentMap.get(aid)?.name).filter(Boolean);
	const duration = task.startedAt
		? (task.completedAt || (task.status === "done" ? task._creationTime : Date.now())) - task.startedAt
		: null;

	return (
		<div>
			<Link to="/tasks" style={{ color: "var(--mc-text-secondary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
				<IconArrowLeft size={16} /> Back to Tasks
			</Link>

			{/* Stats row */}
			<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
				<MetricCard
					label="Status"
					value={task.status.replace("_", " ")}
					color={TASK_STATUS_COLORS[task.status]}
				/>
				<MetricCard
					label="Duration"
					value={duration ? formatDuration(duration) : "-"}
				/>
				<MetricCard
					label="Cost"
					value={task.totalCost != null ? formatCost(task.totalCost) : "-"}
				/>
				<MetricCard
					label="Escalations"
					value={task.escalationHistory?.length || 0}
				/>
			</div>

			<div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
				{/* Main content */}
				<div>
					<h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--mc-text-primary)", marginBottom: 8 }}>
						{task.title}
					</h1>
					<div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
						<span
							className="badge"
							style={{
								backgroundColor: `${TASK_STATUS_COLORS[task.status] || "#6b7280"}20`,
								color: TASK_STATUS_COLORS[task.status] || "#6b7280",
							}}
						>
							{task.status.replace("_", " ")}
						</span>
						{task.priority && <PriorityBadge priority={task.priority} />}
						{task.businessUnit && <BusinessUnitBadge unit={task.businessUnit} />}
						{task.taskType && (
							<span className="badge" style={{ backgroundColor: "var(--mc-bg-card-hover)", color: "var(--mc-text-secondary)" }}>
								{task.taskType}
							</span>
						)}
						{task.source && (
							<span style={{ fontSize: 12, color: "var(--mc-text-muted)" }}>via {task.source}</span>
						)}
					</div>

					{/* Description */}
					<div className="metric-card" style={{ marginBottom: 16 }}>
						<div className="metric-label">Description</div>
						<p style={{ fontSize: 13, color: "var(--mc-text-primary)", whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
							{task.description}
						</p>
					</div>

					{/* Messages timeline */}
					<div className="metric-card">
						<div className="metric-label" style={{ marginBottom: 12 }}>Activity ({messages?.length || 0})</div>
						{(messages || []).map((msg) => (
							<div key={msg._id} style={{ padding: "10px 0", borderBottom: "1px solid var(--mc-border)" }}>
								<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
									<span style={{ fontSize: 12, fontWeight: 600, color: "var(--mc-text-primary)" }}>
										{msg.agentAvatar} {msg.agentName}
									</span>
									<span style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>
										<TimeAgo timestamp={msg._creationTime} />
									</span>
								</div>
								<div style={{ fontSize: 13, color: "var(--mc-text-secondary)", whiteSpace: "pre-wrap" }}>
									{msg.content}
								</div>
							</div>
						))}
						{(messages || []).length === 0 && (
							<div style={{ color: "var(--mc-text-muted)", fontSize: 13 }}>No activity yet</div>
						)}
					</div>
				</div>

				{/* Sidebar */}
				<div>
					{/* Details card */}
					<div className="metric-card" style={{ marginBottom: 16 }}>
						<div className="metric-label">Details</div>
						<div style={{ display: "grid", gap: 12, marginTop: 8 }}>
							<div>
								<div style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>Assignees</div>
								<div style={{ fontSize: 13, color: "var(--mc-text-primary)" }}>
									{assigneeNames.length > 0 ? assigneeNames.join(", ") : "Unassigned"}
								</div>
							</div>
							<div>
								<div style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>Created</div>
								<div style={{ fontSize: 13, color: "var(--mc-text-primary)" }}>
									<TimeAgo timestamp={task._creationTime} />
								</div>
							</div>
							{duration != null && (
								<div>
									<div style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>Duration</div>
									<div style={{ fontSize: 13, color: "var(--mc-text-primary)" }}>
										{formatDuration(duration)}
									</div>
								</div>
							)}
							{task.totalCost != null && (
								<div>
									<div style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>Cost</div>
									<div style={{ fontSize: 13, color: "var(--mc-text-primary)" }}>
										{formatCost(task.totalCost)}
									</div>
								</div>
							)}
							{task.totalTokens != null && (
								<div>
									<div style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>Tokens</div>
									<div style={{ fontSize: 13, color: "var(--mc-text-primary)" }}>
										{task.totalTokens.toLocaleString()}
									</div>
								</div>
							)}
							{task.tags.length > 0 && (
								<div>
									<div style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>Tags</div>
									<div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 4 }}>
										{task.tags.map((tag) => (
											<span key={tag} className="badge" style={{ backgroundColor: "var(--mc-bg-card-hover)", color: "var(--mc-text-secondary)" }}>
												{tag}
											</span>
										))}
									</div>
								</div>
							)}
							{task.openclawRunId && (
								<div>
									<div style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>Run ID</div>
									<div style={{ fontSize: 11, color: "var(--mc-text-secondary)", fontFamily: "var(--font-mono)" }}>
										{task.openclawRunId}
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Actions */}
					<div className="metric-card" style={{ marginBottom: 16 }}>
						<div className="metric-label" style={{ marginBottom: 8 }}>Actions</div>
						<div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
							{task.status !== "done" && task.status !== "archived" && (
								<button
									type="button"
									className="btn-secondary"
									style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, width: "100%" }}
								>
									<IconArrowUp size={14} /> Escalate
								</button>
							)}
							{(task.status === "done" || task.status === "review") && (
								<button
									type="button"
									className="btn-secondary"
									style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, width: "100%" }}
								>
									<IconRefresh size={14} /> Retry
								</button>
							)}
						</div>
					</div>

					{/* Escalation timeline */}
					<div className="metric-card">
						<div className="metric-label" style={{ marginBottom: 8 }}>Escalation History</div>
						<EscalationTimeline history={task.escalationHistory || []} />
					</div>
				</div>
			</div>
		</div>
	);
}
