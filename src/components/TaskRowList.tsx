import React, { useState, useMemo } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { IconSearch, IconArchive, IconPlayerPlay, IconLoader2 } from "@tabler/icons-react";

interface Task {
	_id: Id<"tasks">;
	_creationTime: number;
	title: string;
	description: string;
	status: string;
	assigneeIds: Id<"agents">[];
	tags: string[];
	borderColor?: string;
	lastMessageTime?: number;
	needsInput?: boolean;
	totalCost?: number;
	priority?: string;
	projectId?: Id<"projects">;
}

interface TaskRowListProps {
	tasks: Task[];
	selectedTaskId: Id<"tasks"> | null;
	onSelectTask: (id: Id<"tasks">) => void;
	onArchive: (taskId: Id<"tasks">) => void;
	onPlay: (taskId: Id<"tasks">) => void;
	getAgentName: (id: string) => string;
	currentUserAgentId?: Id<"agents">;
}

const STATUS_SORT: Record<string, number> = {
	done: 0,
	in_progress: 1,
	review: 2,
	assigned: 3,
	inbox: 4,
	archived: 5,
};

const STATUS_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
	done: { dot: "bg-[var(--accent-green)]", bg: "bg-[var(--accent-green)]/15", text: "text-[var(--accent-green)]" },
	in_progress: { dot: "bg-[var(--accent-blue)]", bg: "bg-[var(--accent-blue)]/15", text: "text-[var(--accent-blue)]" },
	review: { dot: "bg-[var(--accent-orange)]", bg: "bg-[var(--accent-orange)]/15", text: "text-[var(--accent-orange)]" },
	assigned: { dot: "bg-[var(--accent-orange)]", bg: "bg-[var(--accent-orange)]/15", text: "text-[var(--accent-orange)]" },
	inbox: { dot: "bg-muted-foreground", bg: "bg-muted", text: "text-muted-foreground" },
	archived: { dot: "bg-muted-foreground", bg: "bg-muted", text: "text-muted-foreground" },
};

const STATUS_LABEL: Record<string, string> = {
	done: "DONE",
	in_progress: "IN PROGRESS",
	review: "REVIEW",
	assigned: "ASSIGNED",
	inbox: "INBOX",
	archived: "ARCHIVED",
};

type FilterKey = "all" | "done" | "in_progress" | "inbox" | "assigned" | "review";

const FILTER_BADGES: { key: FilterKey; label: string }[] = [
	{ key: "all", label: "ALL" },
	{ key: "done", label: "DONE" },
	{ key: "in_progress", label: "IN PROGRESS" },
	{ key: "inbox", label: "INBOX" },
	{ key: "assigned", label: "ASSIGNED" },
	{ key: "review", label: "REVIEW" },
];

const TaskRowList: React.FC<TaskRowListProps> = ({
	tasks,
	selectedTaskId,
	onSelectTask,
	onArchive,
	onPlay,
	getAgentName,
	currentUserAgentId,
}) => {
	const [search, setSearch] = useState("");
	const [activeFilter, setActiveFilter] = useState<FilterKey>("all");

	const filtered = useMemo(() => {
		let list = tasks;

		// Search filter
		if (search.trim()) {
			const q = search.toLowerCase();
			list = list.filter(
				(t) =>
					t.title.toLowerCase().includes(q) ||
					t.description.toLowerCase().includes(q)
			);
		}

		// Status filter
		if (activeFilter !== "all") {
			list = list.filter((t) => t.status === activeFilter);
		}

		// Sort
		list = [...list].sort((a, b) => {
			const sa = STATUS_SORT[a.status] ?? 99;
			const sb = STATUS_SORT[b.status] ?? 99;
			if (sa !== sb) return sa - sb;
			return b._creationTime - a._creationTime;
		});

		return list;
	}, [tasks, search, activeFilter]);

	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
			{/* Search + Filters */}
			<div className="shrink-0 px-4 py-3 space-y-2 border-b border-border bg-card">
				<div className="relative">
					<IconSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
					<input
						type="text"
						placeholder="Search tasks..."
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full pl-9 pr-3 py-1.5 text-sm border border-border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-[var(--accent-blue)] focus:border-transparent"
					/>
				</div>
				<div className="flex gap-1 flex-wrap">
					{FILTER_BADGES.map((f) => (
						<button
							key={f.key}
							onClick={() => setActiveFilter(f.key)}
							className={`px-2.5 py-0.5 text-[10px] font-bold tracking-wider rounded-full transition-colors ${
								activeFilter === f.key
									? "bg-foreground text-background"
									: "bg-muted text-muted-foreground hover:bg-muted/80"
							}`}
						>
							{f.label}
						</button>
					))}
				</div>
			</div>

			{/* Task Rows */}
			<div className="flex-1 min-h-0 overflow-y-auto">
				{filtered.length === 0 ? (
					<div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
						No tasks found
					</div>
				) : (
					filtered.map((task) => {
						const colors = STATUS_COLORS[task.status] || STATUS_COLORS.inbox;
						const label = STATUS_LABEL[task.status] || task.status.toUpperCase();
						const isSelected = selectedTaskId === task._id;

						return (
							<div
								key={task._id}
								onClick={() => onSelectTask(task._id)}
								className={`flex items-center gap-3 px-4 py-2.5 border-b border-border cursor-pointer transition-colors ${
									isSelected
										? "bg-[var(--accent-blue)]/10 ring-1 ring-inset ring-[var(--accent-blue)]"
										: "hover:bg-muted/50"
								}`}
							>
								{/* Status dot */}
								<span className={`w-2 h-2 rounded-full shrink-0 ${colors.dot}`} />

								{/* Title */}
								<span className="text-sm font-semibold text-foreground truncate min-w-0 max-w-[200px]">
									{task.title}
								</span>

								{/* Description */}
								<span className="text-xs text-muted-foreground truncate min-w-0 flex-1">
									{task.description}
								</span>

								{/* Status badge */}
								<span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${colors.bg} ${colors.text}`}>
									{label}
								</span>

								{/* Assignee */}
								{task.assigneeIds.length > 0 && (
									<span className="text-[11px] font-semibold text-muted-foreground shrink-0 w-16 truncate text-right">
										{getAgentName(task.assigneeIds[0] as string)}
									</span>
								)}

								{/* Actions */}
								<div className="flex items-center gap-1 shrink-0">
									{(task.status === "inbox" || task.status === "assigned") && currentUserAgentId && (
										<button
											onClick={(e) => { e.stopPropagation(); onPlay(task._id); }}
											className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-[var(--accent-blue)]"
											title="Start task"
										>
											<IconPlayerPlay size={14} />
										</button>
									)}
									{task.status === "in_progress" && (
										<span className="p-1 text-[var(--accent-blue)]" title="Running">
											<IconLoader2 size={14} className="animate-spin" />
										</span>
									)}
									{task.status === "done" && currentUserAgentId && (
										<button
											onClick={(e) => { e.stopPropagation(); onArchive(task._id); }}
											className="p-1 hover:bg-muted rounded transition-colors text-muted-foreground hover:text-foreground"
											title="Archive task"
										>
											<IconArchive size={14} />
										</button>
									)}
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
};

export default TaskRowList;
