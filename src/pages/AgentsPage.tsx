import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import DataTable from "../components/shared/DataTable";
import StatusDot from "../components/shared/StatusDot";
import TierBadge from "../components/shared/TierBadge";
import ModelBadge from "../components/shared/ModelBadge";
import BusinessUnitBadge from "../components/shared/BusinessUnitBadge";
import { BUSINESS_UNITS, AGENT_CATEGORIES } from "../lib/constants";
import AgentAvatar from "../components/AgentAvatar";

type StatusFilter = "active" | "idle" | "off" | "blocked" | null;

export default function AgentsPage() {
	const agents = useQuery(api.queries.listAgents, { tenantId: DEFAULT_TENANT_ID });
	const navigate = useNavigate();

	const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
	const [businessUnitFilter, setBusinessUnitFilter] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");

	const allAgents = (agents || []).filter((a) => a.name !== "OpenClaw");

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
			list = list.filter((a) => a.status === statusFilter);
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
			counts[s] = allAgents.filter((a) => a.status === s).length;
		}
		return counts;
	}, [allAgents]);

	const columns = [
		{
			key: "status",
			label: "",
			width: "40px",
			render: (row: (typeof agentList)[0]) => <StatusDot status={row.status} pulse={row.status === "active"} />,
		},
		{
			key: "name",
			label: "Agent",
			render: (row: (typeof agentList)[0]) => (
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					<AgentAvatar name={row.name} avatar={row.avatar} size={28} />
					<div>
						<div style={{ fontWeight: 500 }}>{row.name}</div>
						<div style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>{row.role}</div>
					</div>
				</div>
			),
		},
		{
			key: "level",
			label: "Level",
			width: "70px",
			render: (row: (typeof agentList)[0]) => (
				<span style={{ fontSize: 12, color: "var(--mc-text-secondary)" }}>{row.level}</span>
			),
		},
		{
			key: "tier",
			label: "Tier",
			width: "80px",
			render: (row: (typeof agentList)[0]) => (
				row.tier ? <TierBadge tier={row.tier} /> : <span style={{ fontSize: 12, color: "var(--mc-text-muted)" }}>-</span>
			),
		},
		{
			key: "model",
			label: "Model",
			width: "160px",
			render: (row: (typeof agentList)[0]) => (
				row.model ? <ModelBadge model={row.model} /> : <span style={{ fontSize: 12, color: "var(--mc-text-muted)" }}>-</span>
			),
		},
		{
			key: "businessUnit",
			label: "Business",
			width: "120px",
			render: (row: (typeof agentList)[0]) => (
				row.businessUnit
					? <BusinessUnitBadge unit={row.businessUnit} />
					: <span style={{ fontSize: 12, color: "var(--mc-text-muted)" }}>-</span>
			),
		},
	];

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
			<div className="page-header">
				<h1>Agents</h1>
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
						<StatusDot status={s} /> <span style={{ marginLeft: 6 }}>{s} ({statusCounts[s]})</span>
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

			<div className="metric-card" style={{ padding: 0 }}>
				<DataTable
					columns={columns}
					data={agentList}
					getRowKey={(row) => row._id}
					onRowClick={(row) => navigate(`/agents/${row._id}`)}
					emptyMessage="No agents match the current filters"
				/>
			</div>
		</div>
	);
}
