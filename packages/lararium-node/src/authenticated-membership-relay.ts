/**
 * authenticated-membership-relay — THE HERM MEMBERSHIP RELAY SHIPS SHUT BY NAME.
 *
 * House ruling "Routes at the cutover" (stable-founding-road): "Walker arms, the sibling dial and the herm membership
 * relay ship SHUT by name ... a closed route grants no silent legacy authority." The relay's live-WS transport spoke
 * the retired pre-sync handshake (a challenge, a V3 proof, a signed auth-ok) and stamped each envelope's `from` with
 * the key that handshake proved. That wire is gone, and no gate-native caller has flipped this route: until one does,
 * the relay accepts no WebSocket upgrade (it destroys every one before any 101 and says `membership-relay-shut`), and
 * a channel dial rejects with the same name. Nothing is proven, stamped or routed.
 *
 * WHAT STANDS. The successor DROPS are a floor voice on a plain HTTP request apart from any proven socket, and they
 * ride the same port: `GET /drop/<name>` answers the persona-KEL events a drop holds, `POST /drop/<name>` keeps one
 * (`@lararium/mesh` persona-kel-drop). Availability by content address, never a vouch: a deposit carries its successor
 * and that successor's predecessor, and the herm keeps it only when the name derives from the predecessor and the
 * successor verifies against it. A deposit past `PERSONA_KEL_DROP_BODY_CAP` bytes, or past one connection's budget,
 * meets silence before it is read; the store's byte budget lets go of the drops it heard from least lately. With a
 * journal path the herm keeps what it verified across a restart, re-verified when it reads the journal back. A name
 * it holds nothing under, a refused deposit and every other path meet the same silence as a closed door.
 *
 * Node-side (the transport branch); the `MembershipChannel` shore + the file impl stay platform-blind.
 * Meme: lar:///ha.ka.ba/lararium/node/authenticated-membership-relay
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Duplex } from "node:stream";
import * as ed from "@noble/ed25519";
import {
  PERSONA_KEL_DROP_ROUTE, makePersonaKelDropStore, PERSONA_KEL_DROP_BODY_CAP, hex,
  type MembershipChannel, type MembershipEnvelope, type PersonaKelDropJournal, type PersonaKelDropStore,
} from "@lararium/mesh";

/** The name every refusal of the shut relay carries. */
export const MEMBERSHIP_RELAY_SHUT = "membership-relay-shut";
const SHUT_WHY = `${MEMBERSHIP_RELAY_SHUT}: the herm membership relay ships shut by name (house ruling "Routes at the cutover"); no socket is proven, stamped or routed until a gate-native caller flips it`;

/** A running authenticated membership relay — the HTTP server (successor drops alone) + its bound port + the gate key a dialer once pinned. */
export interface AuthenticatedMembershipRelay {
  readonly port:       number;
  readonly gatePubKey: string;
  close(): Promise<void>;
}

/**
 * The relay's SNIFF observer — the RE-SHARE leg. The shut relay carries no envelope, so none of these fires; the type
 * stays for the carriage relay that composes it.
 */
export interface RelayAnnounceObserver {
  readonly onEnvelope?: (env: MembershipEnvelope) => void;
  readonly onLeave?:    (from: string) => void;
  /** Every sibling frame the relay carries, exactly as it carries it — the herm's whole sight of a channel. */
  readonly onSiblingFrame?: (carried: { readonly channels: readonly string[]; readonly from: string; readonly to: string | null; readonly frame: unknown }) => void;
}

/**
 * Start the shut relay on `port` (0 → any free port), keyed by `gateSeed`. It serves the successor drops over plain HTTP and
 * destroys every WebSocket upgrade before any 101, naming `membership-relay-shut` to `opts.onShut`.
 *
 * @param gateSeed the relay's 32-byte Ed25519 seed — its verifying key is the identity a hearth was handed for it.
 */
export async function startAuthenticatedMembershipRelay(
  gateSeed: Uint8Array,
  port = 0,
  _observer?: RelayAnnounceObserver,
  opts: {
    /** Where the herm journals the drops it verified, so a restart keeps them. Absent, drops live in memory. */
    readonly dropJournalPath?: string;
    /** The drops' byte budget in all. */
    readonly dropBytes?: number;
    /** Hears each upgrade the shut relay destroyed. */
    readonly onShut?: (why: string) => void;
  } = {},
): Promise<AuthenticatedMembershipRelay> {
  const gatePubKey = hex(await ed.getPublicKeyAsync(gateSeed));
  const drops = makePersonaKelDropStore({
    gatePubKey,
    ...(opts.dropBytes !== undefined ? { quota: { bytes: opts.dropBytes } } : {}),
    ...(opts.dropJournalPath ? { journal: fileDropJournal(opts.dropJournalPath) } : {}),
  });
  const spent = new WeakMap<object, { deposits: number; bytes: number }>();
  const httpServer = createServer((req, res) => { serveDrop(drops, spent, req, res); });
  httpServer.on("upgrade", (_req: IncomingMessage, socket: Duplex) => {
    console.log(`[herm-relay] ${SHUT_WHY}`);
    try { opts.onShut?.(MEMBERSHIP_RELAY_SHUT); } catch { /* a log never decides */ }
    socket.destroy();
  });
  await new Promise<void>((resolve) => httpServer.listen(port, resolve));
  const addr = httpServer.address();
  const boundPort = typeof addr === "object" && addr ? addr.port : port;
  return {
    port: boundPort,
    gatePubKey,
    // A drop request's kept-alive connection would hold the close open; cut every one.
    close: () => new Promise<void>((resolve) => { httpServer.close(() => resolve()); httpServer.closeAllConnections(); }),
  };
}

