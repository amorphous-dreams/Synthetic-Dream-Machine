/**
 * The seed the page boots, and the anchor it checks that seed against before a crossing.
 *
 * ONE SERVED SEED. The page carries no genesis of its own: it reads `seed.json` off the genesis base its URL names
 * (default `/genesis`, which the hearth's Pronaos serves off the hearth's own genesis root, and the dev server serves off
 * the tree's). The seed CID hashes the seed bytes as served (pronaos: "one seed, one CID").
 *
 * THE ANCHOR. Before the page dials a relay it reads the arrival descriptor at the relay's own origin
 * (`/.well-known/lar`) and the seed CID its `genesis-seed` route names. A served seed whose CID differs refuses the
 * crossing by name: `genesis-mismatch: page <cid> · hearth <cid>`. Both bytes come off the house's own origin, so the
 * check reads SELF-CONSISTENCY: it catches a stale or half-written serve and a page booted off another tree's genesis,
 * and it never catches a lying hearth. A second channel (a held pin, a signed release) carries that weight.
 *
 * A relay origin that answers no descriptor (a relay without a composed Pronaos) crosses uncompared and names it, so
 * the absent check never reads as a passed one.
 */

/** A fetch narrowed to the one call this module makes. */
export type SeedFetch = (input: string) => Promise<Response>;

export interface ServedSeed {
  /** The parsed seed, as the vessel consumes it. */
  readonly seed: unknown;
  /** sha256 over the seed bytes as served, lowercase hex. */
  readonly cid: string;
}

export type SeedAnchor =
  | { readonly kind: "descriptor"; readonly seedCid: string; readonly at: string }
  | { readonly kind: "missing"; readonly at: string; readonly why: string };

export type CrossingVerdict =
  | { readonly kind: "cross" }
  | { readonly kind: "uncompared"; readonly text: string }
  | { readonly kind: "refuse"; readonly text: string };

const CID = /^[0-9a-f]{64}$/;
/** The seed format's name; the vessel's materializer (`GENESIS_SEED_FORMAT`) refuses any version but its own. */
const SEED_FORMAT_NAME = "lararium-genesis-seed/";

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes as BufferSource));
  return [...digest].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Read the seed at `<base>/seed.json`; a reply that carries no genesis seed refuses as `genesis-unserved`. */
export async function readServedSeed(base: string, fetchFn: SeedFetch): Promise<ServedSeed> {
  const url = `${base.replace(/\/+$/, "")}/seed.json`;
  const response = await fetchFn(url);
  if (!response.ok) throw new Error(`genesis-unserved: ${url} answered ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let seed: unknown;
  try { seed = JSON.parse(new TextDecoder().decode(bytes)); }
  catch { seed = null; }
  if (!seed || typeof seed !== "object" || !String((seed as { format?: unknown }).format).startsWith(SEED_FORMAT_NAME)) {
    throw new Error(`genesis-unserved: ${url} reads as no genesis seed`);
  }
  return { seed, cid: await sha256Hex(bytes) };
}

/** The http(s) origin a ws(s) relay URL stands on. */
function relayOrigin(relayUrl: string): string {
  const url = new URL(relayUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : url.protocol === "ws:" ? "http:" : url.protocol;
  return url.origin;
}

/** The seed CID the relay origin's arrival descriptor names, or the reason none reads. */
export async function arrivalSeedAnchor(relayUrl: string, fetchFn: SeedFetch): Promise<SeedAnchor> {
  const at = `${relayOrigin(relayUrl)}/.well-known/lar`;
  let body: unknown;
  try {
    const response = await fetchFn(at);
    if (!response.ok) return { kind: "missing", at, why: `answered ${response.status}` };
    body = JSON.parse(await response.text());
  } catch (error) {
    return { kind: "missing", at, why: error instanceof SyntaxError ? "answered no JSON" : "unreachable" };
  }
  const descriptor = body as { format?: unknown; routes?: unknown } | null;
  if (descriptor?.format !== "lar-arrival" || !Array.isArray(descriptor.routes)) return { kind: "missing", at, why: "answered no arrival descriptor" };
  const route = descriptor.routes.find((r: unknown) => (r as { kind?: unknown } | null)?.kind === "genesis-seed") as { seedCid?: unknown } | undefined;
  return typeof route?.seedCid === "string" && CID.test(route.seedCid)
    ? { kind: "descriptor", seedCid: route.seedCid, at }
    : { kind: "missing", at, why: "names no genesis-seed route" };
}

/** Whether the page crosses on the seed it booted, against the anchor it read. */
export function genesisCrossingVerdict(pageSeedCid: string, anchor: SeedAnchor): CrossingVerdict {
  if (anchor.kind === "missing") {
    return { kind: "uncompared", text: `arrival-descriptor-missing: ${anchor.at} (${anchor.why}) · page seed ${pageSeedCid} crosses uncompared` };
  }
  if (anchor.seedCid === pageSeedCid) return { kind: "cross" };
  return {
    kind: "refuse",
    text: `genesis-mismatch: page ${pageSeedCid} · hearth ${anchor.seedCid} — self-consistency against the hearth's arrival descriptor ${anchor.at}; ` +
      "the page booted another seed than the one its hearth names, so it does not cross. Reload once the hearth serves one seed, or open the page the hearth's banner prints.",
  };
}
