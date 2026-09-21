/**
 * lan-address — derive the reach-faces a vessel actually answers on.
 *
 * The server binds `0.0.0.0`, so it answers on EVERY interface the host holds. A banner that names
 * only `localhost` therefore under-reports the vessel: the operator standing at a phone reads a name
 * that resolves, on that phone, to the phone itself. The vessel knows its own interfaces; it says them.
 *
 * Everything here stays PURE — it takes the interface table as an argument and returns strings. The IO
 * (calling `os.networkInterfaces()`, printing the banner) lives at the boot shore in main.ts. That split
 * lets the whole derivation run under a fixed interface table in a test, with no host to depend on.
 *
 * `LAR_PUBLIC_URL` leads when the operator sets it: a declared reach-face names the RELAY reachability
 * the OPERATOR made (a tunnel, a reverse proxy, a name in DNS), which the interface table cannot see and
 * must never override. It does not silently name the Web or oracle origin; those are explicit composition
 * inputs below.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/lan-address
 */

/** The shape `os.networkInterfaces()` yields, narrowed to the two fields the ranking reads. */
export interface InterfaceAddress {
  address:  string;
  family?:  string | number;
  internal: boolean;
}
export type InterfaceTable = Record<string, InterfaceAddress[] | undefined>;

/** An IPv4 address ranks by REACHABILITY from a phone on the same house network. */
function rankIPv4(addr: string): number {
  if (addr.startsWith("192.168.")) return 0;                        // the household router's own range
  if (addr.startsWith("10."))      return 1;                        // the larger private block
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(addr)) return 2;            // the middle private block
  if (addr.startsWith("169.254."))             return 4;            // self-assigned — carries last, never dropped
  return 3;                                                          // anything else routable
}

/** Read the IPv4 family off an entry — node reports `"IPv4"` on current releases and `4` on older tables. */
function isIPv4(a: InterfaceAddress): boolean {
  return a.family === "IPv4" || a.family === 4;
}

/**
 * Collect the non-internal IPv4 addresses a host answers on, most-reachable first.
 *
 * Loopback drops out (`internal`) because `localhost` already names it, and IPv6 drops out because an
 * operator types these by thumb. Ties hold the interface table's own order, so the banner reads the same
 * way twice in a row on an unchanged host.
 */
export function lanIPv4Addresses(interfaces: InterfaceTable): string[] {
  const found: string[] = [];
  for (const entries of Object.values(interfaces)) {
    for (const a of entries ?? []) {
      if (a.internal || !isIPv4(a) || !a.address) continue;
      if (!found.includes(a.address)) found.push(a.address);
    }
  }
  return found
    .map((address, i) => ({ address, i, rank: rankIPv4(address) }))
    .sort((x, y) => x.rank - y.rank || x.i - y.i)
    .map((e) => e.address);
}

/** One face the vessel answers on. `origin` carries an http origin; `host` carries the bare authority. */
export interface ReachFace {
  /** `declared` names the relay reach face (usually LAR_PUBLIC_URL), `loopback` names localhost, `lan` names an interface address. */
  kind:   "declared" | "loopback" | "lan";
  host:   string;
  origin: string;
}

/**
 * Derive every http origin this vessel answers on, in the order an operator reads them.
 *
 * A declared URL leads (the operator's own truth about reachability), loopback follows (the face the
 * operator's own machine uses), then each LAN address. Duplicate origins collapse — a declared URL that
 * already names an interface address prints once.
 */
