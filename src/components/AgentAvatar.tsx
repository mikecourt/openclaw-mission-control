import React from "react";

type AgentAvatarProps = {
	name: string;
	avatar?: string;
	size?: number;
	className?: string;
};

const AgentAvatar: React.FC<AgentAvatarProps> = ({
	name,
	avatar,
	size = 40,
	className = "",
}) => {
	// Image URL (local path, http, or data URI)
	if (avatar && (/^\//.test(avatar) || /^https?:/.test(avatar) || /^data:/.test(avatar))) {
		return (
			<img
				src={avatar}
				alt={name}
				width={size}
				height={size}
				className={`object-cover rounded-full ${className}`}
				style={{ width: size, height: size }}
				onError={(e) => {
					// Fallback to default avatar if image fails to load
					(e.target as HTMLImageElement).src = "/avatars/default-avatar.svg";
				}}
			/>
		);
	}

	// Legacy emoji (1-4 chars)
	if (avatar && avatar.length >= 1 && avatar.length <= 4) {
		return (
			<div
				className={`bg-muted rounded-full flex items-center justify-center border border-border ${className}`}
				style={{ width: size, height: size, fontSize: size * 0.5 }}
			>
				{avatar}
			</div>
		);
	}

	// Use default avatar image instead of generated pixel art
	return (
		<img
			src="/avatars/default-avatar.svg"
			alt={name}
			width={size}
			height={size}
			className={`object-cover rounded-full ${className}`}
			style={{ width: size, height: size }}
		/>
	);
};

export default AgentAvatar;
