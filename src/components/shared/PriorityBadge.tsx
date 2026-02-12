import { PRIORITY_COLORS } from "../../lib/constants";

interface PriorityBadgeProps {
	priority: string;
}

export default function PriorityBadge({ priority }: PriorityBadgeProps) {
	const color = PRIORITY_COLORS[priority] || "#6b7280";
	return (
		<span
			className="badge"
			style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
		>
			{priority}
		</span>
	);
}
