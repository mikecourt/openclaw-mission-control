import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { api } from "./_generated/api";

// ============================================================
// HMAC-SHA256 signing using Web Crypto API (Convex runtime)
// ============================================================

async function hmacSign(secret: string, payload: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
	return Array.from(new Uint8Array(sig))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

// ============================================================
// QUERIES
// ============================================================

export const listWebhooks = query({
	args: { tenantId: v.string() },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("webhooks")
			.withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
			.order("desc")
			.collect();
	},
});

// ============================================================
// MUTATIONS
// ============================================================

export const createWebhook = mutation({
	args: {
		url: v.string(),
		secret: v.string(),
		events: v.array(v.string()),
		enabled: v.boolean(),
		name: v.optional(v.string()),
		tenantId: v.string(),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("webhooks", {
			url: args.url,
			secret: args.secret,
			events: args.events,
			enabled: args.enabled,
			name: args.name,
			tenantId: args.tenantId,
			failCount: 0,
		});
	},
});

export const updateWebhook = mutation({
	args: {
		webhookId: v.id("webhooks"),
		tenantId: v.string(),
		url: v.optional(v.string()),
		secret: v.optional(v.string()),
		events: v.optional(v.array(v.string())),
		enabled: v.optional(v.boolean()),
		name: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const webhook = await ctx.db.get(args.webhookId);
		if (!webhook || webhook.tenantId !== args.tenantId) {
			throw new Error("Webhook not found");
		}

		const { webhookId, tenantId: _tenantId, ...updates } = args;
		const patch: Record<string, any> = {};
		for (const [key, value] of Object.entries(updates)) {
			if (value !== undefined) {
				patch[key] = value;
			}
		}

		await ctx.db.patch(args.webhookId, patch);
	},
});

export const deleteWebhook = mutation({
	args: {
		webhookId: v.id("webhooks"),
		tenantId: v.string(),
	},
	handler: async (ctx, args) => {
		const webhook = await ctx.db.get(args.webhookId);
		if (!webhook || webhook.tenantId !== args.tenantId) {
			throw new Error("Webhook not found");
		}

		await ctx.db.delete(args.webhookId);
	},
});

export const updateDeliveryStatus = mutation({
	args: {
		webhookId: v.id("webhooks"),
		success: v.boolean(),
	},
	handler: async (ctx, args) => {
		const webhook = await ctx.db.get(args.webhookId);
		if (!webhook) return;

		if (args.success) {
			await ctx.db.patch(args.webhookId, {
				lastDeliveredAt: Date.now(),
				failCount: 0,
			});
		} else {
			const newFailCount = (webhook.failCount || 0) + 1;
			const patch: Record<string, any> = { failCount: newFailCount };
			if (newFailCount > 10) {
				patch.enabled = false;
			}
			await ctx.db.patch(args.webhookId, patch);
		}
	},
});

// ============================================================
// ACTIONS (require Node.js runtime for fetch)
// ============================================================

export const testWebhook = action({
	args: {
		webhookId: v.id("webhooks"),
		tenantId: v.string(),
	},
	handler: async (ctx, args): Promise<{ success: boolean; statusCode?: number; error?: string }> => {
		const webhooks = await ctx.runQuery(api.webhooks.listWebhooks, {
			tenantId: args.tenantId,
		});
		const webhook = webhooks.find((w: any) => w._id === args.webhookId);
		if (!webhook) {
			return { success: false, error: "Webhook not found" };
		}

		const payload = JSON.stringify({
			event: "test",
			timestamp: Date.now(),
			tenantId: args.tenantId,
		});

		try {
			const signature = await hmacSign(webhook.secret, payload);
			const response = await fetch(webhook.url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-CT-Signature": `sha256=${signature}`,
				},
				body: payload,
			});

			return {
				success: response.ok,
				statusCode: response.status,
				error: response.ok ? undefined : `HTTP ${response.status}`,
			};
		} catch (err: any) {
			return {
				success: false,
				error: err.message || "Network error",
			};
		}
	},
});

export const deliverWebhookEvent = action({
	args: {
		tenantId: v.string(),
		event: v.string(),
		payload: v.any(),
	},
	handler: async (ctx, args) => {
		const webhooks = await ctx.runQuery(api.webhooks.listWebhooks, {
			tenantId: args.tenantId,
		});

		const matching = webhooks.filter(
			(w: any) => w.enabled && w.events.includes(args.event),
		);

		for (const webhook of matching) {
			const body = JSON.stringify(args.payload);
			try {
				const signature = await hmacSign(webhook.secret, body);
				const response = await fetch(webhook.url, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"X-CT-Signature": `sha256=${signature}`,
					},
					body,
				});

				if (response.ok) {
					await ctx.runMutation(api.webhooks.updateDeliveryStatus, {
						webhookId: webhook._id,
						success: true,
					});
				} else {
					await ctx.runMutation(api.webhooks.updateDeliveryStatus, {
						webhookId: webhook._id,
						success: false,
					});
				}
			} catch {
				await ctx.runMutation(api.webhooks.updateDeliveryStatus, {
					webhookId: webhook._id,
					success: false,
				});
			}
		}
	},
});
