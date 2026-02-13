import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import { BUSINESS_UNITS, STATUS_LABELS } from "../lib/constants";
import { getEffectiveStatuses, type EffectiveStatus } from "../lib/status";
import AgentCard from "../components/AgentCard";
import AddAgentModal from "../components/AddAgentModal";
import StatusDot from "../components/shared/StatusDot";

type StatusFilter = EffectiveStatus | null;

export default function AgentsPage() {
	const agents = useQuery(api.queries.listAgents, { tenantId: DEFAULT_TENANT_ID });
	const tasks = useQuery(api.queries.listTasks, { tenantId: DEFAULT_TENANT_ID });
	const utilization = useQuery(api.queries.getAgentUtilization, { tenantId: DEFAULT_TENANT_ID });
	const deleteAgent = useMutation(api.agents.deleteAgent);
	const navigate = useNavigate();

	const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
	const [businessUnitFilter, setBusinessUnitFilter] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [showAddAgentModal, setShowAddAgentModal] = useState(false);

	const allAgentsRaw = (agents || []).filter((a) => a.name !== "OpenClaw");
	const effectiveStatuses = useMemo(
		() => getEffectiveStatuses(allAgentsRaw, tasks || []),
		[allAgentsRaw, tasks],
	);

	// Enrich agents with their computed effective status
	const allAgents = useMemo(
		() => allAgentsRaw.map((a) => ({ ...a, effectiveStatus: effectiveStatuses.get(a._id) ?? a.status })),
		[allAgentsRaw, effectiveStatuses],
	);

	// Derive unique categories and business units from the data
	const availableCategories = useMemo(() => {
		const cats = new Set<string>();
		for (const a of allAgents) {
			if (a.category) cats.add(a.category);
		}
		return Array.from(cats).sort();
	}, [allAgents]);

	const availableBusinessUnits = useMemo(() => {
		const units = new Set<string>();
		for (const a of allAgents) {
			if (a.businessUnit) units.add(a.businessUnit);
		}
		// Also include constants if present
		for (const bu of BUSINESS_UNITS) {
			units.add(bu);
		}
		return Array.from(units).sort();
	}, [allAgents]);

	// Apply filters
	const agentList = useMemo(() => {
		let list = allAgents;
		if (statusFilter) {
			list = list.filter((a) => a.effectiveStatus === statusFilter);
		}
		if (categoryFilter) {
			list = list.filter((a) => a.category === categoryFilter);
		}
		if (businessUnitFilter) {
			list = list.filter((a) => a.businessUnit === businessUnitFilter);
		}
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			list = list.filter(
				(a) =>
					a.name.toLowerCase().includes(q) ||
					a.role.toLowerCase().includes(q)
			);
		}
		return list;
	}, [allAgents, statusFilter, categoryFilter, businessUnitFilter, searchQuery]);

	const statusCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		for (const s of ["active", "idle", "off", "blocked"]) {
			counts[s] = allAgents.filter((a) => a.effectiveStatus === s).length;
		}
		return counts;
	}, [allAgents]);

	const getUtilization = (agentId: string) =>
		utilization?.find((u) => u.agentId === agentId);

	const pillStyle = (isActive: boolean) => ({
		padding: "4px 10px",
		backgroundColor: isActive ? "var(--mc-accent, #3b82f6)" : "var(--mc-bg-card)",
		color: isActive ? "#fff" : "var(--mc-text-secondary)",
		border: isActive ? "1px solid transparent" : "1px solid var(--mc-border)",
		cursor: "pointer" as const,
		fontSize: 12,
		borderRadius: 6,
	});

	return (
		<div>
			<div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
				<h1>Agents</h1>
				<button
					type="button"
					onClick={() => setShowAddAgentModal(true)}
					className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[var(--accent-green)] rounded-lg hover:opacity-90 transition-opacity"
				>
					<span className="text-base leading-none">+</span> Add Agent
				</button>
			</div>

			{/* Search box */}
			<div style={{ marginBottom: 12 }}>
				<input
					type="text"
					placeholder="Search agents by name or role..."
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					style={{
						width: "100%",
						maxWidth: 360,
						padding: "8px 12px",
						fontSize: 13,
						background: "var(--mc-bg-card)",
						border: "1px solid var(--mc-border)",
						borderRadius: 6,
						color: "var(--mc-text-primary)",
						outline: "none",
					}}
				/>
			</div>

			{/* Status filter pills */}
			<div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
				<span
					className="badge"
					onClick={() => setStatusFilter(null)}
					style={pillStyle(statusFilter === null)}
				>
					All ({allAgents.length})
				</span>
				{(["active", "idle", "off", "blocked"] as const).map((s) => (
					<span
						key={s}
						className="badge"
						onClick={() => setStatusFilter(statusFilter === s ? null : s)}
						style={pillStyle(statusFilter === s)}
					>
						<StatusDot status={s} /> <span style={{ marginLeft: 6 }}>{STATUS_LABELS[s] || s} ({statusCounts[s]})</span>
					</span>
				))}
			</div>

			{/* Category + Business Unit filters */}
			<div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
				{/* Category filter */}
				{availableCategories.length > 0 && (
					<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
						<span style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>Category:</span>
						<span
							className="badge"
							onClick={() => setCategoryFilter(null)}
							style={pillStyle(categoryFilter === null)}
						>
							All
						</span>
						{availableCategories.map((cat) => (
							<span
								key={cat}
								className="badge"
								onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
								style={pillStyle(categoryFilter === cat)}
							>
								{cat}
							</span>
						))}
					</div>
				)}

				{/* Business Unit filter */}
				<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
					<span style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>Business:</span>
					<span
						className="badge"
						onClick={() => setBusinessUnitFilter(null)}
						style={pillStyle(businessUnitFilter === null)}
					>
						All
					</span>
					{availableBusinessUnits.map((bu) => (
						<span
							key={bu}
							className="badge"
							onClick={() => setBusinessUnitFilter(businessUnitFilter === bu ? null : bu)}
							style={pillStyle(businessUnitFilter === bu)}
						>
							{bu}
						</span>
					))}
				</div>
			</div>

			{/* Agent cards grid */}
			<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
				{agentList.map((agent) => (
					<AgentCard
						key={agent._id}
						agent={agent}
						effectiveStatus={agent.effectiveStatus}
						utilization={getUtilization(agent._id)}
						onDelete={(agentId) => deleteAgent({ id: agentId, tenantId: DEFAULT_TENANT_ID })}
						onSelectAgent={(agentId) => navigate(`/agents/${agentId}`)}
					/>
				))}
			</div>

			{agentList.length === 0 && (
				<div style={{ textAlign: "center", padding: "60px 20px", color: "var(--mc-text-muted)" }}>
					No agents match the current filters
				</div>
			)}

			{showAddAgentModal && (
				<AddAgentModal
					onClose={() => setShowAddAgentModal(false)}
					onCreated={() => setShowAddAgentModal(false)}
				/>
			)}
		</div>
	);
}
