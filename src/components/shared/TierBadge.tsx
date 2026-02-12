import { TIER_COLORS } from "../../lib/constants";

interface TierBadgeProps {
	tier: string;
}

export default function TierBadge({ tier }: TierBadgeProps) {
	const color = TIER_COLORS[tier] || "#6b7280";
	return (
		<span
			className="badge"
			style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
		>
			{tier}
		</span>
	);
}
