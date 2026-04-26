#!/usr/bin/env node
/**
 * lararium-mcp stdio adapter.
 *
 * Thin MCP transport layer over the lararium-node runtime.
 * No carrier semantics live here — only resource/tool/prompt registration.
 */

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { createLarariumRuntime, resolveLarUri, LARES_ROOT } from "@lararium/node";
import { renderToTldraw } from "@lararium/tldraw";

const runtime = createLarariumRuntime({ writeback: false });

const server = new McpServer({
  name: "lararium",
  version: "0.1.0",
});

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

// File-backed carriers
server.registerResource(
  "lar-resource",
  new ResourceTemplate("lar:///{path}", { list: undefined }),
  { title: "Lararium resource" },
  async (uri) => {
    const text = runtime.readResource(uri.href);
    return { contents: [{ uri: uri.href, text, mimeType: "text/markdown" }] };
  },
);

// Index resources (virtual)
server.registerResource(
  "lararium-indexes-carriers",
  "lar:///INDEXES/carriers",
  { title: "Lararium carrier index" },
  async () => {
    const carriers = runtime.compileCarrierIndex();
    const text = carriers.map((c) => c.uri).join("\n");
    return { contents: [{ uri: "lar:///INDEXES/carriers", text, mimeType: "text/plain" }] };
  },
);

server.registerResource(
  "lararium-indexes-interfaces",
  "lar:///INDEXES/interfaces",
  { title: "Lararium interface index" },
  async () => {
    const carriers = runtime.compileCarrierIndex();
    const index: Record<string, string[]> = {};
    for (const c of carriers) {
      for (const iface of c.implements) {
        (index[iface] ??= []).push(c.uri);
      }
    }
    return { contents: [{ uri: "lar:///INDEXES/interfaces", text: JSON.stringify(index, null, 2), mimeType: "application/json" }] };
  },
);

server.registerResource(
  "lararium-indexes-invariants",
  "lar:///INDEXES/invariants",
  { title: "Lararium invariant index" },
  async () => {
    const INVARIANT_URI = "lar:///ha.ka.ba/api/v0.1/pono/invariant";
    const carriers = runtime.compileCarrierIndex();
    const invariants = carriers.filter((c) => c.implements.includes(INVARIANT_URI)).map((c) => c.uri);
    return { contents: [{ uri: "lar:///INDEXES/invariants", text: invariants.join("\n"), mimeType: "text/plain" }] };
  },
);

server.registerResource(
  "lararium-boot-minimal",
  "lar:///boot/minimal",
  { title: "Lararium minimal boot artifact" },
  async () => {
    const artifact = runtime.compileMinimalBoot();
    return { contents: [{ uri: "lar:///boot/minimal", text: JSON.stringify(artifact, null, 2), mimeType: "application/json" }] };
  },
);

server.registerResource(
  "lararium-boot-full",
  "lar:///boot/full",
  { title: "Lararium full boot artifact" },
  async () => {
    const artifact = runtime.compileFullBoot();
    return { contents: [{ uri: "lar:///boot/full", text: JSON.stringify(artifact, null, 2), mimeType: "application/json" }] };
  },
);

server.registerResource(
  "lararium-boot-receipt",
  "lar:///boot/receipt",
  { title: "Lararium boot receipt" },
  async () => {
    const artifact = runtime.compileMinimalBoot();
    const receipt = runtime.compileBootReceipt(artifact);
    return { contents: [{ uri: "lar:///boot/receipt", text: JSON.stringify(receipt, null, 2), mimeType: "application/json" }] };
  },
);

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

