/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activityLog from "../activityLog.js";
import type * as agentMetrics from "../agentMetrics.js";
import type * as agentSync from "../agentSync.js";
import type * as agents from "../agents.js";
import type * as auth from "../auth.js";
import type * as dashboard from "../dashboard.js";
import type * as documents from "../documents.js";
import type * as escalation from "../escalation.js";
import type * as fix_loki from "../fix_loki.js";
import type * as http from "../http.js";
import type * as marketingMetrics from "../marketingMetrics.js";
import type * as messages from "../messages.js";
import type * as openclaw from "../openclaw.js";
import type * as orchestrator from "../orchestrator.js";
import type * as phase from "../phase.js";
import type * as planUsage from "../planUsage.js";
import type * as projects from "../projects.js";
import type * as queries from "../queries.js";
import type * as riskSignals from "../riskSignals.js";
import type * as seed from "../seed.js";
import type * as systemSettings from "../systemSettings.js";
import type * as tasks from "../tasks.js";
import type * as webhooks from "../webhooks.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activityLog: typeof activityLog;
  agentMetrics: typeof agentMetrics;
  agentSync: typeof agentSync;
  agents: typeof agents;
  auth: typeof auth;
  dashboard: typeof dashboard;
  documents: typeof documents;
  escalation: typeof escalation;
  fix_loki: typeof fix_loki;
  http: typeof http;
  marketingMetrics: typeof marketingMetrics;
  messages: typeof messages;
  openclaw: typeof openclaw;
  orchestrator: typeof orchestrator;
  phase: typeof phase;
  planUsage: typeof planUsage;
  projects: typeof projects;
  queries: typeof queries;
  riskSignals: typeof riskSignals;
  seed: typeof seed;
  systemSettings: typeof systemSettings;
  tasks: typeof tasks;
  webhooks: typeof webhooks;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
