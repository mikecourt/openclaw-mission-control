import React, { useState, useMemo } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { IconSearch } from "@tabler/icons-react";

interface ProjectData {
	_id: Id<"projects">;
	name: string;
	description: string;
	status: string;
	area?: string;
	borderColor?: string;
	taskCounts: {
		total: number;
		inbox: number;
		assigned: number;
		in_progress: number;
		review: number;
		done: number;
		archived: number;
	};
	progress: number;
}

const areaColors: Record<string, string> = {
	"chem-dry": "#f97316",
	automagic: "#8b5cf6",
	personal: "#06b6d4",
	infrastructure: "#64748b",
};

interface ArchivedViewProps {
	projects: ProjectData[];
}

const ArchivedView: React.FC<ArchivedViewProps> = ({ projects }) => {
	const [search, setSearch] = useState("");

	const filtered = useMemo(() => {
		if (!search.trim()) return projects;
		const q = search.toLowerCase();
		return projects.filter(
			(p) =>
				p.name.toLowerCase().includes(q) ||
				p.description.toLowerCase().includes(q)
		);
	}, [projects, search]);

	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
			{/* Header */}
			<div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-card">
				<div className="flex items-center gap-3">
					<span className="text-[11px] font-bold tracking-widest text-muted-foreground">
						ARCHIVED
					</span>
					<span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
						{projects.length}
					</span>
				</div>
			</div>

			{/* Search */}
			<div className="shrink-0 px-4 py-3 border-b border-border bg-card">
				<div className="relative">
					<IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search archived projects..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full pl-9 pr-3 py-1.5 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:border-transparent"
					/>
				</div>
			</div>

			{/* Rows */}
			<div className="flex-1 min-h-0 overflow-y-auto">
				{filtered.length === 0 ? (
					<div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
						No archived projects
					</div>
				) : (
					filtered.map((project) => (
						<div
							key={project._id}
							className="flex items-center gap-3 px-4 py-2.5 border-b border-border opacity-70"
						>
							{/* Area badge */}
							{project.area ? (
								<span
									className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0"
									style={{
										backgroundColor: `${areaColors[project.area] || "#64748b"}20`,
										color: areaColors[project.area] || "#64748b",
									}}
								>
									{project.area}
								</span>
							) : (
								<span className="w-14" />
							)}

							{/* Name */}
							<span className="text-sm font-semibold text-foreground truncate min-w-0 max-w-[250px]">
								{project.name}
							</span>

							{/* Description */}
							<span className="text-xs text-muted-foreground truncate min-w-0 flex-1">
								{project.description}
							</span>

							{/* Archived badge */}
							<span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 bg-muted text-muted-foreground">
								ARCHIVED
							</span>

							{/* Progress */}
							<span className="text-[10px] text-muted-foreground shrink-0 w-16 text-right">
								{project.progress}% done
							</span>
						</div>
					))
				)}
			</div>
		</div>
	);
};

export default ArchivedView;
