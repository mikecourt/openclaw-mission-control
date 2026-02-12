import { useState, useMemo } from "react";
import { IconChevronUp, IconChevronDown, IconSelector } from "@tabler/icons-react";

interface Column<T> {
	key: string;
	label: string;
	render?: (row: T) => React.ReactNode;
	sortable?: boolean;
	width?: string;
}

interface DataTableProps<T> {
	columns: Column<T>[];
	data: T[];
	onRowClick?: (row: T) => void;
	getRowKey: (row: T) => string;
	emptyMessage?: string;
}

export default function DataTable<T>({
	columns,
	data,
	onRowClick,
	getRowKey,
	emptyMessage = "No data",
}: DataTableProps<T>) {
	const [sortKey, setSortKey] = useState<string | null>(null);
	const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

	const handleSort = (key: string) => {
		if (sortKey === key) {
			setSortDir((d) => (d === "asc" ? "desc" : "asc"));
		} else {
			setSortKey(key);
			setSortDir("asc");
		}
	};

	const sorted = useMemo(() => {
		if (!sortKey) return data;
		return [...data].sort((a, b) => {
			const aVal = (a as Record<string, unknown>)[sortKey];
			const bVal = (b as Record<string, unknown>)[sortKey];
			if (aVal == null && bVal == null) return 0;
			if (aVal == null) return 1;
			if (bVal == null) return -1;
			if (typeof aVal === "string" && typeof bVal === "string") {
				return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
			}
			const diff = (aVal as number) - (bVal as number);
			return sortDir === "asc" ? diff : -diff;
		});
	}, [data, sortKey, sortDir]);

	if (data.length === 0) {
		return (
			<div style={{ padding: 32, textAlign: "center", color: "var(--mc-text-muted)", fontSize: 13 }}>
				{emptyMessage}
			</div>
		);
	}

	return (
		<table className="data-table">
			<thead>
				<tr>
					{columns.map((col) => (
						<th
							key={col.key}
							onClick={col.sortable !== false ? () => handleSort(col.key) : undefined}
							style={{
								width: col.width,
								cursor: col.sortable !== false ? "pointer" : "default",
							}}
						>
							<span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
								{col.label}
								{col.sortable !== false &&
									(sortKey === col.key ? (
										sortDir === "asc" ? (
											<IconChevronUp size={12} />
										) : (
											<IconChevronDown size={12} />
										)
									) : (
										<IconSelector size={12} style={{ opacity: 0.3 }} />
									))}
							</span>
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{sorted.map((row) => (
					<tr
						key={getRowKey(row)}
						onClick={onRowClick ? () => onRowClick(row) : undefined}
						style={onRowClick ? { cursor: "pointer" } : undefined}
					>
						{columns.map((col) => (
							<td key={col.key}>
								{col.render
									? col.render(row)
									: String((row as Record<string, unknown>)[col.key] ?? "")}
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
}
