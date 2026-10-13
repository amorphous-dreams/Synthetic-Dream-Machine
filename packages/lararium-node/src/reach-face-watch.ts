/**
 * reach-face-watch — what a vessel says about the one setting that names its reach face.
 *
 * One setting, `LAR_PUBLIC_URL`, names the face a browser or a peer dials. Every URL the vessel writes about
 * itself derives from that setting, and nothing a request says renames the vessel: `Host`,
 * `X-Forwarded-Host`, `X-Forwarded-Proto` and every other header arrive from whoever sent the request.
 *
 * This module holds the two lines that guard the crossing from the desk to the house network, where a wrong
 * or missing setting first shows:
 *   · THE BOOT NOTICE. A vessel standing without the setting says so once at boot, in one loud line that
 *     names the loopback address it prints in the setting's place. A setting that names a loopback host
 *     leaves the same gap (a phone cannot dial it), and a setting that names no bare http origin (another
 *     scheme, a path, a query, credentials) names nothing a browser dials; each earns a line of its own.
 *   · THE MISMATCH LINE. A request that arrives under a host other than the one the setting names logs once
 *     per boot. The vessel keeps serving under the setting; the line tells the operator that a resolver, a
 *     terminator or the setting itself fell out of step. A loopback host reads as no mismatch: the vessel
 *     publishes on loopback by law, and the operator's own machine and a container's health probe dial it
 *     there. Such a request spends nothing, so the one line stays for a host that names another machine.
 *
 * The readers here stay pure: each takes the setting and a request's headers and returns a line. `mountReachFaceWatch`
 * seats the watch on a server as an observer that answers nothing, and the entry (`main.ts`) prints what it
 * hands back. The watch reads a header as a description of one request. It yields a line for the log and
 * nothing else, so no caller can build a name from what it read.
 *
 * Canon: lar:///ha.ka.ba/lararium/mesh/secure-context (#/behind-the-terminator)
 */

/** The setting that names the reach face. */
export const REACH_FACE_SETTING = "LAR_PUBLIC_URL" as const;

/**
 * The authority (`host[:port]`, lowercase, default port dropped) a declared reach face names, or null where the
 * setting names none. A reach face reads as a bare http(s) ORIGIN: a scheme, a host and an optional port.
 * Credentials, a path, a query or a fragment name something other than a face a browser dials.
 */
export function declaredAuthority(declaredUrl: string | null | undefined): string | null {
  const declared = declaredUrl?.trim();
  if (!declared) return null;
  try {
    const url = new URL(declared);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) return null;
    return url.host.toLowerCase().replace(/\.(?=:|$)/, "");
  } catch { return null; }
}

/**
 * The boot notice: one loud line where no setting stands, null where one does. `loopbackOrigin` names the
 * address the vessel prints in the setting's place.
 */
export function reachFaceBootNotice(declaredUrl: string | null | undefined, loopbackOrigin: string): string | null {
  if (declaredUrl?.trim()) {
    const authority = declaredAuthority(declaredUrl);
    if (authority === null) {
      return `⚠ ${REACH_FACE_SETTING} NAMES NO BARE HTTP ORIGIN (${JSON.stringify(declaredUrl)}) — every URL this vessel prints about itself carries that value as written; set it to the one http(s) origin a browser or a peer dials: a scheme, a host, an optional port.`;
    }
    if (isLoopback(authority)) {
      return `⚠ ${REACH_FACE_SETTING} NAMES LOOPBACK (${JSON.stringify(authority)}) — every URL this vessel prints about itself carries that name, and a phone or a peer on another machine cannot dial it: set ${REACH_FACE_SETTING} to the one origin they reach.`;
    }
    return null;
  }
  return `⚠ NO ${REACH_FACE_SETTING} — this vessel declares no reach face: its mesh standing names ${loopbackOrigin}, its banner lists loopback beside each interface address, and an admit carries no relay address. ` +
    `A phone or a peer on another machine holds no declared name to dial: set ${REACH_FACE_SETTING} to the one origin they reach.`;
}