/** What one connection may spend on drop deposits before it meets silence: a count and a byte total. */
export const DROP_CONNECTION_BUDGET = { deposits: 64, bytes: 1024 * 1024 } as const;
const DROP_PATH_RE = new RegExp(`^${PERSONA_KEL_DROP_ROUTE}([0-9a-f]{64})$`);

/**
 * A drop journal on disk: one JSON line per kept deposit, appended as it lands; a whole rewrite (to a sibling file,
 * then renamed over) when the store lets go of drops or reads the journal back. A line that does not parse reads as
 * nothing, and every line the store reads back verifies again.
 */
export function fileDropJournal(path: string): PersonaKelDropJournal {
  return {
    load() {
      let text: string;
      try { text = readFileSync(path, "utf8"); } catch { return []; }
      const out: Array<{ name: string; deposit: unknown }> = [];
      for (const line of text.split("\n")) {
        if (line.length === 0) continue;
        try {
          const v = JSON.parse(line) as { name?: unknown; deposit?: unknown };
          if (typeof v.name === "string") out.push({ name: v.name, deposit: v.deposit });
        } catch { /* a torn line reads as nothing */ }
      }
      return out;
    },
    append(name, deposit) {
      try { mkdirSync(dirname(path), { recursive: true }); appendFileSync(path, `${JSON.stringify({ name, deposit })}\n`); } catch { /* a full disk keeps memory alone */ }
    },
    rewrite(entries) {
      try {
        mkdirSync(dirname(path), { recursive: true });
        const tmp = `${path}.lar-tmp`;
        writeFileSync(tmp, entries.map((e) => `${JSON.stringify(e)}\n`).join(""));
        renameSync(tmp, path);
      } catch { /* a full disk keeps memory alone */ }
    },
  };
}

/**
 * Answer one plain request on the relay port: a successor drop's read or deposit, or silence. Silence: the cut
 * socket every closed door shows — no status, no body, no header. A drop answers with CORS open, so a browser leaf
 * reads it from any page; the POST takes `text/plain`, which no preflight precedes. A deposit whose declared or read
 * length passes the body cap, or that passes its connection's budget, meets silence before the store reads it.
 */
function serveDrop(drops: PersonaKelDropStore, spent: WeakMap<object, { deposits: number; bytes: number }>, req: IncomingMessage, res: ServerResponse): void {
  const silence = (): void => { res.socket?.destroy(); };
  const match = DROP_PATH_RE.exec(new URL(req.url ?? "/", "http://localhost").pathname);
  if (!match) { silence(); return; }
  const name = match[1]!;
  if (req.method === "GET") {
    const held = drops.pull(name);
    if (held.length === 0) { silence(); return; }
    res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
    res.end(JSON.stringify(held));
    return;
  }
  if (req.method !== "POST" || !req.socket) { silence(); return; }
  const budget = spent.get(req.socket) ?? { deposits: 0, bytes: 0 };
  spent.set(req.socket, budget);
  budget.deposits += 1;
  const declared = Number(req.headers["content-length"] ?? "0");
  if (budget.deposits > DROP_CONNECTION_BUDGET.deposits || declared > PERSONA_KEL_DROP_BODY_CAP) { silence(); req.destroy(); return; }
  const chunks: Buffer[] = [];
  let size = 0;
  let cut = false;
  req.on("data", (c: Buffer) => {
    if (cut) return;
    size += c.length;
    budget.bytes += c.length;
    if (size > PERSONA_KEL_DROP_BODY_CAP || budget.bytes > DROP_CONNECTION_BUDGET.bytes) { cut = true; silence(); req.destroy(); }
    else chunks.push(c);
  });
  req.on("end", () => {
    if (cut) return;
    let raw: unknown;
    try { raw = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { silence(); return; }
    if (!drops.deposit(name, raw)) { silence(); return; }
    res.writeHead(204, { "access-control-allow-origin": "*" });
    res.end();
  });
  req.on("error", silence);
}

/**
 * The membership channel of the shut relay: `connect` rejects with `membership-relay-shut` and opens no socket. The class
 * stays so a composer that names it (the carriage serve-loop) reads the refusal by name and does not retry.
 */
export class AuthenticatedWSMembershipChannel implements MembershipChannel {
  private constructor() {}

  static connect(
    _address: string,
    _peerSeed: Uint8Array,
    _opts?: { readonly onClose?: () => void; readonly onEnvelope?: (env: MembershipEnvelope) => void },
  ): Promise<AuthenticatedWSMembershipChannel> {
    return Promise.reject(new Error(SHUT_WHY));
  }

  async offer(_env: MembershipEnvelope): Promise<void> { throw new Error(SHUT_WHY); }
  async poll(_recipient: string): Promise<readonly MembershipEnvelope[]> { return []; }
  close(): void { /* nothing opened */ }
}
