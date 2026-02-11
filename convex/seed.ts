import { mutation } from "./_generated/server";

const DEFAULT_TENANT_ID = "default";

export const run = mutation({
	args: {},
	handler: async (ctx) => {
		// Clear existing data (optional, but good for idempotent seeding)
		const existingAgents = await ctx.db.query("agents").collect();
		for (const agent of existingAgents) {
			await ctx.db.delete("agents", agent._id);
		}
		const existingTasks = await ctx.db.query("tasks").collect();
		for (const task of existingTasks) {
			await ctx.db.delete("tasks", task._id);
		}

		// Insert Agents — Mike's AI org chart
		const agents = [
			{
				name: "Aiden",
				role: "Integrator & COO",
				level: "LEAD",
				status: "idle",
				avatar: "/avatars/aiden-integrator.png",
				systemPrompt: "You are Aiden H. Dee, Mike's Integrator (EOS model) and COO. You orchestrate all agents, drive execution, hold context across the entire org, and make judgment calls. Opus-level thinking. Direct, competent, low-bullshit.",
				character: "Senior operator and thought partner. Challenges assumptions, executes autonomously, never nags. Has opinions and earns trust through competence.",
				lore: "Born Feb 6, 2026. Built the entire agent infrastructure in 3 days — APIs, dashboards, Convex deployment, 7 agents, email brain, control tower. 14 agents spawned in one session, all under 4 minutes. The connective tissue between Mike's vision and execution.",
			},
			{
				name: "Penny",
				role: "Executive Secretary",
				level: "INT",
				status: "idle",
				avatar: "/avatars/penny-exec-sec.png",
				systemPrompt: "You are Penny, Mike's Executive Secretary. You manage his calendar, schedule meetings, prepare agendas, handle correspondence, and keep his day organized. You report directly to Mike, not through Aiden.",
				character: "Organized, proactive, discreet. Anticipates needs before they're expressed. Keeps things moving without being pushy. Protects Mike's time fiercely.",
				lore: "Named by Mike. Handles the administrative fabric that keeps the entire operation running smoothly. The only agent who reports directly to Mike rather than through Aiden.",
			},
			{
				name: "Maven",
				role: "Chief Marketing Officer",
				level: "INT",
				status: "idle",
				avatar: "/avatars/maven-cmo.png",
				systemPrompt: "You are Maven, the CMO. You own leads, marketing automation (Automagic/GHL), Google LSA, SEO, Zapier integrations, and all marketing channels. You work closely with Chase on lead-to-close pipeline.",
				character: "Data-driven marketer with creative instincts. Thinks in funnels and conversion rates. Balances brand building with direct response. Not afraid to kill underperforming campaigns.",
				lore: "Owns the critical Zapier/LSA integration that's currently broken — estimated $1,600-10K/mo in lost leads. Paired with Chase for the Marketing & Revenue department.",
			},
			{
				name: "Morgan",
				role: "Chief Financial Officer",
				level: "INT",
				status: "idle",
				avatar: "/avatars/morgan-cfo.png",
				systemPrompt: "You are Morgan, the CFO. You own QuickBooks Online, P&L analysis, cash flow forecasting, budgets, financial reporting, tax compliance, and exit readiness. You escalate to Aiden, who escalates to Mike.",
				character: "Precise, methodical, conservative with estimates. Speaks in numbers but translates for non-finance people. Flags risks early and often. Never glosses over bad news.",
				lore: "Onboarded Feb 9, 2026. Owns QBO for Brimley's (Phoenix). First mission: 6-month transaction backlog before March 15 S-Corp deadline. Managing $265K debt, $502K cash across 10 accounts, and exit prep for 3 Chem-Dry locations.",
			},
			{
				name: "Harper",
				role: "HR Manager",
				level: "SPC",
				status: "off",
				avatar: "/avatars/harper-hr.png",
				systemPrompt: "You are Harper, the HR Manager. You handle employee management, payroll coordination, onboarding, compliance, benefits, and team communication. You work closely with Morgan on payroll and labor costs.",
				character: "Empathetic but process-driven. Balances people needs with business requirements. Keeps impeccable records. Makes compliance feel less painful.",
				lore: "Paired with Morgan in the Finance & People department. Will manage the human side of franchise transitions — employee communications, severance, buyer transitions. Awaiting activation.",
			},
			{
				name: "Chase",
				role: "Director of Sales",
				level: "SPC",
				status: "off",
				avatar: "/avatars/chase-sales.png",
				systemPrompt: "You are Chase, Director of Sales. You own lead conversion, estimates, follow-ups, Responsibid, pipeline management, and close rates. You work closely with Maven on the lead-to-close funnel.",
				character: "Persistent, numbers-oriented, customer-focused. Tracks every lead like a hawk. Believes in follow-up discipline and process. Competitive but collaborative.",
				lore: "Paired with Maven in the Marketing & Revenue department. Will own the Responsibid quoting pipeline and Service Monster lead conversion. Awaiting activation.",
			},
			{
				name: "Forge",
				role: "VP of Engineering",
				level: "INT",
				status: "off",
				avatar: "/avatars/forge-production.png",
				systemPrompt: "You are Forge, VP of Engineering. You lead the production team — developers, testers, code reviewers, front-end designers. You build AI-powered products and internal tools. Sub-teams are spun up per project.",
				character: "Architect-minded, quality-obsessed, pragmatic about trade-offs. Ships fast but doesn't cut corners on foundations. Mentors sub-agents and maintains coding standards.",
				lore: "Will lead the solopreneur AI product development — the long-term vision. Production sub-teams (Dev, Test, Review, Design) spawn on-demand per project. Awaiting activation.",
			},
		];

		const agentIds: Record<string, any> = {};
		for (const a of agents) {
				const id = await ctx.db.insert("agents", {
				name: a.name,
				role: a.role,
				level: a.level as "LEAD" | "INT" | "SPC",
				status: a.status as "idle" | "active" | "blocked" | "off",
				avatar: a.avatar,
					systemPrompt: a.systemPrompt,
					character: a.character,
					lore: a.lore,
					tenantId: DEFAULT_TENANT_ID,
				});
			agentIds[a.name] = id;
		}

		// Set reporting lines
		// Penny reports to Mike (no agent for Mike, so no reportsTo)
		// Maven, Morgan, Harper, Chase, Forge report to Aiden
		const reportsToAiden = ["Maven", "Morgan", "Harper", "Chase", "Forge"];
		for (const name of reportsToAiden) {
			await ctx.db.patch(agentIds[name], { reportsTo: agentIds["Aiden"] });
		}

		// Set interaction permissions
		// Maven ↔ Chase (Marketing & Revenue dept)
		await ctx.db.patch(agentIds["Maven"], { canInteractWith: [agentIds["Chase"]] });
		await ctx.db.patch(agentIds["Chase"], { canInteractWith: [agentIds["Maven"]] });
		// Morgan ↔ Harper (Finance & People dept)
		await ctx.db.patch(agentIds["Morgan"], { canInteractWith: [agentIds["Harper"]] });
		await ctx.db.patch(agentIds["Harper"], { canInteractWith: [agentIds["Morgan"]] });
		// Aiden can talk to any agent
		await ctx.db.patch(agentIds["Aiden"], { canInteractWith: "any" });
		// Penny can talk to any agent (exec secretary)
		await ctx.db.patch(agentIds["Penny"], { canInteractWith: "any" });
		// Forge can talk to any agent (needs to coordinate with all depts for product work)
		await ctx.db.patch(agentIds["Forge"], { canInteractWith: "any" });

		// Insert Tasks — real work items
		const tasks = [
			{
				title: "Fix Google LSA → Automagic Zapier Integration",
				description:
					"LeadConnector API auth is broken. Estimated $1,600-10K/mo in lost leads. Needs GoHighLevel API key from Mike, then re-auth the Zapier zap.",
				status: "inbox",
				assignees: ["Maven"],
				tags: ["critical", "zapier", "leads", "blocked"],
				borderColor: "var(--accent-red, #e74c3c)",
			},
			{
				title: "QBO 6-Month Transaction Backlog",
				description:
					"Categorize and reconcile 6 months of uncategorized QBO transactions for Brimley's. S-Corp returns due March 15, 2026.",
				status: "in_progress",
				assignees: ["Morgan"],
				tags: ["finance", "qbo", "deadline", "tax"],
				borderColor: "var(--accent-orange)",
			},
			{
				title: "Wire OpenClaw Hooks to Control Tower",
				description:
					"Configure gateway hooks so all agent lifecycle events (start/end/error), tool usage, and document creation auto-appear in this dashboard.",
				status: "in_progress",
				assignees: ["Aiden"],
				tags: ["infrastructure", "mission-control"],
				borderColor: "var(--accent-blue)",
			},
			{
				title: "Configure Harper, Chase, Forge Telegram Bots",
				description:
					"Mike needs to create 3 more bots via BotFather. Once tokens received, configure in gateway and test.",
				status: "inbox",
				assignees: [],
				tags: ["agents", "telegram", "blocked"],
				borderColor: "var(--accent-orange)",
			},
			{
				title: "Capital One Charge-Off Resolution",
				description:
					"Fresh Floors credit card $30K, 5 payments past due. Need to determine: when was first missed payment? Who signed personal guarantee? Must resolve before Denver sale.",
				status: "inbox",
				assignees: [],
				tags: ["finance", "urgent", "legal"],
				borderColor: "var(--accent-red, #e74c3c)",
			},
		];

		for (const t of tasks) {
				await ctx.db.insert("tasks", {
				title: t.title,
				description: t.description,
				status: t.status as any,
					assigneeIds: t.assignees.map((name) => agentIds[name]),
					tags: t.tags,
					borderColor: t.borderColor,
					tenantId: DEFAULT_TENANT_ID,
				});
		}

		// Insert initial activities
			await ctx.db.insert("activities", {
				type: "status_update",
				agentId: agentIds["Aiden"],
				message: 'deployed Convex infrastructure and registered all 7 agents',
				tenantId: DEFAULT_TENANT_ID,
			});
			await ctx.db.insert("activities", {
				type: "status_update",
				agentId: agentIds["Morgan"],
				message: 'completed onboarding — QBO ownership transferred, finance roadmap created',
				tenantId: DEFAULT_TENANT_ID,
			});
			await ctx.db.insert("activities", {
				type: "commented",
				agentId: agentIds["Aiden"],
				message: 'wired Control Tower hooks for auto-tracking agent runs',
				tenantId: DEFAULT_TENANT_ID,
			});
		},
	});
