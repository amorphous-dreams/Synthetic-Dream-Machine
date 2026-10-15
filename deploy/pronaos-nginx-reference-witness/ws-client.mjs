import { createHash, randomBytes } from "node:crypto";
import { connect } from "node:net";

const port = Number(process.argv[2] ?? "18432");
const key = randomBytes(16).toString("base64");
const expectedAccept = createHash("sha1")
  .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
  .digest("base64");

const socket = connect({ host: "127.0.0.1", port });
let received = Buffer.alloc(0);
let settled = false;

function finish(error) {
  if (settled) return;
  settled = true;
  socket.destroy();
  if (error) { console.error(`[ws-witness] FAIL: ${error.message}`); process.exitCode = 1; }
  else console.log("[ws-witness] PASS: /ws upgraded and reached the internal peer");
}

socket.setTimeout(5_000, () => finish(new Error("WebSocket forwarding timed out")));
socket.on("error", finish);
socket.on("connect", () => {
  socket.write([
    "GET /ws HTTP/1.1",
    "Host: localhost",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Key: ${key}`,
    "Sec-WebSocket-Version: 13",
    "",
    "",
  ].join("\r\n"));
});
socket.on("data", (chunk) => {
  received = Buffer.concat([received, chunk]);
  const boundary = received.indexOf("\r\n\r\n");
  if (boundary < 0) return;
  const header = received.subarray(0, boundary).toString("latin1");
  if (!header.startsWith("HTTP/1.1 101 Switching Protocols") ||
      !header.toLowerCase().includes(`sec-websocket-accept: ${expectedAccept.toLowerCase()}`)) {
    finish(new Error(`unexpected upgrade response: ${header}`));
    return;
  }
  const frame = received.subarray(boundary + 4);
  if (frame.length < 2 || (frame[0] & 0x0f) !== 1) return;
  const length = frame[1] & 0x7f;
  if (frame.length < 2 + length) return;
  const body = frame.subarray(2, 2 + length).toString("utf8");
  if (body !== "pronaos-upstream") finish(new Error(`unexpected WebSocket body: ${body}`));
  else finish();
});
