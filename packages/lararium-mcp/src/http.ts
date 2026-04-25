#!/usr/bin/env node
/**
 * lararium-mcp Streamable HTTP adapter — Milestone 3 canary.
 *
 * Local-only by default (binds 127.0.0.1). Origin validation required.
 * No auth in this version — auth hooks are stubbed for Milestone 4.
 *
 * Usage:
 *   node packages/lararium-mcp/dist/http.js [--port 3737] [--host 127.0.0.1]
 *
 * The same McpServer instance used by stdio — only the transport differs.
 * Do NOT import this file from stdio.ts or vice versa.
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import { createLarariumRuntime, resolveLarUri, LARES_ROOT } from "@lararium/node";

// ---------------------------------------------------------------------------
// Config — flags or env
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const portArg = args[args.indexOf("--port") + 1];
const hostArg = args[args.indexOf("--host") + 1];

const PORT = portArg ? parseInt(portArg, 10) : (process.env["LARARIUM_HTTP_PORT"] ? parseInt(process.env["LARARIUM_HTTP_PORT"]!, 10) : 3737);
const HOST = hostArg ?? process.env["LARARIUM_HTTP_HOST"] ?? "127.0.0.1";

// Allowed origins — localhost variants only by default.
// Extend via LARARIUM_ALLOWED_ORIGINS="https://elyncia.app,https://dreamnet.local"
const ALLOWED_ORIGINS = new Set(
  process.env["LARARIUM_ALLOWED_ORIGINS"]
    ? process.env["LARARIUM_ALLOWED_ORIGINS"]!.split(",").map((o) => o.trim())
    : [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`, `http://[::1]:${PORT}`]
);

// ---------------------------------------------------------------------------
// Origin validation middleware
// ---------------------------------------------------------------------------

function validateOrigin(req: IncomingMessage): boolean {
  const origin = req.headers["origin"];
  // Requests without Origin header (curl, same-origin server calls) are allowed locally
  if (!origin) return true;
  return ALLOWED_ORIGINS.has(origin);
}

// ---------------------------------------------------------------------------
// MCP server — same surface as stdio, different transport
// ---------------------------------------------------------------------------

const runtime = createLarariumRuntime({ writeback: false });

const server = new McpServer({
  name: "lararium",
  version: "0.1.0",
});

// Resources
server.registerResource(
  "lar-resource",
  new ResourceTemplate("lar:///{path}", { list: undefined }),
  { title: "Lararium resource" },
  async (uri) => {
    const text = runtime.readResource(uri.href.replace(/^lar:\/\/\//, "lar:///"));
    return { contents: [{ uri: uri.href, text, mimeType: "text/x-memetic-wikitext" }] };
  },
);

server.registerResource(
  "lar-minimal-boot",
  "lar:///boot/minimal",
  { title: "Minimal boot artifact" },
  async () => {
    const artifact = runtime.compileMinimalBoot();
    return { contents: [{ uri: "lar:///boot/minimal", text: JSON.stringify(artifact, null, 2), mimeType: "application/json" }] };
  },
);

// Tools
server.registerTool(
  "lararium-resolve_lar_uri",
  { description: "Resolve a lar:/// URI to its file path and metadata", inputSchema: { uri: z.string() } },
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
  "lararium-compile_minimal_boot",
  { description: "Compile the minimal boot closure from lar:///AGENTS", inputSchema: {} },
  async () => {
    const artifact = runtime.compileMinimalBoot();
    return { content: [{ type: "text" as const, text: JSON.stringify(artifact, null, 2) }] };
  },
);

// ---------------------------------------------------------------------------
// HTTP server — stateless transport, one transport per request
// ---------------------------------------------------------------------------

// Auth hook stub — Milestone 4 will fill this in
async function authCheck(_req: IncomingMessage): Promise<boolean> {
  // TODO(M4): validate bearer token or session cookie
  return true;
}

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Origin gate
  if (!validateOrigin(req)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden: invalid Origin");
    return;
  }

  // Auth hook (stub)
  if (!(await authCheck(req))) {
    res.writeHead(401, { "Content-Type": "text/plain" });
    res.end("Unauthorized");
    return;
  }

  // Only handle /mcp
  if (req.url !== "/mcp") {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found — lararium HTTP transport listens at /mcp");
    return;
  }

  // One stateless transport per request (no sessionIdGenerator = stateless mode)
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await server.connect(transport as any);

  // Collect body
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks).toString("utf8");

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad request: invalid JSON");
    return;
  }

  await transport.handleRequest(req, res, parsed);
});

httpServer.listen(PORT, HOST, () => {
  process.stderr.write(`lararium-mcp HTTP listening on http://${HOST}:${PORT}/mcp\n`);
  process.stderr.write(`LARES_ROOT: ${LARES_ROOT}\n`);
  process.stderr.write(`Allowed origins: ${[...ALLOWED_ORIGINS].join(", ")}\n`);
});

// Graceful shutdown
process.on("SIGTERM", () => httpServer.close());
process.on("SIGINT",  () => httpServer.close());
