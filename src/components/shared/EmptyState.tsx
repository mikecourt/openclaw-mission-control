import { IconMoodEmpty } from "@tabler/icons-react";

interface EmptyStateProps {
	title: string;
	message?: string;
	icon?: React.ReactNode;
}

export default function EmptyState({ title, message, icon }: EmptyStateProps) {
	return (
		<div className="empty-state">
			{icon || <IconMoodEmpty />}
			<h3>{title}</h3>
			{message && <p>{message}</p>}
		</div>
	);
}
