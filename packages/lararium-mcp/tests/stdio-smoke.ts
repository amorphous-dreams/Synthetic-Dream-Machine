/**
 * MCP stdio smoke test — spawns the real server binary, sends JSON-RPC over
 * stdin/stdout, asserts protocol shape and meme counts.
 *
 * This is an integration test, not a unit test. It validates that the stdio
 * transport layer, JSON-RPC framing, and runtime wiring all compose correctly.
 * stdout purity bugs (stray logs, debug output) surface here and nowhere else.
 */

import { describe, test, expect, beforeAll, afterAll } from "@jest/globals";
import { spawn, type ChildProcess } from "child_process";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_BIN = resolve(__dirname, "../../lararium-mcp/dist/stdio.js");

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------

function makeRequest(id: number, method: string, params?: unknown): string {
  return JSON.stringify({ jsonrpc: "2.0", id, method, ...(params ? { params } : {}) }) + "\n";
}

async function readResponse(proc: ChildProcess, timeoutMs = 5000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let buf = "";
    const timer = setTimeout(() => reject(new Error(`timeout waiting for response`)), timeoutMs);

    const onData = (chunk: Buffer) => {
      buf += chunk.toString("utf8");
      const lines = buf.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const msg = JSON.parse(line);
          // Skip notifications (no id field)
          if ("id" in msg) {
            clearTimeout(timer);
            proc.stdout!.removeListener("data", onData);
            resolve(msg);
            return;
          }
        } catch { /* partial line */ }
      }
      buf = lines[lines.length - 1] ?? "";
    };

    proc.stdout!.on("data", onData);
    proc.stderr!.on("data", (chunk: Buffer) => {
      // stderr is allowed — it's not stdout so it doesn't break the protocol
      // but we surface it so CI can see it in logs
      process.stderr.write(`[server stderr] ${chunk}`);
    });
  });
}

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

let proc: ChildProcess;

beforeAll(() => {
  proc = spawn("node", [SERVER_BIN], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });
  proc.on("error", (err) => { throw err; });
});

afterAll(() => {
  proc.stdin!.end();
  proc.kill("SIGTERM");
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MCP stdio smoke", () => {
  test("initialize — protocol version negotiated", async () => {
    proc.stdin!.write(makeRequest(1, "initialize", {
      protocolVersion: "2025-11-25",
      capabilities: {},
      clientInfo: { name: "smoke-test", version: "0" },
    }));
    const resp = await readResponse(proc) as {
      result: { protocolVersion: string; serverInfo: { name: string }; capabilities: Record<string, unknown> };
    };
    expect(resp.result.protocolVersion).toBe("2025-11-25");
    expect(resp.result.serverInfo.name).toBe("lararium");
    expect(resp.result.capabilities).toHaveProperty("resources");
    expect(resp.result.capabilities).toHaveProperty("tools");
    expect(resp.result.capabilities).toHaveProperty("prompts");

    // Send initialized notification (no response expected)
    proc.stdin!.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  });

  test("resources/list — contains carrier and boot resources", async () => {
    proc.stdin!.write(makeRequest(2, "resources/list"));
    const resp = await readResponse(proc) as {
      result: { resources: { uri: string; name: string }[] };
    };
    const uris = resp.result.resources.map((r) => r.uri);
    expect(uris).toContain("lar:///INDEXES/carriers");
    expect(uris).toContain("lar:///INDEXES/interfaces");
    expect(uris).toContain("lar:///boot/minimal");
    expect(uris).toContain("lar:///boot/receipt");
  });

  test("tools/list — all lararium tools present", async () => {
    proc.stdin!.write(makeRequest(3, "tools/list"));
    const resp = await readResponse(proc) as {
      result: { tools: { name: string }[] };
    };
    const names = resp.result.tools.map((t) => t.name);
    expect(names).toContain("lararium-resolve_lar_uri");
    expect(names).toContain("lararium-inspect_carrier");
    expect(names).toContain("lararium-compile_minimal_boot");
    expect(names).toContain("lararium-compile_full_boot");
    expect(names).toContain("lararium-compile_boot_receipt");
  });

  test("prompts/list — boot prompt present", async () => {
    proc.stdin!.write(makeRequest(4, "prompts/list"));
    const resp = await readResponse(proc) as {
      result: { prompts: { name: string }[] };
    };
    const names = resp.result.prompts.map((p) => p.name);
    expect(names).toContain("lararium-boot_minimal");
    expect(names).toContain("lararium-explain_uri");
  });

  test("tools/call resolve — AGENTS resolves correctly", async () => {
    proc.stdin!.write(makeRequest(5, "tools/call", {
      name: "lararium-resolve_lar_uri",
      arguments: { uri: "lar:///AGENTS" },
    }));
    const resp = await readResponse(proc) as {
      result: { content: { type: string; text: string }[]; isError?: boolean };
    };
    expect(resp.result.isError).toBeFalsy();
    const parsed = JSON.parse(resp.result.content[0]!.text);
    expect(parsed.kind).toBe("caps-file");
    expect(parsed.virtual).toBe(false);
  });

  test("tools/call minimal boot — closure is non-empty, entry is AGENTS", async () => {
    proc.stdin!.write(makeRequest(6, "tools/call", {
      name: "lararium-compile_minimal_boot",
      arguments: {},
    }));
    const resp = await readResponse(proc, 10000) as {
      result: { content: { type: string; text: string }[]; isError?: boolean };
    };
    expect(resp.result.isError).toBeFalsy();
    const artifact = JSON.parse(resp.result.content[0]!.text);
    expect(artifact.memeCount).toBeGreaterThanOrEqual(18);
    expect(artifact.closure[0]?.uri).toBe("lar:///AGENTS");
  });

  test("notifications/initialized does not produce a response", async () => {
    // Already sent above — we are verifying the server is still healthy and
    // responding to subsequent requests, which proves no stray response was emitted.
    proc.stdin!.write(makeRequest(7, "tools/list"));
    const resp = await readResponse(proc) as { id: number };
    expect(resp.id).toBe(7);
  });
});
