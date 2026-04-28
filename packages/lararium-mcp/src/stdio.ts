#!/usr/bin/env node
/**
 * lararium-mcp stdio adapter — operator-agent HUD alignment surface.
 *
 * Design principle: the agent inhabits the same space as the operator.
 * Every tool maps to something the operator can see or do on the canvas.
 *
 * OODA-HA tool surface:
 *   ✶ Observe  — lararium-hud, lararium-canvas
 *   ⏿ Orient   — lararium-read, lararium-inspect, lararium-query, lararium-edges
 *   ◇ Decide   — lararium-draft
 *   ▶ Act      — lararium-write, lararium-fire
 *   ⤴ Aftermath — lararium-receipt
 *
 * Live canvas bridge: set LARARIUM_HTTP_URL=http://127.0.0.1:4321
 * Write gate:        set LARARIUM_WRITE_MODE=enabled  (default: dry-run only)
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { createLarariumRuntime, resolveLarUri, LARES_ROOT, filterMemesTW } from "@lararium/node";

const runtime = createLarariumRuntime({ writeback: false });

// ---------------------------------------------------------------------------
// Canvas bridge — optional live server connection
// ---------------------------------------------------------------------------

const CANVAS_HTTP = process.env["LARARIUM_HTTP_URL"]?.replace(/\/$/, "") ?? null;
const WRITE_ENABLED = process.env["LARARIUM_WRITE_MODE"] === "enabled";

async function fetchCanvas<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  if (!CANVAS_HTTP) throw new Error("LARARIUM_HTTP_URL not set");
  const res = await fetch(`${CANVAS_HTTP}${path}`, opts);
  if (!res.ok) throw new Error(`canvas ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

async function canvasStatus(): Promise<{ url: string; rooms: string[]; status: "live" | "unreachable" }> {
  if (!CANVAS_HTTP) return { url: "(not configured)", rooms: [], status: "unreachable" };
  try {
    const data = await fetchCanvas<{ rooms: string[] }>("/api/rooms");
    return { url: CANVAS_HTTP, rooms: data.rooms, status: "live" };
  } catch {
    return { url: CANVAS_HTTP, rooms: [], status: "unreachable" };
  }
}

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------

const server = new McpServer({ name: "lararium", version: "0.1.0" });

// ---------------------------------------------------------------------------
// Resources — always-fresh reads; use when you need the raw artifact or index
// ---------------------------------------------------------------------------

server.registerResource(
  "lar-resource",
  new ResourceTemplate("lar:///{path}", { list: undefined }),
  { title: "Lararium carrier" },
  async (uri) => {
    const text = runtime.readResource(uri.href);
    return { contents: [{ uri: uri.href, text, mimeType: "text/markdown" }] };
  },
);

server.registerResource(
  "lararium-boot",
  "lar:///boot",
  { title: "Boot artifact — full closure JSON" },
  async () => {
    const artifact = runtime.compileBoot();
    return { contents: [{ uri: "lar:///boot", text: JSON.stringify(artifact, null, 2), mimeType: "application/json" }] };
  },
);

server.registerResource(
  "lararium-boot-receipt",
  "lar:///boot/receipt",
  { title: "Boot receipt — SHA256 identity hash" },
  async () => {
    const artifact = runtime.compileBoot();
    const receipt = await runtime.compileBootReceipt(artifact);
    return { contents: [{ uri: "lar:///boot/receipt", text: JSON.stringify(receipt, null, 2), mimeType: "application/json" }] };
  },
);

server.registerResource(
  "lararium-indexes-carriers",
  "lar:///INDEXES/carriers",
  { title: "All carrier URIs in lares/" },
  async () => {
    const carriers = runtime.compileCarrierIndex();
    return { contents: [{ uri: "lar:///INDEXES/carriers", text: carriers.map((c) => c.uri).join("\n"), mimeType: "text/plain" }] };
  },
);

server.registerResource(
  "lararium-indexes-interfaces",
  "lar:///INDEXES/interfaces",
  { title: "Interface → implementors index" },
  async () => {
    const carriers = runtime.compileCarrierIndex();
    const index: Record<string, string[]> = {};
    for (const c of carriers) {
      for (const iface of c.implements) (index[iface] ??= []).push(c.uri);
    }
    return { contents: [{ uri: "lar:///INDEXES/interfaces", text: JSON.stringify(index, null, 2), mimeType: "application/json" }] };
  },
);

// ---------------------------------------------------------------------------
// ✶ Observe — lararium-hud
//
// Single-shot alignment snapshot. Call this first every session.
// Returns: boot summary, validation status, invariant list, live canvas status.
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
    const artifact = runtime.compileBoot();
    const receipt = await runtime.compileBootReceipt(artifact);
    const canvas = await canvasStatus();

    const INVARIANT_URI = "lar:///ha.ka.ba/api/v0.1/pono/invariant";
    const invariants = artifact.closure
      .filter((e) => e.implements.includes(INVARIANT_URI))
      .map((e) => e.uri);

    const v = artifact.validation;
    // Exchange vector — canonical session anchor per exchange-vector law.
    // The agent should emit this URI as the node-uri at its exchange boundary.
    // Territory: the active canvas room URI if live, else the boot entry.
    const activeRoomUri = canvas.rooms[0]
      ? `lar:///rooms/${canvas.rooms[0]}`
      : artifact.entry;
    const exchangeVector = {
      operatorUri: "(read from operator turn)",
      nodeUri: activeRoomUri,
      canonicalForm: `lar://agent:0@lararium/ha.ka.ba/?confidence=boot:${artifact.memeCount}&p=0`,
      activeRoomUri,
      law: "lar:///ha.ka.ba/api/v0.1/lararium/exchange-vector",
    };

    const hud = {
      entry: artifact.entry,
      memeCount: artifact.memeCount,
      compiledAt: artifact.compiledAt,
      receipt: { sha256: receipt.sha256, mode: receipt.mode },
      validation: {
        allExist: v.allExist,
        missing: v.missing,
        dagViolationCount: v.dagViolations.length,
        edgeErrors: v.edgeViolations.filter((e) => e.severity === "error").length,
        edgeWarnings: v.edgeViolations.filter((e) => e.severity === "warning").length,
        declaredUnresolved: v.declaredUnresolved.length,
      },
      invariants,
      canvas,
      exchange: exchangeVector,
      writeEnabled: WRITE_ENABLED,
    };

    return { content: [{ type: "text" as const, text: JSON.stringify(hud, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// ✶ Observe — lararium-canvas
//
// Live canvas state: active rooms, meme list, recent server activity.
// Requires LARARIUM_HTTP_URL.
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
      const rooms = await fetchCanvas<{ rooms: string[]; activeBootRoomId: string }>("/api/rooms");
      const artifact = runtime.compileBoot();
      const text = JSON.stringify({
        rooms: rooms.rooms,
        activeBootRoomId: rooms.activeBootRoomId,
        memeCount: artifact.memeCount,
      }, null, 2);
      return { content: [{ type: "text" as const, text }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: `Canvas unreachable: ${String(e)}` }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// ⏿ Orient — lararium-read
//
// Read the text content of any file-backed lar:/// carrier.
// ---------------------------------------------------------------------------

server.registerTool(
  "lararium-read",
  {
    description: "Read the raw text of a file-backed lar:/// carrier (memetic wikitext).",
    inputSchema: { uri: z.string().describe("lar:/// URI") },
  },
  async ({ uri }) => {
    try {
      return { content: [{ type: "text" as const, text: runtime.readResource(uri) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: String(e) }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// ⏿ Orient — lararium-inspect
//
// Carrier metadata, shape, implements list, and outbound edges.
// ---------------------------------------------------------------------------

server.registerTool(
  "lararium-inspect",
  {
    description:
      "Inspect a lar:/// carrier: metadata (confidence, mana, role), shape, implements list, outbound pranala edges.",
    inputSchema: { uri: z.string().describe("lar:/// URI") },
  },
  async ({ uri }) => {
    try {
      const record = runtime.readCarrier(uri);
      return { content: [{ type: "text" as const, text: JSON.stringify(record, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: String(e) }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// ⏿ Orient — lararium-query
//
// TW5 filter expression against the current boot closure.
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
  async ({ expr }) => {
    try {
      const artifact = runtime.compileBoot();
      const matched = await filterMemesTW(artifact.closure, expr);
      const lines = matched.map((e) => `${e.uri}  depth:${e.depth}  kind:${e.kind}  role:${e.role || "—"}`);
      return { content: [{ type: "text" as const, text: lines.join("\n") || "(no matches)" }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: String(e) }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// ⏿ Orient — lararium-edges
//
// Pranala edge list from the boot closure's compiled edge table.
// Direct — does not route through tldraw render.
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
  async ({ family, from }) => {
    try {
      const artifact = runtime.compileBoot();
      const edges = artifact.pranalaEdges ?? [];
      const filtered = edges
        .filter((e) => !family || e.family === family)
        .filter((e) => !from || e.fromUri.includes(from));
      const lines = filtered.map((e) =>
        `${e.fromUri}  ${e.fromSocket.split("#")[1] ?? e.fromSocket} → ${e.toUri}  ${e.family}:${e.role ?? "—"}`
      );
      return { content: [{ type: "text" as const, text: lines.join("\n") || "(no edges)" }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: String(e) }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// ◇ Decide — lararium-draft
//
// Scaffold a new carrier without writing it. Returns the proposed text.
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
  async ({ uri, role, implements: impls, body }) => {
    try {
      const resolution = resolveLarUri(uri);
      const name = uri.split("/").at(-1) ?? uri;
      const implEdges = (impls ?? ["lar:///ha.ka.ba/api/v0.1/pono/meme"]).map((i, idx) =>
        `<<~ pranala #implements-${idx} ? -> ${i} family:control role:implements >>`
      ).join("\n");

      const draft = `<<~ ? -> ${uri} >>

<<~ ahu #iam >>

\`\`\`toml
uri-path     = "${uri.replace("lar:///", "")}"
content-type = "text/x-memetic-wikitext"
confidence   = 0.70
mana         = 0.70
manao        = 0.70
manaoio      = 0.70
${role ? `role         = "${role}"` : `role         = ""`}
\`\`\`

<<~/ahu >>

<<~ ahu #body >>
${body ?? `${name} is defined here.`}
<<~/ahu >>

<<~ ahu #edges >>

${implEdges}

<<~/ahu >>

<<~ -> ? >>
`;

      return {
        content: [{
          type: "text" as const,
          text: `Draft carrier for ${uri}\nFile path: ${resolution.laresRelPath ?? "(unresolvable)"}\n\n---\n${draft}`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text" as const, text: String(e) }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// ▶ Act — lararium-write
//
// Write a carrier to lares/. dry_run (default true) previews without writing.
// Requires LARARIUM_WRITE_MODE=enabled for actual writes.
// After a successful write, pings canvas /admin/reseed if LARARIUM_HTTP_URL is set.
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
  async ({ uri, text, dry_run }) => {
    try {
      const resolution = resolveLarUri(uri);
      if (resolution.virtual) {
        return { content: [{ type: "text" as const, text: `${uri} is a virtual resource — cannot write` }], isError: true };
      }
      if (!resolution.laresRelPath) {
        return { content: [{ type: "text" as const, text: `${uri} has no file path` }], isError: true };
      }

      const absPath = join(LARES_ROOT, resolution.laresRelPath);
      const exists = existsSync(absPath);
      const current = exists ? readFileSync(absPath, "utf8") : null;

      if (dry_run !== false) {
        const preview = [
          `URI:       ${uri}`,
          `File:      ${resolution.laresRelPath}`,
          `Action:    ${exists ? "overwrite" : "create"}`,
          `Write gate: ${WRITE_ENABLED ? "enabled" : "disabled (set LARARIUM_WRITE_MODE=enabled)"}`,
          "",
          exists ? `--- current (${current!.length} chars) ---` : "--- (file does not exist) ---",
          exists ? current! : "",
          "",
          `+++ proposed (${text.length} chars) +++`,
          text,
        ].join("\n");
        return { content: [{ type: "text" as const, text: preview }] };
      }

      if (!WRITE_ENABLED) {
        return {
          content: [{ type: "text" as const, text: "Write blocked: set LARARIUM_WRITE_MODE=enabled to allow writes" }],
          isError: true,
        };
      }

      writeFileSync(absPath, text, "utf8");

      let reseedResult = "(canvas bridge not configured)";
      try {
        const data = await fetchCanvas<{ reseeded: string; sha: string }>(`/admin/reseed?roomId=boot`);
        reseedResult = `canvas reseeded — room: ${data.reseeded}, sha: ${data.sha}`;
      } catch (e) {
        reseedResult = `canvas reseed skipped: ${String(e)}`;
      }

      return {
        content: [{
          type: "text" as const,
          text: `Written: ${resolution.laresRelPath} (${text.length} chars)\n${reseedResult}`,
        }],
      };
    } catch (e) {
      return { content: [{ type: "text" as const, text: String(e) }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// ▶ Act — lararium-fire
//
// Fire a named reaction event on the live canvas server.
// Requires LARARIUM_HTTP_URL. The server broadcasts the event to connected clients.
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
      const data = await fetchCanvas<{ fired: boolean; trigger: string }>("/api/fire", {
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
//
// Current boot receipt — SHA256 identity hash for the live closure.
// Use this to verify alignment after a write or to detect drift.
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
    const artifact = runtime.compileBoot();
    const receipt = await runtime.compileBootReceipt(artifact);
    return { content: [{ type: "text" as const, text: JSON.stringify(receipt, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

server.registerPrompt(
  "lararium-align",
  { description: "Bootstrap operator-agent alignment — orient the agent to the current graph state" },
  async () => {
    const artifact = runtime.compileBoot();
    const receipt = await runtime.compileBootReceipt(artifact);
    const canvas = await canvasStatus();
    const INVARIANT_URI = "lar:///ha.ka.ba/api/v0.1/pono/invariant";
    const invariants = artifact.closure.filter((e) => e.implements.includes(INVARIANT_URI)).map((e) => e.uri);
    const closureLines = artifact.closure.map((e) => `  depth:${e.depth}  ${e.uri}`).join("\n");

    return {
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: [
            `Lararium boot closure — ${artifact.memeCount} memes (receipt: ${receipt.sha256})`,
            "",
            closureLines,
            "",
            `Invariants (${invariants.length}):`,
            invariants.map((u) => `  ${u}`).join("\n"),
            "",
            `Canvas: ${canvas.status === "live" ? `live at ${canvas.url} — rooms: ${canvas.rooms.join(", ")}` : "not connected"}`,
          ].join("\n"),
        },
      }],
    };
  },
);

server.registerPrompt(
  "lararium-explain_uri",
  {
    description: "Explain the resolution and carrier metadata for a lar:/// URI",
    argsSchema: { uri: z.string().describe("A lar:/// URI to explain") },
  },
  ({ uri }) => {
    let text: string;
    try {
      const resolution = resolveLarUri(uri);
      let carrierText = "";
      try {
        const record = runtime.readCarrier(uri);
        carrierText = `\n\nCarrier metadata:\n${JSON.stringify(record.metadata, null, 2)}\n\nImplements: ${record.implements.join(", ")}\nRating: ${record.shape.rating}`;
      } catch { /* virtual or unreadable */ }
      text = `Resolution for ${uri}:\n${JSON.stringify(resolution, null, 2)}${carrierText}`;
    } catch (e) {
      text = `Failed to resolve ${uri}: ${String(e)}`;
    }
    return {
      messages: [{ role: "user" as const, content: { type: "text" as const, text } }],
    };
  },
);

// ---------------------------------------------------------------------------
// Connect
// ---------------------------------------------------------------------------

await server.connect(new StdioServerTransport());
