import React from "react";

type AgentAvatarProps = {
	name: string;
	avatar?: string;
	size?: number;
	className?: string;
};

/** Simple string hash → unsigned 32-bit integer */
function hashName(name: string): number {
	let h = 0;
	for (let i = 0; i < name.length; i++) {
		h = ((h << 5) - h + name.charCodeAt(i)) | 0;
	}
	return h >>> 0;
}

/** Generate a deterministic 5×5 symmetric pixel grid SVG from a name */
function generatePixelAvatar(name: string, size: number): React.ReactElement {
	const hash = hashName(name);
	// Derive two colors from the hash
	const hue1 = hash % 360;
	const hue2 = (hash * 7 + 137) % 360;
	const bg = `hsl(${hue1}, 45%, 25%)`;
	const fg = `hsl(${hue2}, 65%, 60%)`;

	// Build a 5×5 grid, mirrored horizontally (columns 0-2 determine 3-4)
	const pixels: boolean[][] = [];
	let bits = hash;
	for (let y = 0; y < 5; y++) {
		const row: boolean[] = [];
		for (let x = 0; x < 3; x++) {
			row.push((bits & 1) === 1);
			bits = ((bits >>> 1) | ((bits & 1) << 31)) ^ (bits * 2654435761);
			bits = bits >>> 0;
		}
		// Mirror: col 3 = col 1, col 4 = col 0
		row.push(row[1]);
		row.push(row[0]);
		pixels.push(row);
	}

	const rects: React.ReactElement[] = [];
	for (let y = 0; y < 5; y++) {
		for (let x = 0; x < 5; x++) {
			if (pixels[y][x]) {
				rects.push(
					<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fg} />
				);
			}
		}
	}

	return (
		<svg
			width={size}
			height={size}
			viewBox="0 0 5 5"
			xmlns="http://www.w3.org/2000/svg"
			style={{ borderRadius: "50%", background: bg, display: "block" }}
		>
			{rects}
		</svg>
	);
}

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

	// Deterministic pixel art from name
	return (
		<div className={className} style={{ width: size, height: size }}>
			{generatePixelAvatar(name, size)}
		</div>
	);
};

export default AgentAvatar;
