import React, { useState } from "react";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { IconArchive, IconArrowLeft, IconPlus } from "@tabler/icons-react";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import {
	DndContext,
	DragOverlay,
	PointerSensor,
	useSensor,
	useSensors,
	DragStartEvent,
	DragEndEvent,
} from "@dnd-kit/core";
import ProjectCard from "./ProjectCard";
import TaskCard from "./TaskCard";
import KanbanColumn from "./KanbanColumn";

type TaskStatus = "inbox" | "assigned" | "in_progress" | "review" | "done" | "archived";
type ProjectStatus = "planning" | "active" | "paused" | "review" | "complete" | "archived";

interface Task {
	_id: Id<"tasks">;
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

interface ProjectData {
	_id: Id<"projects">;
	name: string;
	description: string;
	status: string;
	area?: string;
	borderColor?: string;
	totalCost?: number;
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
	needsInputCount: number;
}

function formatRelativeTime(timestamp: number | null): string {
	if (!timestamp) return "";

	const now = Date.now();
	const diff = now - timestamp;

	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (seconds < 60) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;

	return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const projectColumns = [
	{ id: "planning", label: "PLANNING", color: "var(--text-subtle)" },
	{ id: "active", label: "ACTIVE", color: "var(--accent-blue)" },
	{ id: "paused", label: "PAUSED", color: "var(--accent-orange)" },
	{ id: "complete", label: "COMPLETE", color: "var(--accent-green)" },
];

const taskColumns = [
	{ id: "inbox", label: "INBOX", color: "var(--text-subtle)" },
	{ id: "assigned", label: "ASSIGNED", color: "var(--accent-orange)" },
	{ id: "in_progress", label: "IN PROGRESS", color: "var(--accent-blue)" },
	{ id: "done", label: "DONE", color: "var(--accent-green)" },
];

const archivedColumn = { id: "archived", label: "ARCHIVED", color: "var(--text-subtle)" };

interface MissionQueueProps {
	selectedTaskId: Id<"tasks"> | null;
	onSelectTask: (id: Id<"tasks">) => void;
	selectedProjectId: Id<"projects"> | null;
	onSelectProject: (id: Id<"projects"> | null) => void;
	onAddProject: () => void;
	onAddTask: () => void;
}

const BACKLOG_SENTINEL = "__backlog__" as Id<"projects">;

const MissionQueue: React.FC<MissionQueueProps> = ({
	selectedTaskId,
	onSelectTask,
	selectedProjectId,
	onSelectProject,
	onAddProject,
	onAddTask,
}) => {
	const isBacklogView = selectedProjectId === BACKLOG_SENTINEL;
	const projects = useQuery(api.projects.listAll, { tenantId: DEFAULT_TENANT_ID });
	const tasks = useQuery(api.queries.listTasks, {
		tenantId: DEFAULT_TENANT_ID,
		...(isBacklogView
			? { unassigned: true }
			: selectedProjectId
				? { projectId: selectedProjectId }
				: {}),
	});
	const agents = useQuery(api.queries.listAgents, { tenantId: DEFAULT_TENANT_ID });
	const archiveTask = useMutation(api.tasks.archiveTask);
	const updateTaskStatus = useMutation(api.tasks.updateStatus);
	const updateProject = useMutation(api.projects.update);
	const linkRun = useMutation(api.tasks.linkRun);
	const [showArchived, setShowArchived] = useState(false);
	const convex = useConvex();
	const [activeItem, setActiveItem] = useState<Task | ProjectData | null>(null);

	const currentUserAgent = agents?.find(a => a.name === "Mike");

	// Count backlog tasks (no project) for the card on the project board
	const backlogTasks = useQuery(api.queries.listTasks, { tenantId: DEFAULT_TENANT_ID, unassigned: true });
	const backlogCount = backlogTasks?.filter((t) => t.status !== "archived").length ?? 0;

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { distance: 8 },
		})
	);

	const isLoading = ((selectedProjectId && !isBacklogView) ? tasks === undefined : projects === undefined) || agents === undefined;

	if (isLoading) {
		return (
			<main className="[grid-area:main] bg-secondary flex flex-col overflow-hidden animate-pulse">
				<div className="h-[65px] bg-card border-b border-border" />
				<div className="flex-1 grid grid-cols-5 gap-px bg-border">
					{[...Array(5)].map((_, i) => (
						<div key={i} className="bg-secondary" />
					))}
				</div>
			</main>
		);
	}

	const getAgentName = (id: string) => {
		return agents?.find((a) => a._id === id)?.name || "Unknown";
	};

	// --- Project view handlers ---

	const handleDragStartProject = (event: DragStartEvent) => {
		if (selectedProjectId) {
			const task = tasks?.find((t) => t._id === event.active.id);
			if (task) setActiveItem(task as Task);
		} else {
			const project = projects?.find((p) => p._id === event.active.id);
			if (project) setActiveItem(project as unknown as ProjectData);
		}
	};

	const handleDragEndProject = async (event: DragEndEvent) => {
		const { active, over } = event;
		setActiveItem(null);

		if (!over || !currentUserAgent) return;

		if (selectedProjectId) {
			// Task drag within project
			const taskId = active.id as Id<"tasks">;
			const newStatus = over.id as TaskStatus;
			const task = tasks?.find((t) => t._id === taskId);

			if (task && task.status !== newStatus) {
				await updateTaskStatus({
					taskId,
					status: newStatus,
					agentId: currentUserAgent._id,
					tenantId: DEFAULT_TENANT_ID,
				});
			}
		} else {
			// Project drag
			const projectId = active.id as Id<"projects">;
			const newStatus = over.id as ProjectStatus;
			const project = projects?.find((p) => p._id === projectId);

			if (project && project.status !== newStatus) {
				await updateProject({
					projectId,
					status: newStatus,
					tenantId: DEFAULT_TENANT_ID,
				});
			}
		}
	};

	const handleArchive = (taskId: Id<"tasks">) => {
		if (currentUserAgent) {
			archiveTask({
				taskId,
				agentId: currentUserAgent._id,
				tenantId: DEFAULT_TENANT_ID,
			});
		}
	};

	const buildAgentPreamble = (task: Task) => {
		const assignee = task.assigneeIds.length > 0
			? agents?.find(a => a._id === task.assigneeIds[0])
			: null;
		if (!assignee) return "";

		const parts: string[] = [];
		if (assignee.systemPrompt) parts.push(`System Prompt:\n${assignee.systemPrompt}`);
		if (assignee.character) parts.push(`Character:\n${assignee.character}`);
		if (assignee.lore) parts.push(`Lore:\n${assignee.lore}`);

		return parts.length > 0 ? parts.join("\n\n") + "\n\n---\n\n" : "";
	};

	const buildPrompt = async (task: Task) => {
		let prompt = buildAgentPreamble(task);

		prompt += task.description && task.description !== task.title
			? `${task.title}\n\n${task.description}`
			: task.title;

		const messages = await convex.query(api.queries.listMessages, {
			taskId: task._id,
			tenantId: DEFAULT_TENANT_ID,
		});
		if (messages && messages.length > 0) {
			const sorted = [...messages].sort((a, b) => a._creationTime - b._creationTime);
			const thread = sorted.map(m => `[${m.agentName}]: ${m.content}`).join("\n\n");
			prompt += `\n\n---\nConversation:\n${thread}\n---\nContinue working on this task based on the conversation above.`;
		}

		return prompt;
	};

	const triggerAgent = async (taskId: Id<"tasks">, message: string) => {
		try {
			const res = await fetch("/hooks/agent", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"Authorization": `Bearer ${import.meta.env.VITE_OPENCLAW_HOOK_TOKEN || ""}`,
				},
				body: JSON.stringify({
					message,
					sessionKey: `mission:${taskId}`,
					name: "MissionControl",
					wakeMode: "now",
				}),
			});

			if (res.ok) {
				const data = await res.json();
				if (data.runId) {
					await linkRun({
						taskId,
						openclawRunId: data.runId,
						tenantId: DEFAULT_TENANT_ID,
					});
				}
			}
		} catch (err) {
			console.error("[MissionQueue] Failed to trigger openclaw agent:", err);
		}
	};

	const handlePlay = async (taskId: Id<"tasks">) => {
		if (!currentUserAgent) return;

		await updateTaskStatus({
			taskId,
			status: "in_progress",
			agentId: currentUserAgent._id,
			tenantId: DEFAULT_TENANT_ID,
		});

		const task = tasks?.find((t) => t._id === taskId);
		if (!task) return;

		const message = await buildPrompt(task as Task);
		await triggerAgent(taskId, message);
	};

	// --- Render ---

	if (selectedProjectId) {
		// TASK VIEW (drill-down into a project or unassigned tasks)
		const project = isBacklogView ? null : projects?.find((p) => p._id === selectedProjectId);
		const viewTitle = isBacklogView ? "BACKLOG" : (project?.name?.toUpperCase() || "PROJECT");
		const displayColumns = showArchived ? [...taskColumns, archivedColumn] : taskColumns;
		const archivedCount = tasks?.filter((t) => t.status === "archived").length || 0;

		return (
			<main className="[grid-area:main] bg-secondary flex min-h-0 flex-col overflow-hidden">
				<div className="shrink-0 flex items-center justify-between px-6 py-5 bg-card border-b border-border">
					<div className="flex items-center gap-3">
						<button
							onClick={() => onSelectProject(null)}
							className="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
							title="Back to projects"
						>
							<IconArrowLeft size={18} />
						</button>
						<div>
							<div className="text-[11px] font-bold tracking-widest text-muted-foreground flex items-center gap-2">
								<span className={`w-1.5 h-1.5 rounded-full ${isBacklogView ? "bg-[var(--accent-orange)]" : "bg-[var(--accent-blue)]"}`} />
								{viewTitle}
							</div>
							{project && (
								<div className="text-[10px] text-muted-foreground mt-0.5">
									{project.progress}% complete
								</div>
							)}
						</div>
					</div>
					<div className="flex gap-2">
						<button
							onClick={onAddTask}
							className="text-[11px] font-semibold px-3 py-1 rounded bg-[var(--accent-blue)] text-white flex items-center gap-1.5 hover:opacity-90 transition-opacity"
						>
							<IconPlus size={14} /> Add Task
						</button>
						<div className="text-[11px] font-semibold px-3 py-1 rounded bg-muted text-muted-foreground">
							{tasks?.filter((t) => t.status !== "done" && t.status !== "archived").length || 0} active
						</div>
						<button
							onClick={() => setShowArchived(!showArchived)}
							className={`text-[11px] font-semibold px-3 py-1 rounded flex items-center gap-1.5 transition-colors ${
								showArchived
									? "bg-[var(--accent-blue)] text-white"
									: "bg-muted text-muted-foreground hover:bg-muted"
							}`}
						>
							<IconArchive size={14} />
							{showArchived ? "Hide Archived" : "Archived"}
							{archivedCount > 0 && (
								<span className={`px-1.5 rounded-full text-[10px] ${showArchived ? "bg-card/20" : "bg-accent"}`}>
									{archivedCount}
								</span>
							)}
						</button>
					</div>
				</div>

				<DndContext
					sensors={sensors}
					onDragStart={handleDragStartProject}
					onDragEnd={handleDragEndProject}
				>
					<div className={`flex-1 min-h-0 grid gap-px bg-border overflow-x-auto overflow-y-hidden ${showArchived ? "grid-cols-5" : "grid-cols-4"}`}>
						{displayColumns.map((col) => (
							<KanbanColumn
								key={col.id}
								column={col}
								taskCount={tasks?.filter((t) => t.status === col.id).length || 0}
							>
								{tasks
									?.filter((t) => t.status === col.id)
									.map((task) => (
										<TaskCard
											key={task._id}
											task={task as Task}
											isSelected={selectedTaskId === task._id}
											onClick={() => onSelectTask(task._id)}
											getAgentName={getAgentName}
											formatRelativeTime={formatRelativeTime}
											columnId={col.id}
											currentUserAgentId={currentUserAgent?._id}
											onArchive={handleArchive}
											onPlay={handlePlay}
										/>
									))}
							</KanbanColumn>
						))}
					</div>

					<DragOverlay>
						{activeItem && "_id" in activeItem && "assigneeIds" in activeItem ? (
							<TaskCard
								task={activeItem as Task}
								isSelected={false}
								onClick={() => {}}
								getAgentName={getAgentName}
								formatRelativeTime={formatRelativeTime}
								columnId={(activeItem as Task).status}
								isOverlay={true}
							/>
						) : null}
					</DragOverlay>
				</DndContext>
			</main>
		);
	}

	// PROJECT VIEW (main kanban)
	const displayColumns = showArchived ? [...projectColumns, archivedColumn] : projectColumns;
	const archivedCount = projects?.filter((p) => p.status === "archived").length || 0;

	return (
		<main className="[grid-area:main] bg-secondary flex min-h-0 flex-col overflow-hidden">
			<div className="shrink-0 flex items-center justify-between px-6 py-5 bg-card border-b border-border">
				<div className="text-[11px] font-bold tracking-widest text-muted-foreground flex items-center gap-2">
					<span className="w-1.5 h-1.5 bg-[var(--accent-orange)] rounded-full" />{" "}
					PROJECTS
				</div>
				<div className="flex gap-2">
					<button
						onClick={onAddProject}
						className="text-[11px] font-semibold px-3 py-1 rounded bg-[var(--accent-blue)] text-white flex items-center gap-1.5 hover:opacity-90 transition-opacity"
					>
						<IconPlus size={14} /> New Project
					</button>
					<div className="text-[11px] font-semibold px-3 py-1 rounded bg-muted text-muted-foreground">
						{projects?.filter((p) => p.status !== "complete" && p.status !== "archived").length || 0} active
					</div>
					<button
						onClick={() => setShowArchived(!showArchived)}
						className={`text-[11px] font-semibold px-3 py-1 rounded flex items-center gap-1.5 transition-colors ${
							showArchived
								? "bg-[var(--accent-blue)] text-white"
								: "bg-muted text-muted-foreground hover:bg-muted"
						}`}
					>
						<IconArchive size={14} />
						{showArchived ? "Hide Archived" : "Archived"}
						{archivedCount > 0 && (
							<span className={`px-1.5 rounded-full text-[10px] ${showArchived ? "bg-card/20" : "bg-accent"}`}>
								{archivedCount}
							</span>
						)}
					</button>
				</div>
			</div>

			<DndContext
				sensors={sensors}
				onDragStart={handleDragStartProject}
				onDragEnd={handleDragEndProject}
			>
				<div className={`flex-1 min-h-0 grid gap-px bg-border overflow-x-auto overflow-y-hidden ${showArchived ? "grid-cols-5" : "grid-cols-4"}`}>
					{displayColumns.map((col) => (
						<KanbanColumn
							key={col.id}
							column={col}
							taskCount={
								(projects?.filter((p) => (p as unknown as ProjectData).status === col.id).length || 0)
								+ (col.id === "active" && backlogCount > 0 ? 1 : 0)
							}
						>
							{col.id === "active" && backlogCount > 0 && (
								<div
									className="min-w-0 bg-card rounded-lg p-3 sm:p-4 shadow-sm flex flex-col gap-2.5 border border-dashed border-border hover:-translate-y-0.5 hover:shadow-md transition-all cursor-pointer select-none"
									onClick={() => onSelectProject(BACKLOG_SENTINEL)}
								>
									<div className="flex justify-between items-start gap-2">
										<h3 className="text-sm font-semibold text-foreground leading-tight">
											Backlog
										</h3>
										<span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0 bg-muted text-muted-foreground">
											no project
										</span>
									</div>
									<p className="text-xs text-muted-foreground leading-relaxed">
										Tasks not yet assigned to a project
									</p>
									<div className="flex justify-between text-[10px] text-muted-foreground">
										<span className="font-semibold">{backlogCount} task{backlogCount !== 1 ? "s" : ""}</span>
									</div>
								</div>
							)}
							{projects
								?.filter((p) => (p as unknown as ProjectData).status === col.id)
								.map((project) => (
									<ProjectCard
										key={project._id}
										project={project as unknown as ProjectData}
										isSelected={false}
										onClick={() => onSelectProject(project._id)}
										columnId={col.id}
									/>
								))}
						</KanbanColumn>
					))}
				</div>

				<DragOverlay>
					{activeItem && "_id" in activeItem && "taskCounts" in activeItem ? (
						<ProjectCard
							project={activeItem as unknown as ProjectData}
							isSelected={false}
							onClick={() => {}}
							columnId={(activeItem as unknown as ProjectData).status}
							isOverlay={true}
						/>
					) : null}
				</DragOverlay>
			</DndContext>
		</main>
	);
};

export default MissionQueue;
