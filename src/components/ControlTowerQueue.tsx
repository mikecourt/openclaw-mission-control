import React, { useState } from "react";
import { useQuery, useMutation, useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { IconArrowLeft, IconPlus } from "@tabler/icons-react";
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
import KanbanColumn from "./KanbanColumn";
import TaskRowList from "./TaskRowList";
import IdeasView from "./IdeasView";
import ArchivedView from "./ArchivedView";
import AddIdeaModal from "./AddIdeaModal";

type ProjectStatus = "idea" | "planning" | "active" | "paused" | "review" | "complete" | "archived";

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

interface ProjectData {
	_id: Id<"projects">;
	_creationTime: number;
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

const projectColumns = [
	{ id: "planning", label: "PLANNING", color: "var(--text-subtle)" },
	{ id: "active", label: "ACTIVE", color: "var(--accent-blue)" },
	{ id: "paused", label: "PAUSED", color: "var(--accent-orange)" },
	{ id: "complete", label: "COMPLETE", color: "var(--accent-green)" },
];

type ActiveTab = "board" | "ideas" | "archived";

interface ControlTowerQueueProps {
	selectedTaskId: Id<"tasks"> | null;
	onSelectTask: (id: Id<"tasks">) => void;
	selectedProjectId: Id<"projects"> | null;
	onSelectProject: (id: Id<"projects"> | null) => void;
	onAddProject: () => void;
	onAddTask: () => void;
}

const BACKLOG_SENTINEL = "__backlog__" as Id<"projects">;

const ControlTowerQueue: React.FC<ControlTowerQueueProps> = ({
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
	const [activeTab, setActiveTab] = useState<ActiveTab>("board");
	const [showAddIdeaModal, setShowAddIdeaModal] = useState(false);
	const convex = useConvex();
	const [activeItem, setActiveItem] = useState<ProjectData | null>(null);

	const currentUserAgent = agents?.find(a => a.name === "Mike");

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
		const project = projects?.find((p) => p._id === event.active.id);
		if (project) setActiveItem(project as unknown as ProjectData);
	};

	const handleDragEndProject = async (event: DragEndEvent) => {
		const { active, over } = event;
		setActiveItem(null);

		if (!over || !currentUserAgent) return;

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
					sessionKey: `control-tower:${taskId}`,
					name: "ControlTower",
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
			console.error("[ControlTowerQueue] Failed to trigger openclaw agent:", err);
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

	// --- Filtered project lists ---
	const ideaProjects = projects?.filter((p) => p.status === "idea") ?? [];
	const archivedProjects = projects?.filter((p) => p.status === "archived") ?? [];

	// --- Render ---

	// Tab labels
	const tabLabels: Record<ActiveTab, string> = {
		board: "Current Projects",
		ideas: "Project Ideas",
		archived: "Archived",
	};

	// Tab bar (shown when no project is selected)
	const renderTabBar = () => (
		<div className="flex gap-1 px-6 py-2 bg-card border-b border-border">
			{(["board", "ideas", "archived"] as ActiveTab[]).map((tab) => (
				<button
					key={tab}
					onClick={() => setActiveTab(tab)}
					className={`px-3 py-1 text-[11px] font-bold tracking-widest rounded transition-colors ${
						activeTab === tab
							? "bg-foreground text-background"
							: "text-muted-foreground hover:bg-muted"
					}`}
				>
					{tabLabels[tab].toUpperCase()}
					{tab === "ideas" && ideaProjects.length > 0 && (
						<span className="ml-1.5 text-[9px] opacity-70">{ideaProjects.length}</span>
					)}
					{tab === "archived" && archivedProjects.length > 0 && (
						<span className="ml-1.5 text-[9px] opacity-70">{archivedProjects.length}</span>
					)}
				</button>
			))}
		</div>
	);

	// Task Row List view (drill-down into a project)
	if (selectedProjectId) {
		const project = isBacklogView ? null : projects?.find((p) => p._id === selectedProjectId);
		const viewTitle = isBacklogView ? "BACKLOG" : (project?.name?.toUpperCase() || "PROJECT");

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
									{(project as unknown as ProjectData).progress}% complete
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
					</div>
				</div>

				<TaskRowList
					tasks={(tasks ?? []) as Task[]}
					selectedTaskId={selectedTaskId}
					onSelectTask={onSelectTask}
					onArchive={handleArchive}
					onPlay={handlePlay}
					getAgentName={getAgentName}
					currentUserAgentId={currentUserAgent?._id}
				/>
			</main>
		);
	}

	// IDEAS tab
	if (activeTab === "ideas") {
		return (
			<main className="[grid-area:main] bg-secondary flex min-h-0 flex-col overflow-hidden">
				{renderTabBar()}
				<IdeasView
					projects={ideaProjects as unknown as Array<ProjectData & { _creationTime: number }>}
					onAddIdea={() => setShowAddIdeaModal(true)}
				/>
				{showAddIdeaModal && (
					<AddIdeaModal onClose={() => setShowAddIdeaModal(false)} />
				)}
			</main>
		);
	}

	// ARCHIVED tab
	if (activeTab === "archived") {
		return (
			<main className="[grid-area:main] bg-secondary flex min-h-0 flex-col overflow-hidden">
				{renderTabBar()}
				<ArchivedView projects={archivedProjects as unknown as ProjectData[]} />
			</main>
		);
	}

	// BOARD tab (default) — Project Kanban
	return (
		<main className="[grid-area:main] bg-secondary flex min-h-0 flex-col overflow-hidden">
			{renderTabBar()}

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
						{projects?.filter((p) => p.status !== "complete" && p.status !== "archived" && p.status !== "idea").length || 0} active
					</div>
				</div>
			</div>

			<DndContext
				sensors={sensors}
				onDragStart={handleDragStartProject}
				onDragEnd={handleDragEndProject}
			>
				<div className="flex-1 min-h-0 grid grid-cols-4 gap-px bg-border overflow-x-auto overflow-y-hidden">
					{projectColumns.map((col) => (
						<KanbanColumn
							key={col.id}
							column={col}
							taskCount={projects?.filter((p) => (p as unknown as ProjectData).status === col.id).length || 0}
						>
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

export default ControlTowerQueue;
