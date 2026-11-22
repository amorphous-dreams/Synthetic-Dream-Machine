/* Read the actual seat through its existing MCP door. The wake bounds this child. */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export function menuDigest(tools) {
  const canonical = (value) => Array.isArray(value) ? value.map(canonical) :
    value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
  const rows = tools.map(({ name, description, inputSchema, annotations }) => canonical({ name, description, inputSchema, annotations }));
  rows.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 12);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href && process.argv[2]) {
  const child = spawn(process.execPath, [process.argv[2], "mcp", "aho"], { stdio: ["pipe", "pipe", "ignore"] });
  let pending = "";
  const send = (x) => child.stdin.write(`${JSON.stringify(x)}\n`);
  child.on("error", () => process.exit(1));
  child.on("exit", () => process.exit(1));
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    pending += chunk;
    let newline;
    while ((newline = pending.indexOf("\n")) >= 0) {
      const line = pending.slice(0, newline); pending = pending.slice(newline + 1);
      let msg; try { msg = JSON.parse(line); } catch { continue; }
      if (msg.id === 1 && msg.result) {
        send({ jsonrpc: "2.0", method: "notifications/initialized" });
        send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
      } else if (msg.id === 2 && Array.isArray(msg.result?.tools)) {
        console.log(JSON.stringify({ digest: menuDigest(msg.result.tools) }));
        child.kill(); process.exit(0);
      } else if (msg.error) { child.kill(); process.exit(1); }
    }
  });
  send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "lares-wake", version: "wake" } } });
}
