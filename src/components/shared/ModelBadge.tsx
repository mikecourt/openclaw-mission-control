const MODEL_COLORS: Record<string, string> = {
	"claude-opus-4": "#f59e0b",
	"claude-sonnet-4": "#3b82f6",
	"gpt-4o-mini": "#22c55e",
	"gemini-2.0-flash": "#6366f1",
	"deepseek-r1": "#8b5cf6",
	"deepseek-v3": "#a855f7",
	"qwen2.5-coder:32b": "#ec4899",
	"phi-4:14b": "#14b8a6",
};

interface ModelBadgeProps {
	model: string;
}

export default function ModelBadge({ model }: ModelBadgeProps) {
	const color = MODEL_COLORS[model] || "#6b7280";
	const shortName = model.split("/").pop()?.split(":")[0] || model;
	return (
		<span
			className="badge"
			style={{
				backgroundColor: `${color}15`,
				color,
				border: `1px solid ${color}30`,
				fontFamily: "var(--font-mono)",
				fontSize: 10,
			}}
		>
			{shortName}
		</span>
	);
}
