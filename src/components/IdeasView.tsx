import React, { useState, useMemo } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { IconSearch, IconPlus, IconArrowUp } from "@tabler/icons-react";
import { DEFAULT_TENANT_ID } from "../lib/tenant";

interface ProjectData {
	_id: Id<"projects">;
	_creationTime: number;
	name: string;
	description: string;
	status: string;
	area?: string;
	borderColor?: string;
}

const areaColors: Record<string, string> = {
	"chem-dry": "#f97316",
	automagic: "#8b5cf6",
	personal: "#06b6d4",
	infrastructure: "#64748b",
};

interface IdeasViewProps {
	projects: ProjectData[];
	onAddIdea: () => void;
}

const IdeasView: React.FC<IdeasViewProps> = ({ projects, onAddIdea }) => {
	const [search, setSearch] = useState("");
	const updateProject = useMutation(api.projects.update);

	const filtered = useMemo(() => {
		if (!search.trim()) return projects;
		const q = search.toLowerCase();
		return projects.filter(
			(p) =>
				p.name.toLowerCase().includes(q) ||
				p.description.toLowerCase().includes(q)
		);
	}, [projects, search]);

	const handlePromote = async (projectId: Id<"projects">) => {
		await updateProject({
			projectId,
			status: "planning",
			tenantId: DEFAULT_TENANT_ID,
		});
	};

	const formatDate = (ts: number) =>
		new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });

	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
			{/* Header */}
			<div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card">
				<div className="flex items-center gap-3">
					<span className="text-[11px] font-bold tracking-widest text-muted-foreground">
						IDEAS
					</span>
					<span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
						{projects.length}
					</span>
				</div>
				<button
					onClick={onAddIdea}
					className="text-[11px] font-semibold px-3 py-1 rounded bg-[var(--accent-blue)] text-white flex items-center gap-1.5 hover:opacity-90 transition-opacity"
				>
					<IconPlus size={14} /> New Idea
				</button>
			</div>

			{/* Search */}
			<div className="shrink-0 px-4 py-3 border-b border-border bg-card">
				<div className="relative">
					<IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search ideas..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full pl-9 pr-3 py-1.5 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:border-transparent"
					/>
				</div>
			</div>

			{/* Rows */}
			<div className="flex-1 min-h-0 overflow-y-auto">
				{filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-32 gap-2 text-sm text-muted-foreground">
						{projects.length === 0 ? "No ideas yet. Add one to get started!" : "No matching ideas"}
					</div>
				) : (
					filtered.map((idea) => (
						<div
							key={idea._id}
							className="flex items-center gap-3 px-4 py-2.5 border-b border-border hover:bg-muted/50 transition-colors"
						>
							{/* Area badge */}
							{idea.area ? (
								<span
									className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0"
									style={{
										backgroundColor: `${areaColors[idea.area] || "#64748b"}20`,
										color: areaColors[idea.area] || "#64748b",
									}}
								>
									{idea.area}
								</span>
							) : (
								<span className="w-14" />
							)}

							{/* Name */}
							<span className="text-sm font-semibold text-foreground truncate min-w-0 max-w-[250px]">
								{idea.name}
							</span>

							{/* Description */}
							<span className="text-xs text-muted-foreground truncate min-w-0 flex-1">
								{idea.description}
							</span>

							{/* Created date */}
							<span className="text-[10px] text-muted-foreground shrink-0">
								{formatDate(idea._creationTime)}
							</span>

							{/* Promote button */}
							<button
								onClick={() => handlePromote(idea._id)}
								className="text-[10px] font-semibold px-2 py-1 rounded flex items-center gap-1 bg-[var(--accent-green)]/15 text-[var(--accent-green)] hover:bg-[var(--accent-green)]/25 transition-colors shrink-0"
								title="Promote to project"
							>
								<IconArrowUp size={12} /> Promote
							</button>
						</div>
					))
				)}
			</div>
		</div>
	);
};

export default IdeasView;