/** Whether an authority names this machine's own loopback face. */
function isLoopback(authority: string): boolean {
  const host = authority.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  return host === "localhost" || host.endsWith(".localhost") || /^127(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(host) || host === "::1";
}

/** A `Host` value that reads as a bare authority: a name or an address literal, and an optional port. */
const BARE_AUTHORITY = /^(?:\[[0-9a-f:.]+\]|[^\s/@?#[\]:\\]+)(?::\d{1,5})?$/i;

/** The longest host a mismatch line carries: a name runs to 253 characters, and a port adds six. */
const LONGEST_HOST = 259;

/**
 * The authority a request's own `Host` header names, normalised the way {@link declaredAuthority} reads the
 * setting. A value that carries userinfo, a path or anything else beside a bare authority reads as written
 * (and so as a mismatch): a URL parser would read `stranger@declared` down to the declared name.
 */
function requestAuthority(host: string | readonly string[] | undefined, declaredScheme: "http" | "https"): string | null {
  const raw = (Array.isArray(host) ? host[0] : host as string | undefined)?.trim().toLowerCase();
  if (!raw) return null;
  if (!BARE_AUTHORITY.test(raw)) return raw.slice(0, LONGEST_HOST);
  try { return new URL(`${declaredScheme}://${raw}`).host.replace(/\.(?=:|$)/, ""); } catch { return raw.slice(0, LONGEST_HOST); }
}

export interface ReachFaceWatch {
  /** Read one request's headers. Returns the mismatch line the first time a request names another host, and null every other time. */
  observe(headers: Readonly<Record<string, string | readonly string[] | undefined>>): string | null;
}

/**
 * The once-per-boot mismatch watch. Where no setting stands, or the setting names no http origin, no request
 * can mismatch it and the watch stays silent: the boot notice already said so.
 */
export function makeReachFaceWatch(declaredUrl: string | null | undefined): ReachFaceWatch {
  const declared = declaredAuthority(declaredUrl);
  if (declared === null) return { observe: () => null };
  const scheme = declaredUrl!.trim().toLowerCase().startsWith("https:") ? "https" : "http";
  let said = false;
  return {
    observe(headers) {
      if (said) return null;
      const asked = requestAuthority(headers["host"], scheme);
      if (asked === null || asked === declared || isLoopback(asked)) return null;
      said = true;
      return `⚠ a request arrived under host ${JSON.stringify(asked)}, and ${REACH_FACE_SETTING} names ${JSON.stringify(declared)} — this vessel keeps naming itself by the setting. ` +
        `A resolver, a terminator or the setting fell out of step. (Said once per boot.)`;
    },
  };
}

/** The slice of an HTTP server the watch seats on. */
export interface WatchedServer {
  on(event: "request" | "upgrade", listener: (req: { readonly headers: Readonly<Record<string, string | readonly string[] | undefined>> }) => void): unknown;
  off(event: "request" | "upgrade", listener: (req: { readonly headers: Readonly<Record<string, string | readonly string[] | undefined>> }) => void): unknown;
}

/**
 * Seat the mismatch watch on a server: it observes every request and every upgrade, answers neither, and
 * hands `log` the mismatch line the one time it speaks. Returns the hand that unseats it.
 */
export function mountReachFaceWatch(args: {
  readonly httpServer:  WatchedServer;
  readonly declaredUrl: string | null | undefined;
  readonly log:         (line: string) => void;
}): () => void {
  const watch = makeReachFaceWatch(args.declaredUrl);
  const observe = (req: { readonly headers: Readonly<Record<string, string | readonly string[] | undefined>> }): void => {
    // An observer never reaches into serving: a read that throws, or a log that throws, ends here.
    try {
      const line = watch.observe(req.headers);
      if (line !== null) args.log(line);
    } catch { /* the request goes on to its face */ }
  };
  args.httpServer.on("request", observe);
  args.httpServer.on("upgrade", observe);
  return () => { args.httpServer.off("request", observe); args.httpServer.off("upgrade", observe); };
}
