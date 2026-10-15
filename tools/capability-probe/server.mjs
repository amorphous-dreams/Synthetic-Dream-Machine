/**
 * capability-probe server: static files, the report POST, and a hand-rolled WebSocket echo, on ONE port.
 * Node built-ins only. Invariants:
 *   - report file name is `<n>-<first 12 hex of sha256(body)>.json`, n = count of files present at write time
 *     (an exclusive create bumps n on collision); no clock enters a name or a decision.
 *   - the WebSocket accept keeps the raw `Sec-WebSocket-Protocol` header under this script's control: the server
 *     selects the first offered token and reports the sha256 of the second offered value (the payload).
 */
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 8080);
const REPORT_DIR = process.env.REPORT_DIR ?? "/reports";
const AUTOMERGE_IIFE = process.env.AUTOMERGE_IIFE ?? "/vendor/automerge/iife.js";
const MAX_BODY = 4 * 1024 * 1024;
const MAX_WS_PAYLOAD = 64 * 1024 * 1024;

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".wasm": "application/wasm",
};
const STATIC = new Set(fs.readdirSync(HERE).filter((f) => /\.(html|js|mjs|css)$/.test(f) && f !== "server.mjs" && f !== "control.mjs"));

const send = (res, code, type, body) => {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store", "content-length": Buffer.byteLength(body) });
  res.end(body);
};

function writeReport(body) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const digest = crypto.createHash("sha256").update(body).digest("hex").slice(0, 12);
  for (let n = fs.readdirSync(REPORT_DIR).length; ; n++) {
    const name = `${n}-${digest}.json`;
    try { fs.writeFileSync(path.join(REPORT_DIR, name), body, { flag: "wx" }); return name; }
    catch (e) { if (e.code !== "EEXIST") throw e; }
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "POST" && url.pathname === "/report") {
    const chunks = []; let size = 0;
    req.on("data", (c) => { size += c.length; if (size > MAX_BODY) { send(res, 413, "text/plain", "too large"); req.destroy(); } else chunks.push(c); });
    req.on("end", () => {
      if (size > MAX_BODY) return;
      const body = Buffer.concat(chunks);
      try { JSON.parse(body.toString("utf8")); } catch { return send(res, 400, "text/plain", "not json"); }
      try { send(res, 200, "application/json", JSON.stringify({ file: writeReport(body) })); }
      catch (e) { send(res, 500, "text/plain", `report dir not writable: ${e.message}`); }
    });
    return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "text/plain", "method");
  if (url.pathname === "/reports") {
    let names = [];
    try { names = fs.readdirSync(REPORT_DIR).sort(); } catch { /* an absent dir lists empty */ }
    return send(res, 200, "application/json", JSON.stringify(names));
  }
  if (url.pathname.startsWith("/reports/")) {
    const name = path.basename(url.pathname);
    try { return send(res, 200, MIME[".json"], fs.readFileSync(path.join(REPORT_DIR, name))); }
    catch { return send(res, 404, "text/plain", "no such report"); }
  }
  if (url.pathname === "/vendor/automerge-iife.js") {
    // The vendored bundle assigns `window.Automerge`; a worker has no `window`, so the alias leads the file.
    try { return send(res, 200, MIME[".js"], "var window = self;\n" + fs.readFileSync(AUTOMERGE_IIFE, "utf8")); }
    catch { return send(res, 404, "text/plain", "automerge bundle not mounted"); }
  }
  const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
  if (!STATIC.has(rel)) return send(res, 404, "text/plain", "not found");
  send(res, 200, MIME[path.extname(rel)] ?? "application/octet-stream", fs.readFileSync(path.join(HERE, rel)));
});

// ---- WebSocket echo ----
const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function frame(opcode, payload) {
  const n = payload.length;
  const head = n < 126 ? Buffer.from([0x80 | opcode, n])
    : n < 65536 ? Buffer.from([0x80 | opcode, 126, n >> 8, n & 255])
    : (() => { const h = Buffer.alloc(10); h[0] = 0x80 | opcode; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); return h; })();
  return Buffer.concat([head, payload]);
}

server.on("upgrade", (req, socket) => {
  const url = new URL(req.url, "http://x");
  const key = req.headers["sec-websocket-key"];
  if (url.pathname !== "/echo" || !key) { socket.end("HTTP/1.1 404 Not Found\r\n\r\n"); return; }
  const offered = String(req.headers["sec-websocket-protocol"] ?? "");
  const values = offered === "" ? [] : offered.split(/\s*,\s*/);
  const accept = crypto.createHash("sha1").update(key + GUID).digest("base64");
  let head = `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n`;
  if (values.length) head += `Sec-WebSocket-Protocol: ${values[0]}\r\n`;
  socket.write(head + "\r\n");
  socket.write(frame(1, Buffer.from(JSON.stringify({
    hello: true, headerLength: offered.length,
    requestHeaderBytes: req.rawHeaders.reduce((n, h) => n + Buffer.byteLength(h) + 2, 0) + Buffer.byteLength(`${req.method} ${req.url} HTTP/${req.httpVersion}`) + 4, offered: values.length,
    payloadDigest: values[1] === undefined ? null : crypto.createHash("sha256").update(values[1]).digest("hex"),
    payloadLength: values[1]?.length ?? 0,
  }))));

  let chunks = [], total = 0, message = [], messageOp = 0, messageLen = 0;
  const take = (n) => {
    const all = chunks.length === 1 ? chunks[0] : Buffer.concat(chunks);
    chunks = all.length > n ? [all.subarray(n)] : []; total -= n;
    return all.subarray(0, n);
  };
  const peek = (n) => (chunks.length === 1 ? chunks[0] : (chunks = [Buffer.concat(chunks)])[0]).subarray(0, n);
  const drain = () => {
    for (;;) {
      if (total < 2) return;
      const h = peek(14);
      let len = h[1] & 127, off = 2;
      if (len === 126) { if (total < 4) return; len = h.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (total < 10) return; len = Number(h.readBigUInt64BE(2)); off = 10; }
      const masked = (h[1] & 128) !== 0;
      if (len > MAX_WS_PAYLOAD) { socket.destroy(); return; }
      if (total < off + (masked ? 4 : 0) + len) return;
      const raw = take(off + (masked ? 4 : 0) + len);
      const fin = (raw[0] & 128) !== 0, op = raw[0] & 15;
      const payload = Buffer.from(raw.subarray(off + (masked ? 4 : 0)));
      if (masked) { const m = raw.subarray(off, off + 4); for (let i = 0; i < payload.length; i++) payload[i] ^= m[i & 3]; }
      if (op === 8) { socket.end(frame(8, payload.subarray(0, 2))); return; }
      if (op === 9) { socket.write(frame(10, payload)); continue; }
      if (op === 10) continue;
      if (op !== 0) { messageOp = op; message = []; messageLen = 0; }
      message.push(payload); messageLen += payload.length;
      if (fin) { socket.write(frame(messageOp, Buffer.concat(message, messageLen))); message = []; messageLen = 0; }
    }
  };
  socket.on("data", (c) => { chunks.push(c); total += c.length; drain(); });
  socket.on("error", () => socket.destroy());
});

server.listen(PORT, "0.0.0.0", () => console.log(`capability-probe listening on ${PORT}, reports -> ${REPORT_DIR}`));