server.registerTool(
  "lararium-resolve_lar_uri",
  {
    description: "Resolve a lar:/// URI into its resolution metadata",
    inputSchema: { uri: z.string().describe("A lar:/// URI") },
  },
  async ({ uri }) => {
    try {
      const resolution = resolveLarUri(uri);
      return { content: [{ type: "text" as const, text: JSON.stringify(resolution, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: String(e) }], isError: true };
    }
  },
);

server.registerTool(
  "lararium-read_lar_resource",
  {
    description: "Read the text content of a file-backed lar:/// resource",
    inputSchema: { uri: z.string().describe("A lar:/// URI pointing to a file-backed resource") },
  },
  async ({ uri }) => {
    try {
      const text = runtime.readResource(uri);
      return { content: [{ type: "text" as const, text }] };
    } catch (e) {
      return { content: [{ type: "text" as const, text: String(e) }], isError: true };
    }
  },
);

server.registerTool(
  "lararium-inspect_carrier",
  {
    description: "Inspect carrier metadata, shape, and implements for a lar:/// URI",
    inputSchema: { uri: z.string().describe("A lar:/// URI pointing to a carrier") },
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

server.registerTool(
  "lararium-list_lar_resources",
  {
    description: "List all discoverable lar:/// carrier URIs in the lares/ tree",
    inputSchema: {},
  },
  async () => {
    const carriers = runtime.compileCarrierIndex();
    const uris = carriers.map((c) => c.uri);
    return { content: [{ type: "text" as const, text: uris.join("\n") }] };
  },
);

server.registerTool(
  "lararium-compile_minimal_boot",
  {
    description: "Compile the minimal boot closure (Tier 0+1: BFS over control edges from AGENTS)",
    inputSchema: {},
  },
  async () => {
    const artifact = runtime.compileMinimalBoot();
    return { content: [{ type: "text" as const, text: JSON.stringify(artifact, null, 2) }] };
  },
);

server.registerTool(
  "lararium-compile_full_boot",
  {
    description: "Compile the full boot artifact (Tier 0+1+2: control + relation expansion + carrier index)",
    inputSchema: {},
  },
  async () => {
    const artifact = runtime.compileFullBoot();
    return { content: [{ type: "text" as const, text: JSON.stringify(artifact, null, 2) }] };
  },
);

server.registerTool(
  "lararium-compile_boot_receipt",
  {
    description: "Compile a boot receipt (SHA256 digest of the minimal boot artifact)",
    inputSchema: {},
  },
  async () => {
    const artifact = runtime.compileMinimalBoot();
    const receipt = runtime.compileBootReceipt(artifact);
    return { content: [{ type: "text" as const, text: JSON.stringify(receipt, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

server.registerPrompt(
  "lararium-boot_minimal",
  {
    description: "Explain or inspect the current minimal boot closure",
  },
  () => {
    const artifact = runtime.compileMinimalBoot();
    const uris = artifact.closure.map((e) => e.uri).join("\n");
    return {
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `The Lararium minimal boot closure contains ${artifact.memeCount} memes:\n\n${uris}\n\nReceipt: ${JSON.stringify(runtime.compileBootReceipt(artifact), null, 2)}`,
          },
        },
      ],
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

// tldraw projection tool — emits store-ready shape records for the minimal boot closure
server.registerTool(
  "lararium-render_tldraw",
  {
    description: "Project the minimal boot closure into tldraw-ready shape records (story-river layout)",
    inputSchema: {
      boot: z.enum(["minimal", "full"]).optional().describe("Which boot artifact to project. Default: minimal"),
    },
  },
  async ({ boot = "minimal" }) => {
    try {
      const artifact = boot === "full" ? runtime.compileFullBoot() : runtime.compileMinimalBoot();
      const readText = (uri: string): string | null => {
        try { return runtime.readResource(uri); } catch { return null; }
      };
      const emission = renderToTldraw(artifact, { readText, includeAhuFrames: true });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({ pages: emission.pages, shapes: emission.shapes }, null, 2),
        }],
      };
    } catch (e) {
      return { content: [{ type: "text" as const, text: String(e) }], isError: true };
    }
  },
);

// ---------------------------------------------------------------------------
// Connect
// ---------------------------------------------------------------------------

await server.connect(new StdioServerTransport());
