import { useState, useMemo, useCallback } from "react";
import { useQuery } from "convex/react";
import { useNavigate } from "react-router-dom";
import {
	ReactFlow,
	Controls,
	MiniMap,
	Background,
	BackgroundVariant,
	type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import AgentNodeComponent from "../components/escalation/AgentNode";
import useEscalationGraph from "../hooks/useEscalationGraph";
import { AGENT_CATEGORIES, CATEGORY_COLORS, TIER_COLORS } from "../lib/constants";
import { IconShare2 } from "@tabler/icons-react";

const nodeTypes = { agentNode: AgentNodeComponent };

export default function EscalationNetworkPage() {
	const agents = useQuery(api.queries.listAgents, { tenantId: DEFAULT_TENANT_ID });
	const navigate = useNavigate();

	const [tierFilter, setTierFilter] = useState<string | null>(null);
	const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
	const [showDisabled, setShowDisabled] = useState(false);

	const allAgents = (agents || []).filter((a) => a.name !== "OpenClaw");

	const filteredAgents = useMemo(() => {
		let list = allAgents;
		if (tierFilter) list = list.filter((a) => a.tier === tierFilter);
		if (categoryFilter) list = list.filter((a) => a.category === categoryFilter);
		if (!showDisabled) list = list.filter((a) => a.isEnabled !== false);
		return list;
	}, [allAgents, tierFilter, categoryFilter, showDisabled]);

	const { nodes, edges, agentCount, pathCount, isolatedCount } = useEscalationGraph(filteredAgents);

	const onNodeClick: NodeMouseHandler = useCallback(
		(_, node) => {
			const data = node.data as Record<string, unknown>;
			if (data.agentId) navigate(`/agents/${data.agentId}`);
		},
		[navigate],
	);

	const availableTiers = useMemo(() => {
		const tiers = new Set<string>();
		for (const a of allAgents) if (a.tier) tiers.add(a.tier);
		return ["T1", "T2", "T3"].filter((t) => tiers.has(t));
	}, [allAgents]);

	const availableCategories = useMemo(() => {
		const cats = new Set<string>();
		for (const a of allAgents) if (a.category) cats.add(a.category);
		return ([...AGENT_CATEGORIES] as string[]).filter((c) => cats.has(c));
	}, [allAgents]);

	const pillStyle = (isActive: boolean) => ({
		padding: "4px 10px",
		backgroundColor: isActive ? "var(--mc-accent, #3b82f6)" : "var(--mc-bg-card)",
		color: isActive ? "#fff" : "var(--mc-text-secondary)",
		border: isActive ? "1px solid transparent" : "1px solid var(--mc-border)",
		cursor: "pointer" as const,
		fontSize: 12,
		borderRadius: 6,
	});

	if (!agents) {
		return (
			<div className="empty-state">
				<p>Loading agents...</p>
			</div>
		);
	}

	if (allAgents.length === 0) {
		return (
			<div className="empty-state">
				<IconShare2 />
				<h3>No Agents</h3>
				<p>No agents found to display in the escalation network.</p>
			</div>
		);
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - var(--topbar-height) - 40px)" }}>
			{/* Header with stats */}
			<div style={{ marginBottom: 12 }}>
				<div className="page-header" style={{ marginBottom: 12 }}>
					<h1>Escalation Network</h1>
					<div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--mc-text-secondary)" }}>
						<span>{agentCount} agents</span>
						<span>{pathCount} paths</span>
						<span>{isolatedCount} isolated</span>
					</div>
				</div>

				{/* Filters */}
				<div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
					{/* Tier pills */}
					<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
						<span style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>Tier:</span>
						<span className="badge" onClick={() => setTierFilter(null)} style={pillStyle(tierFilter === null)}>
							All
						</span>
						{availableTiers.map((t) => (
							<span
								key={t}
								className="badge"
								onClick={() => setTierFilter(tierFilter === t ? null : t)}
								style={pillStyle(tierFilter === t)}
							>
								{t}
							</span>
						))}
					</div>

					{/* Category pills */}
					{availableCategories.length > 0 && (
						<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
							<span style={{ fontSize: 11, color: "var(--mc-text-muted)" }}>Category:</span>
							<span className="badge" onClick={() => setCategoryFilter(null)} style={pillStyle(categoryFilter === null)}>
								All
							</span>
							{availableCategories.map((c) => (
								<span
									key={c}
									className="badge"
									onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
									style={pillStyle(categoryFilter === c)}
								>
									{c}
								</span>
							))}
						</div>
					)}

					{/* Show disabled checkbox */}
					<label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--mc-text-secondary)", cursor: "pointer" }}>
						<input
							type="checkbox"
							checked={showDisabled}
							onChange={(e) => setShowDisabled(e.target.checked)}
							style={{ accentColor: "#6366f1" }}
						/>
						Show disabled
					</label>
				</div>
			</div>

			{/* React Flow graph */}
			<div style={{ flex: 1, borderRadius: 8, overflow: "hidden", border: "1px solid var(--mc-border)" }}>
				<ReactFlow
					nodes={nodes}
					edges={edges}
					nodeTypes={nodeTypes}
					onNodeClick={onNodeClick}
					fitView
					fitViewOptions={{ padding: 0.2 }}
					minZoom={0.2}
					maxZoom={2}
					proOptions={{ hideAttribution: true }}
					colorMode="dark"
				>
					<Controls
						showInteractive={false}
						style={{ background: "var(--mc-bg-card)", border: "1px solid var(--mc-border)", borderRadius: 6 }}
					/>
					<MiniMap
						nodeStrokeWidth={3}
						style={{ background: "var(--mc-bg-secondary)", border: "1px solid var(--mc-border)", borderRadius: 6 }}
					/>
					<Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--mc-border)" />
				</ReactFlow>
			</div>

			{/* Legend bar */}
			<div
				style={{
					display: "flex",
					gap: 20,
					padding: "8px 0",
					fontSize: 11,
					color: "var(--mc-text-muted)",
					flexWrap: "wrap",
					alignItems: "center",
				}}
			>
				<span style={{ fontWeight: 500, color: "var(--mc-text-secondary)" }}>Legend:</span>
				{/* Tier colors */}
				{Object.entries(TIER_COLORS).map(([tier, color]) => (
					<span key={tier} style={{ display: "flex", alignItems: "center", gap: 4 }}>
						<span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
						{tier}
					</span>
				))}
				<span style={{ opacity: 0.3 }}>|</span>
				{/* Category border colors */}
				{availableCategories.map((cat) => (
					<span key={cat} style={{ display: "flex", alignItems: "center", gap: 4 }}>
						<span
							style={{
								width: 10,
								height: 10,
								borderRadius: 3,
								border: `2px solid ${CATEGORY_COLORS[cat] || "#6b7280"}`,
								display: "inline-block",
							}}
						/>
						{cat}
					</span>
				))}
			</div>
		</div>
	);
}
