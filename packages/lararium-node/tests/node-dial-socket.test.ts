/**
 * node-dial-socket — the node dialer holds the payload cap on the wire.
 *
 * A gate's 101 selects `lar-gate`, then it sends one frame header naming a body one byte past a Noise message, and
 * never sends that body.
 *
 *   RED: the node dial socket refuses the frame as its header lands: its reader sees the end at once, with no body
 *        buffered.
 *   CONTROL: a frame within the cap crosses whole.
 */
import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import type { Duplex } from "node:stream";
import { afterEach, describe, expect, test } from "vitest";
import { NOISE_MAX_MESSAGE_BYTES } from "@lararium/mesh";
import { nodeDialSocket } from "../src/node-dial-socket.js";

const servers: Server[] = [];
const upgraded: Duplex[] = [];
afterEach(async () => {
  for (const socket of upgraded.splice(0)) socket.destroy();
  for (const server of servers.splice(0)) await new Promise<void>((resolve) => server.close(() => resolve()));
});

/** A binary frame header naming `length` bytes of body, unmasked, as a server sends it. */
function frameHeader(length: number): Buffer {
  if (length < 126) return Buffer.from([0x82, length]);
  if (length < 65_536) { const b = Buffer.alloc(4); b[0] = 0x82; b[1] = 126; b.writeUInt16BE(length, 2); return b; }
  const b = Buffer.alloc(10); b[0] = 0x82; b[1] = 127; b.writeBigUInt64BE(BigInt(length), 2); return b;
}

/** A gate stand-in: it answers the upgrade with `lar-gate`, then writes `then` to the socket. */
async function gateThatSends(then: (socket: Duplex) => void): Promise<string> {
  const server = createServer();
  server.on("upgrade", (req, socket) => {
    upgraded.push(socket);
    const accept = createHash("sha1").update(`${String(req.headers["sec-websocket-key"])}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
    socket.write(["HTTP/1.1 101 Switching Protocols", "Upgrade: websocket", "Connection: Upgrade", `Sec-WebSocket-Accept: ${accept}`, "Sec-WebSocket-Protocol: lar-gate", "", ""].join("\r\n"));
    then(socket);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  servers.push(server);
  return `ws://127.0.0.1:${(server.address() as { port: number }).port}/ws`;
}

const flight = { knock: "k".repeat(43), message1: new Uint8Array(96).fill(7) };

/** What a read comes to within `ms`: the frame, the end, or nothing yet. */
async function readWithin(recv: Promise<Uint8Array | null>, ms: number): Promise<Uint8Array | null | "pending"> {
  return Promise.race([recv, new Promise<"pending">((resolve) => setTimeout(() => resolve("pending"), ms))]);
}

describe("the node dial socket holds the payload cap", () => {
  test("RED: a frame header past a Noise message ends the socket before any body lands", async () => {
    const url = await gateThatSends((socket) => { socket.write(frameHeader(NOISE_MAX_MESSAGE_BYTES + 1)); socket.write(Buffer.alloc(64)); });
    const socket = nodeDialSocket(url);
    await socket.open(flight);
    expect(await readWithin(socket.recv(), 2_000)).toBeNull();
    socket.close();
  });

  test("CONTROL: a frame within the cap crosses whole", async () => {
    const body = Buffer.alloc(NOISE_MAX_MESSAGE_BYTES, 9);
    const url = await gateThatSends((socket) => { socket.write(Buffer.concat([frameHeader(body.length), body])); });
    const socket = nodeDialSocket(url);
    await socket.open(flight);
    const frame = await readWithin(socket.recv(), 2_000);
    expect(frame instanceof Uint8Array ? frame.length : frame).toBe(NOISE_MAX_MESSAGE_BYTES);
    socket.close();
  });
});
