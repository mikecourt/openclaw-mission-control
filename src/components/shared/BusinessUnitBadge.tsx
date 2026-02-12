import { BUSINESS_UNIT_COLORS } from "../../lib/constants";

interface BusinessUnitBadgeProps {
	unit: string;
}

export default function BusinessUnitBadge({ unit }: BusinessUnitBadgeProps) {
	const color = BUSINESS_UNIT_COLORS[unit] || BUSINESS_UNIT_COLORS.unassigned;
	return (
		<span
			className="badge"
			style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}
		>
			{unit}
		</span>
	);
}
