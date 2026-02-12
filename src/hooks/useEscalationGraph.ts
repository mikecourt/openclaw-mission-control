import { useMemo } from "react";
import type { Node, Edge } from "@xyflow/react";
import { AGENT_CATEGORIES } from "../lib/constants";
import type { AgentNodeData } from "../components/escalation/AgentNode";

type Agent = {
	_id: string;
	name: string;
	role: string;
	avatar: string;
	status: string;
	tier?: string;
	category?: string;
	isEnabled?: boolean;
	escalationPath?: string[];
};

const TIER_Y: Record<string, number> = {
	T1: 0,
	T2: 250,
	T3: 500,
};
const DEFAULT_Y = 750;
const X_SPACING = 220;
const Y_SPACING = 250;

export default function useEscalationGraph(agents: Agent[]) {
	return useMemo(() => {
		const filtered = agents.filter((a) => a.name !== "OpenClaw");

		// Build name → agent lookup
		const byName = new Map<string, Agent>();
		for (const a of filtered) {
			byName.set(a.name, a);
		}

		// Group by category for X positioning
		const categories = [...AGENT_CATEGORIES] as string[];
		const catIndex = new Map<string, number>();
		for (let i = 0; i < categories.length; i++) {
			catIndex.set(categories[i], i);
		}

		// Group agents by tier for Y, then by category for X
		const tierGroups: Record<string, Agent[]> = {};
		for (const a of filtered) {
			const tier = a.tier || "none";
			if (!tierGroups[tier]) tierGroups[tier] = [];
			tierGroups[tier].push(a);
		}

		// Sort each tier group by category then name for consistent ordering
		for (const tier of Object.keys(tierGroups)) {
			tierGroups[tier].sort((a, b) => {
				const ci = (catIndex.get(a.category || "") ?? 99) - (catIndex.get(b.category || "") ?? 99);
				return ci !== 0 ? ci : a.name.localeCompare(b.name);
			});
		}

		const nodes: Node[] = [];
		const edges: Edge[] = [];

		// Position nodes
		const tierOrder = ["T1", "T2", "T3", "none"];
		for (const tier of tierOrder) {
			const group = tierGroups[tier];
			if (!group) continue;
			const y = TIER_Y[tier] ?? DEFAULT_Y;
			const startX = -(group.length - 1) * X_SPACING / 2;

			for (let i = 0; i < group.length; i++) {
				const a = group[i];
				nodes.push({
					id: a._id,
					type: "agentNode",
					position: { x: startX + i * X_SPACING, y },
					data: {
						label: a.name,
						name: a.name,
						role: a.role,
						avatar: a.avatar,
						status: a.status,
						tier: a.tier,
						category: a.category,
						isEnabled: a.isEnabled,
						agentId: a._id,
					} satisfies AgentNodeData,
				});
			}
		}

		// Create edges from escalationPath
		for (const a of filtered) {
			if (!a.escalationPath) continue;
			for (const targetName of a.escalationPath) {
				const target = byName.get(targetName);
				if (!target) continue;
				edges.push({
					id: `${a._id}->${target._id}`,
					source: a._id,
					target: target._id,
					animated: true,
					style: { stroke: "#6366f1", strokeWidth: 2 },
				});
			}
		}

		// Stats
		const connectedIds = new Set<string>();
		for (const e of edges) {
			connectedIds.add(e.source);
			connectedIds.add(e.target);
		}
		const isolatedCount = nodes.length - connectedIds.size;

		return { nodes, edges, agentCount: nodes.length, pathCount: edges.length, isolatedCount };
	}, [agents]);
}
