#!/usr/bin/env node
/**
 * lararium-mcp Streamable HTTP adapter — STUB.
 *
 * Intent: expose the Lararium meme graph over MCP Streamable HTTP transport.
 * Implementations pending — see stdio.ts for the tool surface intent.
 *
 * Local-only by default (binds 127.0.0.1). Origin validation required.
 * Auth stub passes all requests — real auth requires UCAN peer registry
 * wired into this adapter (currently only in serve.ts).
 *
 * Usage:
 *   node packages/lararium-mcp/dist/http.js [--port 3737] [--host 127.0.0.1]
 */

import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// ---------------------------------------------------------------------------
// Config — flags or env
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const portArg = args[args.indexOf("--port") + 1];
const hostArg = args[args.indexOf("--host") + 1];

const PORT = portArg ? parseInt(portArg, 10) : (process.env["LARARIUM_HTTP_PORT"] ? parseInt(process.env["LARARIUM_HTTP_PORT"]!, 10) : 3737);
const HOST = hostArg ?? process.env["LARARIUM_HTTP_HOST"] ?? "127.0.0.1";

const ALLOWED_ORIGINS = new Set(
  process.env["LARARIUM_ALLOWED_ORIGINS"]
    ? process.env["LARARIUM_ALLOWED_ORIGINS"]!.split(",").map((o) => o.trim())
    : [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`, `http://[::1]:${PORT}`]
);

// ---------------------------------------------------------------------------
// Origin validation
// ---------------------------------------------------------------------------

function validateOrigin(req: IncomingMessage): boolean {
  const origin = req.headers["origin"];
  if (!origin) return true; // curl / same-origin server calls allowed locally
  return ALLOWED_ORIGINS.has(origin);
}

// ---------------------------------------------------------------------------
// Auth stub — pending provider-neutral LarAuthReceipt wiring
// ---------------------------------------------------------------------------

async function authCheck(_req: IncomingMessage): Promise<boolean> {
  // stub — validate BlueSky OAuth or GitHub VS Code local auth receipt
  return true;
}

// ---------------------------------------------------------------------------
// MCP server — tool surface defined in stdio.ts; same tools mount here
// ---------------------------------------------------------------------------

const server = new McpServer({ name: "lararium", version: "0.1.0" });

// stub — register same resources/tools as stdio.ts once implementations land

// ---------------------------------------------------------------------------
// HTTP server — stateless Streamable HTTP transport
// ---------------------------------------------------------------------------

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (!validateOrigin(req)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden: invalid Origin");
    return;
  }

  if (!(await authCheck(req))) {
    res.writeHead(401, { "Content-Type": "text/plain" });
    res.end("Unauthorized");
    return;
  }

  if (req.url !== "/mcp") {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found — lararium HTTP transport listens at /mcp");
    return;
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await server.connect(transport as any);

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
  process.stderr.write(`Allowed origins: ${[...ALLOWED_ORIGINS].join(", ")}\n`);
});

process.on("SIGTERM", () => httpServer.close());
process.on("SIGINT",  () => httpServer.close());
