#!/usr/bin/env node
/**
 * lararium-mcp stdio adapter — STUB.
 * Schema: lar:///ha.ka.ba/api/v0.1/lararium/mcp/tool-registry
 *
 * Intent: operator-agent alignment surface over MCP stdio transport.
 * Every tool maps to something the operator can see or do on the canvas.
 *
 * OODA-HA tool surface (names and descriptions preserved; implementations pending):
 *   ✶ Observe  — lararium-hud, lararium-canvas
 *   ⏿ Orient   — lararium-read, lararium-inspect, lararium-query, lararium-edges
 *   ◇ Decide   — lararium-draft
 *   ▶ Act      — lararium-write, lararium-fire
 *   ⤴ Aftermath — lararium-receipt
 *
 * Redesign target: implementations should route through the live Automerge
 * meme-store (via LARARIUM_HTTP_URL) rather than reading lares/ directly.
 * The canvas bridge (fetchCanvas) and write gate (LARARIUM_WRITE_MODE) patterns
 * remain valid; the runtime backing changes.
 *
 * Live canvas bridge: set LARARIUM_HTTP_URL=http://127.0.0.1:4321
 * Write gate:        set LARARIUM_WRITE_MODE=enabled  (default: dry-run only)
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Canvas bridge — optional live server connection
// ---------------------------------------------------------------------------

const CANVAS_HTTP = process.env["LARARIUM_HTTP_URL"]?.replace(/\/$/, "") ?? null;
const WRITE_ENABLED = process.env["LARARIUM_WRITE_MODE"] === "enabled";

// stub fetch — real implementation routes through live Automerge server
async function fetchCanvas<T = unknown>(_path: string, _opts?: RequestInit): Promise<T> {
  if (!CANVAS_HTTP) throw new Error("LARARIUM_HTTP_URL not set");
  throw new Error("fetchCanvas: not implemented — pending Automerge-native MCP redesign");
}

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------

const server = new McpServer({ name: "lararium", version: "0.1.0" });

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

server.registerResource(
  "lar-resource",
  "lar:///{path}",
  { title: "Lararium carrier — raw memetic wikitext for a lar:/// URI" },
  async (_uri) => {
    throw new Error("lar-resource: not implemented — pending Automerge-native MCP redesign");
  },
);

server.registerResource(
  "lararium-boot",
  "lar:///boot",
  { title: "Boot artifact — full boot closure JSON" },
  async () => {
    throw new Error("lararium-boot: not implemented — pending Automerge-native MCP redesign");
  },
);

server.registerResource(
  "lararium-boot-receipt",
  "lar:///boot/receipt",
  { title: "Boot receipt — SHA256 identity hash of the live closure" },
  async () => {
    throw new Error("lararium-boot-receipt: not implemented — pending Automerge-native MCP redesign");
  },
);

server.registerResource(
  "lararium-indexes-carriers",
  "lar:///INDEXES/carriers",
  { title: "All carrier URIs in the meme store" },
  async () => {
    throw new Error("lararium-indexes-carriers: not implemented — pending Automerge-native MCP redesign");
  },
);

server.registerResource(
  "lararium-indexes-interfaces",
  "lar:///INDEXES/interfaces",
  { title: "Interface → implementors index" },
  async () => {
    throw new Error("lararium-indexes-interfaces: not implemented — pending Automerge-native MCP redesign");
  },
);

// ---------------------------------------------------------------------------
// ✶ Observe — lararium-hud
// ---------------------------------------------------------------------------

server.registerTool(
  "lararium-hud",
  {
    description:
      "Full operator-agent alignment snapshot. Call this first to orient.\n\n" +
      "Returns: boot closure summary, validation status, invariant URIs, live canvas status.\n" +
      "If LARARIUM_HTTP_URL is set, also reports which rooms are live on the canvas server.",
    inputSchema: {},
  },
  async () => {
    throw new Error("lararium-hud: not implemented — pending Automerge-native MCP redesign");
  },
);

// ---------------------------------------------------------------------------
// ✶ Observe — lararium-canvas
// ---------------------------------------------------------------------------

server.registerTool(
  "lararium-canvas",
  {
    description:
      "Live canvas state — active rooms, meme list, connection status.\n\n" +
      "Requires LARARIUM_HTTP_URL. Use this to see what the operator currently has open.",
    inputSchema: {},
  },
  async () => {
    try {
      return { content: [{ type: "text" as const, text: JSON.stringify(await fetchCanvas("/api/rooms"), null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: `Canvas unreachable: ${String(e)}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// ⏿ Orient — lararium-read
// ---------------------------------------------------------------------------

server.registerTool(
  "lararium-read",
  {
    description: "Read the raw text of a file-backed lar:/// carrier (memetic wikitext).",
    inputSchema: { uri: z.string().describe("lar:/// URI") },
  },
  async (_args) => {
    throw new Error("lararium-read: not implemented — pending Automerge-native MCP redesign");
  },
);

// ---------------------------------------------------------------------------
// ⏿ Orient — lararium-inspect
// ---------------------------------------------------------------------------

server.registerTool(
  "lararium-inspect",
  {
    description:
      "Inspect a lar:/// carrier: metadata (confidence, mana, role), shape, implements list, outbound pranala edges.",
    inputSchema: { uri: z.string().describe("lar:/// URI") },
  },
  async (_args) => {
    throw new Error("lararium-inspect: not implemented — pending Automerge-native MCP redesign");
  },
);

// ---------------------------------------------------------------------------
// ⏿ Orient — lararium-query
// ---------------------------------------------------------------------------

server.registerTool(
  "lararium-query",
  {
    description:
      "Evaluate a TiddlyWiki5 filter expression against the current boot closure.\n\n" +
      "Examples:\n" +
      "  [all[memes]tag[lar:///ha.ka.ba/api/v0.1/pono/invariant]]\n" +
      "  [all[memes]field:depth[0]]\n" +
      "  [all[memes]nsort[depth]limit[5]]\n" +
      "  [all[memes]field:rating[data]sort[title]]\n" +
      "  [all[memes]field:role[threshold constitution]]",
    inputSchema: { expr: z.string().describe("TW5 filter expression") },
  },
  async (_args) => {
    throw new Error("lararium-query: not implemented — pending Automerge-native MCP redesign");
  },
);

// ---------------------------------------------------------------------------
// ⏿ Orient — lararium-edges
// ---------------------------------------------------------------------------

server.registerTool(
  "lararium-edges",
  {
    description:
      "List all pranala edges in the boot closure.\n\n" +
      "Each row: fromUri  fromSocket → toUri  family:role\n\n" +
      "Optionally filter by family (control | relation | observe | dataflow | message | reaction).",
    inputSchema: {
      family: z.enum(["control", "relation", "observe", "dataflow", "message", "reaction", "constraint", "spatial"])
        .optional()
        .describe("Filter by edge family"),
      from: z.string().optional().describe("Filter edges whose fromUri contains this substring"),
    },
  },
  async (_args) => {
    throw new Error("lararium-edges: not implemented — pending Automerge-native MCP redesign");
  },
);

// ---------------------------------------------------------------------------
// ◇ Decide — lararium-draft
// ---------------------------------------------------------------------------

server.registerTool(
  "lararium-draft",
  {
    description:
      "Scaffold a new meme carrier (memetic wikitext) without writing to disk.\n\n" +
      "Generates a properly structured carrier with ahu header, metadata block, and edge stubs.\n" +
      "Returns the proposed text — use lararium-write to commit it.",
    inputSchema: {
      uri: z.string().describe("Target lar:/// URI for the new carrier"),
      role: z.string().optional().describe("Role metadata value (e.g. 'invariant law', 'agent mechanic')"),
      implements: z.array(z.string()).optional().describe("URIs this carrier implements"),
      body: z.string().optional().describe("Carrier body text (defaults to placeholder)"),
    },
  },
  async (_args) => {
    throw new Error("lararium-draft: not implemented — pending Automerge-native MCP redesign");
  },
);

// ---------------------------------------------------------------------------
// ▶ Act — lararium-write
// ---------------------------------------------------------------------------

server.registerTool(
  "lararium-write",
  {
    description:
      "Write carrier text to a lares/ file.\n\n" +
      "dry_run: true (default) — preview the write, show current vs proposed text, no disk change.\n" +
      "dry_run: false — write to disk. Requires LARARIUM_WRITE_MODE=enabled env var.\n\n" +
      "After a successful write, triggers canvas reseed if LARARIUM_HTTP_URL is set.",
    inputSchema: {
      uri: z.string().describe("lar:/// URI of the carrier to write"),
      text: z.string().describe("Full carrier text (memetic wikitext)"),
      dry_run: z.boolean().optional().default(true).describe("Preview without writing (default true)"),
    },
  },
  async ({ dry_run }) => {
    if (dry_run !== false) {
      return { content: [{ type: "text" as const, text: "dry_run: lararium-write not implemented — pending Automerge-native MCP redesign" }] };
    }
    if (!WRITE_ENABLED) {
      return { content: [{ type: "text" as const, text: "Write blocked: set LARARIUM_WRITE_MODE=enabled to allow writes" }], isError: true };
    }
    throw new Error("lararium-write: not implemented — pending Automerge-native MCP redesign");
  },
);

// ---------------------------------------------------------------------------
// ▶ Act — lararium-fire
// ---------------------------------------------------------------------------

server.registerTool(
  "lararium-fire",
  {
    description:
      "Fire a named reaction event on the live canvas server.\n\n" +
      "Requires LARARIUM_HTTP_URL. The event is broadcast to all connected canvas clients.\n\n" +
      "Use this to trigger real-time reactions visible on the operator's canvas.",
    inputSchema: {
      fromUri: z.string().describe("Source meme URI"),
      trigger: z.string().describe("Event trigger name (e.g. OnReady, OnActivate, OnBegin)"),
      payload: z.record(z.unknown()).optional().describe("Event payload (arbitrary JSON object)"),
    },
  },
  async ({ fromUri, trigger, payload }) => {
    try {
      const data = await fetchCanvas("/api/fire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromUri, trigger, payload: payload ?? {} }),
      });
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: String(e) }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// ⤴ Aftermath — lararium-receipt
// ---------------------------------------------------------------------------

server.registerTool(
  "lararium-receipt",
  {
    description:
      "Compile the current boot receipt — SHA256 identity hash of the live closure.\n\n" +
      "Two receipts with the same hash mean the graph is identical. Use after a write\n" +
      "to verify the change landed, or to detect drift between agent and operator state.",
    inputSchema: {},
  },
  async () => {
    throw new Error("lararium-receipt: not implemented — pending Automerge-native MCP redesign");
  },
);

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

server.registerPrompt(
  "lararium-align",
  { description: "Bootstrap operator-agent alignment — orient the agent to the current graph state" },
  async () => {
    throw new Error("lararium-align: not implemented — pending Automerge-native MCP redesign");
  },
);

server.registerPrompt(
  "lararium-explain_uri",
  {
    description: "Explain the resolution and carrier metadata for a lar:/// URI",
    argsSchema: { uri: z.string().describe("A lar:/// URI to explain") },
  },
  (_args) => {
    throw new Error("lararium-explain_uri: not implemented — pending Automerge-native MCP redesign");
  },
);

// ---------------------------------------------------------------------------
// Connect
// ---------------------------------------------------------------------------

const transport = new StdioServerTransport();
server.connect(transport).catch((e) => { console.error(e); process.exit(1); });
