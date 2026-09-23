import { createHash } from "node:crypto";
import { createServer } from "node:http";

const port = 4321;
const server = createServer((req, res) => {
  // This synthetic private marker exists only behind the internal upstream.
  // The carrier has no route to it and no access to a private volume.
  if (req.url === "/private/upstream-fixture") {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("private-upstream-fixture");
    return;
  }
  res.writeHead(404);
  res.end();
});

server.on("upgrade", (req, socket) => {
  if (req.url !== "/ws" || req.headers.upgrade?.toLowerCase() !== "websocket") {
    socket.destroy();
    return;
  }
  const key = req.headers["sec-websocket-key"];
  if (typeof key !== "string") { socket.destroy(); return; }
  const accept = createHash("sha1")
    .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest("base64");
  socket.write([
    "HTTP/1.1 101 Switching Protocols",
    "Upgrade: websocket",
    "Connection: Upgrade",
    `Sec-WebSocket-Accept: ${accept}`,
    "",
    "",
  ].join("\r\n"));
  // One deterministic server frame proves the upgrade reached this upstream.
  const body = Buffer.from("pronaos-upstream");
  socket.write(Buffer.concat([Buffer.from([0x81, body.length]), body]));
  socket.end();
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[reference-upstream] listening on ${port}`);
});
