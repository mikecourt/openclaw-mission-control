import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import StatusDot from "../components/shared/StatusDot";
import MetricCard from "../components/shared/MetricCard";
import TimeAgo from "../components/shared/TimeAgo";
import TierBadge from "../components/shared/TierBadge";
import ModelBadge from "../components/shared/ModelBadge";
import BusinessUnitBadge from "../components/shared/BusinessUnitBadge";
import SystemPromptEditor from "../components/agents/SystemPromptEditor";
import { PHASE_COLORS } from "../lib/constants";
import { IconArrowLeft } from "@tabler/icons-react";
import AgentAvatar from "../components/AgentAvatar";
import { Id } from "../../convex/_generated/dataModel";

export default function AgentDetailPage() {
	const { id } = useParams<{ id: string }>();
	const agents = useQuery(api.queries.listAgents, { tenantId: DEFAULT_TENANT_ID });
	const tasks = useQuery(api.queries.listTasks, { tenantId: DEFAULT_TENANT_ID });
	const utilization = useQuery(api.queries.getAgentUtilization, { tenantId: DEFAULT_TENANT_ID });

	const updateAgent = useMutation(api.agents.updateAgent);
	const toggleAgent = useMutation(api.agents.toggleAgent);

	const agent = agents?.find((a) => a._id === id);
	const agentTasks = (tasks || []).filter((t) => t.assigneeIds.includes(id as Id<"agents">));
	const activeTasks = agentTasks.filter((t) => t.status === "in_progress" || t.status === "assigned");
	const completedTasks = agentTasks.filter((t) => t.status === "done" || t.status === "archived");
	const reviewTasks = agentTasks.filter((t) => t.status === "review");

	// Cost data from utilization query
	const agentCostData = utilization?.find((u) => u.agentId === id);

	// System prompt editor state
	const [promptValue, setPromptValue] = useState("");
	const [originalPrompt, setOriginalPrompt] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (agent?.systemPrompt !== undefined) {
			const prompt = agent.systemPrompt || "";
			setPromptValue(prompt);
			setOriginalPrompt(prompt);
		}
	}, [agent?.systemPrompt]);

	const handleSavePrompt = async () => {
		if (!agent || !id) return;
		setIsSaving(true);
		try {
			await updateAgent({
				id: id as Id<"agents">,
				tenantId: DEFAULT_TENANT_ID,
				systemPrompt: promptValue,
			});
			setOriginalPrompt(promptValue);
		} finally {
			setIsSaving(false);
		}
	};

	const handleResetPrompt = () => {
		setPromptValue(originalPrompt);
	};

	const handleToggleEnabled = async () => {
		if (!agent || !id) return;
		await toggleAgent({
			id: id as Id<"agents">,
			tenantId: DEFAULT_TENANT_ID,
			enabled: !(agent.isEnabled !== false),
		});
	};

	if (!agent) {
		return (
			<div>
				<Link to="/agents" style={{ color: "var(--mc-text-secondary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
					<IconArrowLeft size={16} /> Back to Agents
				</Link>
				<div style={{ padding: 40, textAlign: "center", color: "var(--mc-text-muted)" }}>
					{agents === undefined ? "Loading..." : "Agent not found"}
				</div>
			</div>
		);
	}

	const isEnabled = agent.isEnabled !== false;
	const phaseColor = agent.phase ? PHASE_COLORS[agent.phase] || "var(--mc-text-secondary)" : undefined;

	return (
		<div>
			<Link to="/agents" style={{ color: "var(--mc-text-secondary)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
				<IconArrowLeft size={16} /> Back to Agents
			</Link>

			{/* Agent header */}
			<div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
				<AgentAvatar name={agent.name} avatar={agent.avatar} size={48} />
				<div style={{ flex: 1 }}>
					<h1 style={{ fontSize: 24, fontWeight: 600, color: "var(--mc-text-primary)", margin: 0 }}>
						{agent.name}
					</h1>
					<div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
						<StatusDot status={agent.status} pulse={agent.status === "active"} />
						<span style={{ fontSize: 13, color: "var(--mc-text-secondary)" }}>{agent.status}</span>
						<span style={{ color: "var(--mc-text-muted)" }}>|</span>
						<span style={{ fontSize: 13, color: "var(--mc-text-secondary)" }}>{agent.role}</span>
						<span style={{ color: "var(--mc-text-muted)" }}>|</span>
						<span style={{ fontSize: 13, color: "var(--mc-text-secondary)" }}>{agent.level}</span>
						{agent.tier && (
							<>
								<span style={{ color: "var(--mc-text-muted)" }}>|</span>
								<TierBadge tier={agent.tier} />
							</>
						)}
						{agent.model && (
							<>
								<span style={{ color: "var(--mc-text-muted)" }}>|</span>
								<ModelBadge model={agent.model} />
							</>
						)}
						{agent.businessUnit && (
							<>
								<span style={{ color: "var(--mc-text-muted)" }}>|</span>
								<BusinessUnitBadge unit={agent.businessUnit} />
							</>
						)}
					</div>
				</div>

				{/* Enable / Disable toggle */}
				<div style={{ textAlign: "center" }}>
					<button
						onClick={handleToggleEnabled}
						style={{
							padding: "8px 16px",
							fontSize: 12,
							fontWeight: 500,
							background: isEnabled ? "var(--mc-bg-card)" : "var(--mc-accent, #3b82f6)",
							border: `1px solid ${isEnabled ? "var(--mc-border)" : "transparent"}`,
							borderRadius: 6,
							color: isEnabled ? "var(--mc-text-secondary)" : "#fff",
							cursor: "pointer",
						}}
					>
						{isEnabled ? "Disable Agent" : "Enable Agent"}
					</button>
					<div style={{ fontSize: 10, color: "var(--mc-text-muted)", marginTop: 4 }}>
						{isEnabled ? "Agent is enabled" : "Agent is disabled"}
					</div>
				</div>
			</div>

			<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
				{/* Left: Config */}
				<div>
					{/* Metrics */}
					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
						<MetricCard label="Active Tasks" value={activeTasks.length} />
						<MetricCard label="Completed" value={completedTasks.length} />
						<MetricCard label="In Review" value={reviewTasks.length} />
					</div>

					{/* Cost data (from utilization query) */}
					{agentCostData && (
						<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
							<MetricCard
								label="Total Cost"
								value={`$${agentCostData.totalCost.toFixed(2)}`}
							/>
							<MetricCard
								label="Total Tokens"
								value={agentCostData.totalTokens.toLocaleString()}
							/>
						</div>
					)}

					{/* Config details */}
					<div className="metric-card">
						<div className="metric-label">Configuration</div>
						<div style={{ display: "grid", gap: 12, marginTop: 12 }}>
							<div>
								<div style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>Model</div>
								<div style={{ fontSize: 13, color: "var(--mc-text-primary)", fontFamily: "var(--font-mono)" }}>
									{agent.model ? <ModelBadge model={agent.model} /> : "Not assigned"}
								</div>
							</div>
							{agent.fallbackModel && (
								<div>
									<div style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>Fallback Model</div>
									<div style={{ fontSize: 13, color: "var(--mc-text-primary)", fontFamily: "var(--font-mono)" }}>
										<ModelBadge model={agent.fallbackModel} />
									</div>
								</div>
							)}
							<div>
								<div style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>Tier</div>
								<div style={{ fontSize: 13, color: "var(--mc-text-primary)" }}>
									{agent.tier ? <TierBadge tier={agent.tier} /> : "Not assigned"}
								</div>
							</div>
							<div>
								<div style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>Phase</div>
								<div style={{ fontSize: 13, color: phaseColor || "var(--mc-text-primary)" }}>
									{agent.phase || "Not assigned"}
								</div>
							</div>
							<div>
								<div style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>Business Unit</div>
								<div style={{ fontSize: 13, color: "var(--mc-text-primary)" }}>
									{agent.businessUnit ? <BusinessUnitBadge unit={agent.businessUnit} /> : "Not assigned"}
								</div>
							</div>
							{agent.maxConcurrentTasks !== undefined && (
								<div>
									<div style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>Max Concurrent Tasks</div>
									<div style={{ fontSize: 13, color: "var(--mc-text-primary)" }}>
										{agent.maxConcurrentTasks}
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Escalation Path */}
					{agent.escalationPath && agent.escalationPath.length > 0 && (
						<div className="metric-card" style={{ marginTop: 16 }}>
							<div className="metric-label">Escalation Path</div>
							<div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
								{agent.escalationPath.map((step, i) => (
									<span
										key={i}
										style={{
											display: "inline-flex",
											alignItems: "center",
											gap: 4,
											fontSize: 12,
											color: "var(--mc-text-secondary)",
										}}
									>
										{i > 0 && <span style={{ color: "var(--mc-text-muted)" }}>&rarr;</span>}
										<span
											className="badge"
											style={{
												padding: "3px 8px",
												backgroundColor: "var(--mc-bg-card)",
												border: "1px solid var(--mc-border)",
												color: "var(--mc-text-primary)",
											}}
										>
											{step}
										</span>
									</span>
								))}
							</div>
						</div>
					)}
				</div>

				{/* Right: Tasks + Prompt */}
				<div>
					{/* System prompt editor */}
					<div className="metric-card" style={{ marginBottom: 16 }}>
						<div className="metric-label">System Prompt</div>
						<div style={{ marginTop: 8 }}>
							<SystemPromptEditor
								value={promptValue}
								onChange={setPromptValue}
								onSave={handleSavePrompt}
								onReset={handleResetPrompt}
								isSaving={isSaving}
								promptHistory={agent.promptHistory}
							/>
						</div>
					</div>

					{/* Recent tasks */}
					<div className="metric-card">
						<div className="metric-label">Recent Tasks</div>
						{agentTasks.slice(0, 5).map((t) => (
							<Link
								key={t._id}
								to={`/tasks/${t._id}`}
								style={{
									display: "block",
									padding: "8px 0",
									borderBottom: "1px solid var(--mc-border)",
									textDecoration: "none",
									color: "var(--mc-text-primary)",
									fontSize: 13,
								}}
							>
								<div style={{ display: "flex", justifyContent: "space-between" }}>
									<span>{t.title}</span>
									<span style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>
										<TimeAgo timestamp={t._creationTime} />
									</span>
								</div>
							</Link>
						))}
						{agentTasks.length === 0 && (
							<div style={{ color: "var(--mc-text-muted)", fontSize: 13, marginTop: 8 }}>No tasks</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
