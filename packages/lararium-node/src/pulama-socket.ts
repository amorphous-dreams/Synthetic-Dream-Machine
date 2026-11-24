/**
 * pulama-socket — the Node host's channel between a vessel and its pūlama: one unix socket, one frame per line.
 *
 * The pūlama listens at a path the two processes share and no other; the vessel dials it. The socket file lands owner-only
 * (mode 0600). A path a live pūlama already answers refuses; a path nothing answers (a dead pūlama's leftover) gives way.
 * A line longer than `PULAMA_MAX_LINE`, or one that forms no frame, closes the channel.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { randomBytes } from "node:crypto";
import { chmodSync, linkSync, rmSync, statSync, unlinkSync } from "node:fs";
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
 * THE CLAIM IS EXCLUSIVE, LINK THEN CHECK: the listener stands at a private path first, then LINKS into `path`, which fails where any
 * file stands (`link` never replaces), so two keepers racing for one socket never both hold it. A leftover only gives way when it
 * answers nothing, and only the very inode read dead is removed (never a blind remove before the link), so a keeper that claimed in
 * between keeps its claim. After the link the path must name this listener's inode, or the claim refuses; `owns` re-reads it.
 */
export async function listenPulama(path: string, onChannel: (channel: PulamaChannel) => void): Promise<{ close(): Promise<void>; owns(): boolean }> {
  socketPathFits(path);
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
  const ino = statSync(own).ino;
  const give = async (reading: string, why: string): Promise<never> => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(own, { force: true });
    throw new PulamaRefused(reading, why);
  };
  const inoAt = (): number | null => { try { return statSync(path).ino; } catch { return null; } };
  for (let tries = 0; ; tries++) {
    try { linkSync(own, path); break; }
    catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") { await give("pulama-socket-claim", `the claim at ${path} failed: ${(err as Error).message}`); }
      if (tries > 0) await give("pulama-already-stands", `another keeper claimed ${path} first`);
      // A LEFTOVER GIVES WAY ONLY DEAD, and only the inode read dead goes: a live keeper, or one that claimed meanwhile, keeps it.
      const before = inoAt();
      if (await answers(path)) await give("pulama-already-stands", `a pūlama already answers at ${path}`);
      if (before !== null && inoAt() === before) { try { unlinkSync(path); } catch { /* another keeper cleared it first */ } }
    }
  }
  // THE CHECK AFTER THE LINK: the path names this listener, or another claim landed and this one refuses.
  if (inoAt() !== ino) await give("pulama-already-stands", `another keeper claimed ${path} first`);
  rmSync(own, { force: true });
  return {
    owns: () => inoAt() === ino,
    close: () => new Promise<void>((resolve) => {
      for (const sock of socks) sock.destroy();
      server.close(() => { if (inoAt() === ino) rmSync(path, { force: true }); resolve(); });
    }),
  };
}
