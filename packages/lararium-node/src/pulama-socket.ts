/**
 * pulama-socket — the Node host's channel between a vessel and its pūlama: one unix socket, one frame per line.
 *
 * The pūlama listens at a path the two processes share and no other; the vessel dials it. The socket file lands owner-only
 * (mode 0600). A path a live pūlama already answers refuses; a path nothing answers (a dead pūlama's leftover) gives way.
 * A line longer than `PULAMA_MAX_LINE`, or one that forms no frame, closes the channel.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { randomBytes } from "node:crypto";
import { chmodSync, linkSync, rmSync, statSync } from "node:fs";
import { connect, createServer, type Server, type Socket } from "node:net";
import { PULAMA_MAX_LINE, PulamaRefused, decodeFrame, encodeFrame, type PulamaChannel, type PulamaFrame } from "./pulama-wire.js";

/** The longest socket path the kernel takes (`sun_path` holds 108 bytes, the last a NUL). */
export const SOCKET_PATH_MAX = 107;

/** Refuse a path the kernel would refuse without a name of its own. */
export function socketPathFits(path: string): string {
  if (Buffer.byteLength(path) > SOCKET_PATH_MAX) {
    throw new PulamaRefused("pulama-socket-path-long", `a unix socket's path holds ${SOCKET_PATH_MAX} bytes at most; ${path} runs ${Buffer.byteLength(path)}`);
  }
  return path;
}

/** One connected socket as a channel. */
export function socketChannel(sock: Socket): PulamaChannel {
  const frames: Array<(f: PulamaFrame) => void> = [];
  const closes: Array<() => void> = [];
  const held: PulamaFrame[] = [];
  let buffered = "";
  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    // `end` flushes what this side already wrote (a refusal rides ahead of its close), then the socket goes.
    try { sock.end(() => sock.destroy()); } catch { /* already gone */ }
    for (const l of closes) l();
  };
  sock.setEncoding("utf8");
  sock.on("data", (chunk: string) => {
    if (closed) return;
    buffered += chunk;
    for (;;) {
      const at = buffered.indexOf("\n");
      if (at < 0) { if (buffered.length > PULAMA_MAX_LINE) close(); return; }
      const line = buffered.slice(0, at);
      buffered = buffered.slice(at + 1);
      const frame = decodeFrame(line);
      if (frame === null) { close(); return; }
      if (frames.length === 0) held.push(frame); else for (const l of frames) l(frame);
    }
  });
  sock.on("error", close);
  sock.on("close", close);
  return {
    send(frame) { if (!closed) sock.write(encodeFrame(frame) + "\n"); },
    onFrame(listener) { frames.push(listener); for (const f of held.splice(0)) listener(f); },
    onClose(listener) { if (closed) listener(); else closes.push(listener); },
    close,
  };
}

/** Dial the pūlama at `path`. A path nothing answers rejects `pulama-unreachable`. */
export function dialPulama(path: string): Promise<PulamaChannel> {
  return new Promise((resolve, reject) => {
    const sock = connect(socketPathFits(path));
    sock.once("connect", () => { sock.removeAllListeners("error"); resolve(socketChannel(sock)); });
    sock.once("error", (err: NodeJS.ErrnoException) => reject(new PulamaRefused("pulama-unreachable", `no pūlama answers at ${path} (${err.code ?? err.message})`)));
  });
}

const answers = (path: string): Promise<boolean> => new Promise((resolve) => {
  const probe = connect(path);
  probe.once("connect", () => { probe.destroy(); resolve(true); });
  probe.once("error", () => resolve(false));
});

/**
 * THE FIRE: whether a live pūlama answers at `path`. Exactly one keeper holds the vessel socket; a successor stands beside it on its
 * own hand door and claims the socket only once this reads false (`take-fire`).
 */
export const pulamaAnswers = (path: string): Promise<boolean> => answers(socketPathFits(path));

/**
 * Listen at `path` and hand each connection to `onChannel`. `close` ends the listener, every connection, and the socket file.
 * THE CLAIM IS EXCLUSIVE: the listener stands at a private path first, then LINKS into `path`, which fails where any file stands
 * (`link` never replaces), so two keepers racing for one socket never both hold it; a leftover a dead pūlama left answers nothing
 * and gives way first.
 */
export async function listenPulama(path: string, onChannel: (channel: PulamaChannel) => void): Promise<{ close(): Promise<void> }> {
  socketPathFits(path);
  if (await answers(path)) throw new PulamaRefused("pulama-already-stands", `a pūlama already answers at ${path}`);
  rmSync(path, { force: true });
  const own = `${path}.${randomBytes(3).toString("hex")}`;
  if (own.length > SOCKET_PATH_MAX) throw new PulamaRefused("pulama-socket-path", `the claim path ${own} runs past ${SOCKET_PATH_MAX} bytes`);
  const socks = new Set<Socket>();
  const server: Server = createServer((sock) => {
    socks.add(sock);
    sock.once("close", () => socks.delete(sock));
    onChannel(socketChannel(sock));
  });
  await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(own, () => { server.removeListener("error", reject); resolve(); }); });
  chmodSync(own, 0o600);
  try { linkSync(own, path); }
  catch (err) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(own, { force: true });
    if ((err as NodeJS.ErrnoException).code === "EEXIST") throw new PulamaRefused("pulama-already-stands", `another keeper claimed ${path} first`);
    throw err;
  }
  // THE CLAIM REMEMBERS ITS OWN INODE: a close removes the path only while it still names this listener, never a successor's claim.
  const ino = statSync(path).ino;
  rmSync(own, { force: true });
  return {
    close: () => new Promise<void>((resolve) => {
      for (const sock of socks) sock.destroy();
      server.close(() => { try { if (statSync(path).ino === ino) rmSync(path, { force: true }); } catch { /* already gone */ } resolve(); });
    }),
  };
}
