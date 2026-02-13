import { STATUS_COLORS, STATUS_LABELS } from "../../lib/constants";

interface StatusDotProps {
	status: string;
	size?: number;
	pulse?: boolean;
}

export default function StatusDot({ status, size = 8, pulse = false }: StatusDotProps) {
	const color = STATUS_COLORS[status] || "#6b7280";
	return (
		<span
			className="status-dot"
			style={{
				width: size,
				height: size,
				backgroundColor: color,
				animation: pulse && status === "active" ? "card-pulse 2s ease-in-out infinite" : undefined,
			}}
			title={STATUS_LABELS[status] || status}
		/>
	);
}
