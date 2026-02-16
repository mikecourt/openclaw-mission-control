import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { DEFAULT_TENANT_ID } from "../lib/tenant";
import MetricCard from "../components/shared/MetricCard";
import { formatCost } from "../lib/utils";

export default function SettingsPage() {
	const usageSummary = useQuery(api.queries.getUsageSummary, { tenantId: DEFAULT_TENANT_ID });
	const allSettings = useQuery(api.systemSettings.getAllSettings, { tenantId: DEFAULT_TENANT_ID });
	const setSetting = useMutation(api.systemSettings.setSetting);
	const purgeOldTasks = useMutation(api.systemSettings.purgeOldTasks);

	const [opusBudget, setOpusBudget] = useState(45);
	const [retentionDays, setRetentionDays] = useState(30);
	const [saving, setSaving] = useState(false);
	const [purging, setPurging] = useState(false);
	const [purgeResult, setPurgeResult] = useState<string | null>(null);

	// Webhooks
	const webhooks = useQuery(api.webhooks.listWebhooks, { tenantId: DEFAULT_TENANT_ID });
	const createWebhook = useMutation(api.webhooks.createWebhook);
	const deleteWebhookMut = useMutation(api.webhooks.deleteWebhook);
	const testWebhookAction = useAction(api.webhooks.testWebhook);

	const [newWebhookUrl, setNewWebhookUrl] = useState("");
	const [newWebhookSecret, setNewWebhookSecret] = useState(() => crypto.randomUUID());
	const [newWebhookName, setNewWebhookName] = useState("");
	const [newWebhookEvents, setNewWebhookEvents] = useState<string[]>(["task_failed", "risk_signal"]);
	const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
	const [testResult, setTestResult] = useState<string | null>(null);

	const WEBHOOK_EVENTS = ["task_completed", "task_failed", "risk_signal", "budget_threshold", "agent_blocked"];

	// Initialize from settings
	const opusBudgetSetting = allSettings?.find((s) => s.key === "opusBudget");

	const handleSaveSettings = async () => {
		setSaving(true);
		try {
			await setSetting({ tenantId: DEFAULT_TENANT_ID, key: "opusBudget", value: opusBudget });
			await setSetting({ tenantId: DEFAULT_TENANT_ID, key: "retentionDays", value: retentionDays });
		} finally {
			setSaving(false);
		}
	};

	const handlePurge = async () => {
		setPurging(true);
		setPurgeResult(null);
		try {
			const result = await purgeOldTasks({ tenantId: DEFAULT_TENANT_ID, olderThanDays: retentionDays });
			setPurgeResult(`Purged ${result.purged} old tasks`);
		} finally {
			setPurging(false);
		}
	};

	const handleExport = () => {
		const data = { usageSummary, settings: allSettings, exportedAt: new Date().toISOString() };
		const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `control-tower-export-${new Date().toISOString().split("T")[0]}.json`;
		a.click();
		URL.revokeObjectURL(url);
	};

	const handleCreateWebhook = async () => {
		if (!newWebhookUrl) return;
		await createWebhook({
			url: newWebhookUrl,
			secret: newWebhookSecret,
			events: newWebhookEvents,
			enabled: true,
			name: newWebhookName || undefined,
			tenantId: DEFAULT_TENANT_ID,
		});
		setNewWebhookUrl("");
		setNewWebhookSecret(crypto.randomUUID());
		setNewWebhookName("");
		setNewWebhookEvents(["task_failed", "risk_signal"]);
	};

	const handleTestWebhook = async (webhookId: string) => {
		setTestingWebhook(webhookId);
		setTestResult(null);
		try {
			const result = await testWebhookAction({ webhookId: webhookId as any, tenantId: DEFAULT_TENANT_ID });
			setTestResult(result.success ? "Success!" : `Failed: ${result.error}`);
		} catch (e: any) {
			setTestResult(`Error: ${e.message}`);
		} finally {
			setTestingWebhook(null);
		}
	};

	const handleDeleteWebhook = async (webhookId: string) => {
		await deleteWebhookMut({ webhookId: webhookId as any, tenantId: DEFAULT_TENANT_ID });
	};

	const toggleEvent = (evt: string) => {
		setNewWebhookEvents((prev) =>
			prev.includes(evt) ? prev.filter((e) => e !== evt) : [...prev, evt]
		);
	};

	return (
		<div>
			<div className="page-header">
				<h1>Settings</h1>
			</div>

			{/* System parameters */}
			<div className="metric-card" style={{ marginBottom: 16 }}>
				<div className="metric-label" style={{ marginBottom: 12 }}>System Parameters</div>
				<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
					<div>
						<label style={{ fontSize: 12, color: "var(--mc-text-muted)", display: "block", marginBottom: 4 }}>
							Opus Daily Budget ($)
						</label>
						<input
							type="number"
							value={opusBudget}
							onChange={(e) => setOpusBudget(Number(e.target.value))}
							style={{
								width: "100%",
								padding: "8px 12px",
								background: "var(--mc-bg-primary)",
								border: "1px solid var(--mc-border)",
								borderRadius: 6,
								color: "var(--mc-text-primary)",
								fontSize: 13,
							}}
						/>
					</div>
					<div>
						<label style={{ fontSize: 12, color: "var(--mc-text-muted)", display: "block", marginBottom: 4 }}>
							Task Retention (days)
						</label>
						<input
							type="number"
							value={retentionDays}
							onChange={(e) => setRetentionDays(Number(e.target.value))}
							style={{
								width: "100%",
								padding: "8px 12px",
								background: "var(--mc-bg-primary)",
								border: "1px solid var(--mc-border)",
								borderRadius: 6,
								color: "var(--mc-text-primary)",
								fontSize: 13,
							}}
						/>
					</div>
					<div style={{ display: "flex", alignItems: "flex-end" }}>
						<button
							className="btn-primary"
							type="button"
							onClick={handleSaveSettings}
							disabled={saving}
							style={{ width: "100%" }}
						>
							{saving ? "Saving..." : "Save Settings"}
						</button>
					</div>
				</div>
				{opusBudgetSetting && (
					<div style={{ fontSize: 11, color: "var(--mc-text-muted)", marginTop: 8 }}>
						Last saved: {new Date(opusBudgetSetting.updatedAt).toLocaleString()}
					</div>
				)}
			</div>

			{/* API Status */}
			<div className="metric-card" style={{ marginBottom: 16 }}>
				<div className="metric-label" style={{ marginBottom: 12 }}>API Providers</div>
				<table className="data-table">
					<thead>
						<tr>
							<th>Provider</th>
							<th>Status</th>
							<th>Plan</th>
							<th>Notes</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>Anthropic (Claude Max)</td>
							<td>
								<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
									<span className="status-dot" style={{ backgroundColor: "var(--mc-status-ok)" }} />
									Connected
								</span>
							</td>
							<td style={{ fontSize: 12 }}>$200/mo</td>
							<td style={{ fontSize: 12, color: "var(--mc-text-muted)" }}>Consumer plan (OAuth)</td>
						</tr>
						<tr>
							<td>Convex</td>
							<td>
								<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
									<span className="status-dot" style={{ backgroundColor: "var(--mc-status-ok)" }} />
									Connected
								</span>
							</td>
							<td style={{ fontSize: 12 }}>Free tier</td>
							<td style={{ fontSize: 12, color: "var(--mc-text-muted)" }}>Dev deployment</td>
						</tr>
						<tr>
							<td>GoHighLevel</td>
							<td>
								<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
									<span className="status-dot" style={{ backgroundColor: "var(--mc-status-ok)" }} />
									Connected
								</span>
							</td>
							<td style={{ fontSize: 12 }}>Agency</td>
							<td style={{ fontSize: 12, color: "var(--mc-text-muted)" }}>CRM + automation</td>
						</tr>
					</tbody>
				</table>
			</div>

			{/* Current settings */}
			{allSettings && allSettings.length > 0 && (
				<div className="metric-card" style={{ marginBottom: 16 }}>
					<div className="metric-label" style={{ marginBottom: 12 }}>Stored Settings</div>
					<table className="data-table">
						<thead>
							<tr>
								<th>Key</th>
								<th>Value</th>
								<th>Updated</th>
							</tr>
						</thead>
						<tbody>
							{allSettings.map((s) => (
								<tr key={s._id}>
									<td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{s.key}</td>
									<td style={{ fontSize: 12 }}>{JSON.stringify(s.value)}</td>
									<td style={{ fontSize: 12, color: "var(--mc-text-muted)" }}>
										{new Date(s.updatedAt).toLocaleString()}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{/* Webhooks */}
			<div className="metric-card" style={{ marginBottom: 16 }}>
				<div className="metric-label" style={{ marginBottom: 12 }}>Webhooks</div>

				{/* Existing webhooks table */}
				{webhooks && webhooks.length > 0 && (
					<table className="data-table" style={{ marginBottom: 16 }}>
						<thead>
							<tr>
								<th>Name</th>
								<th>URL</th>
								<th>Events</th>
								<th>Status</th>
								<th>Last Delivered</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{webhooks.map((w) => (
								<tr key={w._id}>
									<td style={{ fontSize: 12 }}>{w.name || "—"}</td>
									<td style={{ fontSize: 12, fontFamily: "var(--font-mono)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
										{w.url}
									</td>
									<td style={{ fontSize: 11 }}>{w.events.join(", ")}</td>
									<td>
										<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
											<span className="status-dot" style={{ backgroundColor: w.enabled ? "var(--mc-status-ok)" : "var(--mc-status-error)" }} />
											{w.enabled ? "Active" : "Disabled"}
											{(w.failCount ?? 0) > 0 && (
												<span style={{ fontSize: 10, color: "var(--mc-status-warn)" }}>({w.failCount} fails)</span>
											)}
										</span>
									</td>
									<td style={{ fontSize: 12, color: "var(--mc-text-muted)" }}>
										{w.lastDeliveredAt ? new Date(w.lastDeliveredAt).toLocaleString() : "Never"}
									</td>
									<td>
										<div style={{ display: "flex", gap: 4 }}>
											<button
												className="btn-secondary"
												style={{ fontSize: 11, padding: "2px 8px" }}
												onClick={() => handleTestWebhook(w._id)}
												disabled={testingWebhook === w._id}
											>
												{testingWebhook === w._id ? "..." : "Test"}
											</button>
											<button
												className="btn-secondary"
												style={{ fontSize: 11, padding: "2px 8px", color: "var(--mc-status-error)" }}
												onClick={() => handleDeleteWebhook(w._id)}
											>
												Delete
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}

				{testResult && (
					<div style={{ fontSize: 12, marginBottom: 12, color: testResult.startsWith("Success") ? "var(--mc-status-ok)" : "var(--mc-status-error)" }}>
						{testResult}
					</div>
				)}

				{/* Add webhook form */}
				<div style={{ borderTop: "1px solid var(--mc-border)", paddingTop: 12 }}>
					<div style={{ fontSize: 12, color: "var(--mc-text-muted)", marginBottom: 8 }}>Add Webhook</div>
					<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
						<div>
							<label style={{ fontSize: 11, color: "var(--mc-text-muted)", display: "block", marginBottom: 4 }}>URL</label>
							<input
								type="url"
								value={newWebhookUrl}
								onChange={(e) => setNewWebhookUrl(e.target.value)}
								placeholder="https://example.com/webhook"
								style={{
									width: "100%",
									padding: "6px 10px",
									background: "var(--mc-bg-primary)",
									border: "1px solid var(--mc-border)",
									borderRadius: 6,
									color: "var(--mc-text-primary)",
									fontSize: 12,
								}}
							/>
						</div>
						<div>
							<label style={{ fontSize: 11, color: "var(--mc-text-muted)", display: "block", marginBottom: 4 }}>Name</label>
							<input
								type="text"
								value={newWebhookName}
								onChange={(e) => setNewWebhookName(e.target.value)}
								placeholder="My Webhook"
								style={{
									width: "100%",
									padding: "6px 10px",
									background: "var(--mc-bg-primary)",
									border: "1px solid var(--mc-border)",
									borderRadius: 6,
									color: "var(--mc-text-primary)",
									fontSize: 12,
								}}
							/>
						</div>
						<div>
							<label style={{ fontSize: 11, color: "var(--mc-text-muted)", display: "block", marginBottom: 4 }}>Secret</label>
							<input
								type="text"
								value={newWebhookSecret}
								readOnly
								style={{
									width: "100%",
									padding: "6px 10px",
									background: "var(--mc-bg-primary)",
									border: "1px solid var(--mc-border)",
									borderRadius: 6,
									color: "var(--mc-text-muted)",
									fontSize: 11,
									fontFamily: "var(--font-mono)",
								}}
							/>
						</div>
					</div>
					<div style={{ marginBottom: 12 }}>
						<label style={{ fontSize: 11, color: "var(--mc-text-muted)", display: "block", marginBottom: 4 }}>Events</label>
						<div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
							{WEBHOOK_EVENTS.map((evt) => (
								<label key={evt} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
									<input
										type="checkbox"
										checked={newWebhookEvents.includes(evt)}
										onChange={() => toggleEvent(evt)}
									/>
									{evt}
								</label>
							))}
						</div>
					</div>
					<button
						className="btn-primary"
						onClick={handleCreateWebhook}
						disabled={!newWebhookUrl}
						style={{ fontSize: 12 }}
					>
						Add Webhook
					</button>
				</div>
			</div>

			{/* Data Management */}
			<div className="metric-card">
				<div className="metric-label" style={{ marginBottom: 12 }}>Data Management</div>
				{usageSummary && (
					<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
						<MetricCard label="Total Cost" value={formatCost(usageSummary.totalCost)} />
						<MetricCard label="Usage Records" value={usageSummary.recordCount} />
						<MetricCard label="MTD Cost" value={formatCost(usageSummary.mtdCost)} />
					</div>
				)}
				<div style={{ display: "flex", gap: 8, alignItems: "center" }}>
					<button
						className="btn-secondary"
						type="button"
						onClick={handlePurge}
						disabled={purging}
					>
						{purging ? "Purging..." : `Purge Tasks > ${retentionDays} days`}
					</button>
					<button className="btn-secondary" type="button" onClick={handleExport}>
						Export Data
					</button>
					{purgeResult && (
						<span style={{ fontSize: 12, color: "var(--mc-status-ok)" }}>{purgeResult}</span>
					)}
				</div>
			</div>
		</div>
	);
}
