import { useEffect, useState } from "react";
import { formatRelativeTime } from "../../lib/utils";

interface TimeAgoProps {
	timestamp: number;
}

export default function TimeAgo({ timestamp }: TimeAgoProps) {
	const [text, setText] = useState(() => formatRelativeTime(timestamp));

	useEffect(() => {
		const interval = setInterval(() => {
			setText(formatRelativeTime(timestamp));
		}, 60_000);
		return () => clearInterval(interval);
	}, [timestamp]);

	return <span title={new Date(timestamp).toLocaleString()}>{text}</span>;
}