export function deriveReachFaces(opts: {
  port:         number;
  declaredUrl?: string | null;
  interfaces:   InterfaceTable;
}): ReachFace[] {
  const faces: ReachFace[] = [];
  const push = (kind: ReachFace["kind"], host: string, origin: string): void => {
    if (faces.some((f) => f.origin === origin)) return;
    faces.push({ kind, host, origin });
  };
  const declared = opts.declaredUrl?.trim();
  if (declared) {
    let host = declared.replace(/^\w+:\/\//, "").replace(/\/.*$/, "");
    try { host = new URL(declared).host; } catch { /* a non-URL declaration still yields its authority */ }
    push("declared", host, declared.replace(/\/+$/, ""));
  }
  push("loopback", `localhost:${opts.port}`, `http://localhost:${opts.port}`);
  for (const ip of lanIPv4Addresses(opts.interfaces)) {
    push("lan", `${ip}:${opts.port}`, `http://${ip}:${opts.port}`);
  }
  return faces;
}

/** Turn an http origin into the `/ws` relay URL a leaf dials. `https` carries to `wss`. */
export function wsUrlForOrigin(origin: string): string {
  return origin.replace(/^http/, "ws").replace(/\/+$/, "") + "/ws";
}

/** Explicit origin composition supplied by the operator or deployment recipe. */
export interface ExplicitOriginComposition {
  /** Caller-declared Web origin; absent unless `sameOrigin` explicitly names the relay origin. */
  readonly webOrigin?: string | null;
  /** Caller-declared oracle/read-face origin; never inferred from the relay or Web origin. */
  readonly oracleOrigin?: string | null;
  /** Explicitly declare that Web, relay, and oracle share the relay face's origin. */
  readonly sameOrigin?: boolean;
}

/** The three reachability strings; the values carry no cap, identity, document, or merge decisions. */
export interface FaceOriginComposition {
  readonly webOrigin: string;
  readonly relayOrigin: string;
  readonly oracleOrigin: string;
}

function explicitOrigin(value: string | null | undefined, label: string): string {
  const origin = value?.trim().replace(/\/+$/, "");
  if (!origin) throw new Error(`[origin composition] ${label} origin must be declared`);
  return origin;
}

/**
 * Resolve a face's Web/relay/oracle origins from an explicit composition declaration.
 *
 * A relay face remains relay-only by default. The only legal shortcut is `sameOrigin: true`, which is
 * an operator declaration that all three surfaces share that face. Otherwise Web and oracle origins
 * must both be named independently. No port, hostname, `LAR_PUBLIC_URL`, cap, identity, document, or
 * clock value is promoted across surfaces by this helper.
 */
export function originCompositionForFace(face: ReachFace, declaration: ExplicitOriginComposition): FaceOriginComposition {
  const relayOrigin = explicitOrigin(face.origin, "relay");
  if (declaration.sameOrigin === true) {
    if (declaration.webOrigin?.trim() || declaration.oracleOrigin?.trim()) {
      throw new Error("[origin composition] sameOrigin cannot be combined with separate Web/oracle origins");
    }
    return { webOrigin: relayOrigin, relayOrigin, oracleOrigin: relayOrigin };
  }
  return {
    webOrigin: explicitOrigin(declaration.webOrigin, "Web"),
    relayOrigin,
    oracleOrigin: explicitOrigin(declaration.oracleOrigin, "oracle"),
  };
}

/**
 * The Web origin a reach-face advertises, from an explicit composition declaration.
 *
 * `webPort` remains in this migration-shaped signature so existing callers can move to the declaration
 * without a package rename. It is deliberately never used to infer an origin; omitted declaration now
 * refuses instead of treating a declared relay face as the Web surface.
 */
export function webOriginForFace(face: ReachFace, webPort: number, declaration?: ExplicitOriginComposition): string {
  if (!declaration) {
    throw new Error(`[origin composition] Web origin is undeclared; provide webOrigin or sameOrigin=true (webPort ${webPort} is not an origin declaration)`);
  }
  return originCompositionForFace(face, declaration).webOrigin;
}

/** Resolve the oracle/read-face origin without deriving it from the relay or Web origin. */
export function oracleOriginForFace(face: ReachFace, declaration: ExplicitOriginComposition): string {
  return originCompositionForFace(face, declaration).oracleOrigin;
}

/**
 * Build the crossing URL a leaf opens: the web origin, the relay it dials, and the GATE key its V3 proof
 * commits to. The relay rides the SAME name the web surface came from — a phone that loaded the web surface over a LAN
 * address cannot dial `localhost` (which on that phone names the phone), and a browser on a TLS name cannot
 * dial a `ws://` relay from an `https://` page (mixed content), so a declared face carries `wss` throughout.
 */
export function crossingUrl(opts: { webOrigin: string; wsUrl: string; gateKey: string }): string {
  return `${opts.webOrigin.replace(/\/+$/, "")}/?relay=${opts.wsUrl}&gate=${opts.gateKey}`;
}
