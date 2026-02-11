import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Id } from "../../convex/_generated/dataModel";
import { IconAlertTriangle } from "@tabler/icons-react";

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

interface ProjectCardProps {
	project: ProjectData;
	isSelected: boolean;
	onClick: () => void;
	columnId: string;
	isOverlay?: boolean;
}

const areaColors: Record<string, string> = {
	"chem-dry": "#f97316",
	automagic: "#8b5cf6",
	personal: "#06b6d4",
	infrastructure: "#64748b",
};

const ProjectCard: React.FC<ProjectCardProps> = ({
	project,
	isSelected,
	onClick,
	columnId,
	isOverlay = false,
}) => {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		isDragging,
	} = useDraggable({
		id: project._id,
		data: { project },
	});

	const style = transform
		? { transform: CSS.Translate.toString(transform) }
		: undefined;

	const activeTasks = project.taskCounts.in_progress + project.taskCounts.assigned;
	const totalActive = project.taskCounts.total - project.taskCounts.archived;

	return (
		<div
			ref={setNodeRef}
			style={{
				...style,
				borderLeft:
					isSelected || isOverlay
						? undefined
						: `4px solid ${project.borderColor || areaColors[project.area || ""] || "transparent"}`,
			}}
			className={`min-w-0 bg-card rounded-lg p-3 sm:p-4 shadow-sm flex flex-col gap-2.5 border transition-all cursor-pointer select-none ${
				isDragging ? "dragging-card" : "hover:-translate-y-0.5 hover:shadow-md"
			} ${
				isSelected
					? "ring-2 ring-[var(--accent-blue)] border-transparent"
					: "border-border"
			} ${columnId === "archived" ? "opacity-60" : ""} ${
				columnId === "active" && activeTasks > 0 ? "card-running" : ""
			} ${isOverlay ? "drag-overlay" : ""}`}
			onClick={onClick}
			{...listeners}
			{...attributes}
		>
			{/* Needs Input Banner */}
			{project.needsInputCount > 0 && (
				<div className="flex items-center gap-1.5 px-2 py-1 bg-[var(--accent-orange)]/15 text-[var(--accent-orange)] rounded text-[10px] font-bold">
					<IconAlertTriangle size={12} />
					{project.needsInputCount} task{project.needsInputCount > 1 ? "s" : ""} need{project.needsInputCount === 1 ? "s" : ""} you
				</div>
			)}

			{/* Header */}
			<div className="flex justify-between items-start gap-2">
				<h3 className="text-sm font-semibold text-foreground leading-tight break-words flex-1">
					{project.name}
				</h3>
				{project.area && (
					<span
						className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0"
						style={{
							backgroundColor: `${areaColors[project.area] || "#64748b"}20`,
							color: areaColors[project.area] || "#64748b",
						}}
					>
						{project.area}
					</span>
				)}
			</div>

			{/* Description */}
			<p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 break-words">
				{project.description}
			</p>

			{/* Progress Bar */}
			<div className="space-y-1">
				<div className="flex justify-between text-[10px] text-muted-foreground">
					<span>{project.progress}% complete</span>
					<span>{project.taskCounts.done}/{totalActive} tasks</span>
				</div>
				<div className="h-1.5 bg-muted rounded-full overflow-hidden">
					<div
						className="h-full rounded-full transition-all duration-500"
						style={{
							width: `${project.progress}%`,
							backgroundColor: project.progress === 100 ? "var(--accent-green)" : "var(--accent-blue)",
						}}
					/>
				</div>
			</div>

			{/* Footer Stats */}
			<div className="flex justify-between items-center">
				<div className="flex gap-2">
					{activeTasks > 0 && (
						<span className="text-[10px] font-semibold px-1.5 py-0.5 bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] rounded">
							{activeTasks} active
						</span>
					)}
					{project.taskCounts.review > 0 && (
						<span className="text-[10px] font-semibold px-1.5 py-0.5 bg-[var(--accent-orange)]/15 text-[var(--accent-orange)] rounded">
							{project.taskCounts.review} review
						</span>
					)}
					{project.taskCounts.inbox > 0 && (
						<span className="text-[10px] font-semibold px-1.5 py-0.5 bg-muted text-muted-foreground rounded">
							{project.taskCounts.inbox} inbox
						</span>
					)}
				</div>
				{(project.totalCost ?? 0) > 0 && (
					<span className="text-[10px] font-mono text-muted-foreground">
						${(project.totalCost ?? 0).toFixed(2)}
					</span>
				)}
			</div>
		</div>
	);
};

export default ProjectCard;
