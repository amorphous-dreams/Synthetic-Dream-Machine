/**
 * edge-seats — the vessel's half of the key side of a removal (kapae#/keys): the FACTS it reads off its fleet's
 * edge board, and the MARKS it keeps once the key shore answered.
 *
 * TWO SHORT ACTS AROUND ONE ISLAND VERB. The keys of a face's group live in the daemon island, and the edge
 * board and this vessel's ledger live here. So a settle runs in three steps: this module reads the facts
 * (`runEdgeSeatFacts`), the island answers them (`seat-duties`), and this module marks the raises the island
 * answered (`runEdgeSeatMarks`). Each step stands whole alone: facts read twice plan the same duties, and a
 * mark lands once.
 *
 * NO COORDINATOR AND NO CLOCK. Every vessel that reads the board runs the same three steps for itself. The mark
 * rides this vessel's own ledger, which crosses to no other operator.
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/kapae#/keys
 */
import type { Repo } from "@automerge/automerge-repo";
import {
  fleetEdgeBoardDocUrl, fleetEdgeAuthority, deviceEdgeId, faceAtomKeyFromSeed, raisesSeenThrough, raisesMarkedAnswered, markRaiseRolled, verifiedSeatRoll,
  type EdgeKapae, type SignedSeatRoll,
} from "@lararium/mesh";
import { listPersonaRoots, loadPersonaGroupRootVerifyingKey } from "../node-vessel-identity.js";
import { loadIdentityAnchors } from "../identity-anchors.js";
import { loadFaceAtomOfGroup } from "../face-atom-store.js";
import { readVesselEdgeBoard } from "../edge-board.js";

export class EdgeSeatError extends Error {}

const HEX64 = /^[0-9a-f]{64}$/;
const bare = (key: string): string => key.trim().toLowerCase().replace(/^0x/, "");

/** What this vessel read off one fleet's edge board: the island's `seat-duties` verb takes it as it stands. */
export interface EdgeSeatFacts {
  readonly fleetRoot: string;
  /** The acts this vessel counted on the board, signatures and all: the island counts them again. */
  readonly acts:      readonly EdgeKapae[];
  readonly rolled:    readonly string[];
  /** What the fold reads, for a person: each edge that carries a counted raise, and whether its shadow stands. */
  readonly edges:     readonly { readonly edgeId: string; readonly aside: boolean; readonly raiseCids: readonly string[] }[];
  /** True when a shadow stands over THIS vessel's own device edge. */
  readonly selfAside: boolean;
}

/** The fleet roots this vessel serves: the root of every face it holds. */
async function servedFleetRoots(): Promise<string[]> {
  const roots: string[] = [];
  for (const index of await listPersonaRoots()) {
    const key = await loadPersonaGroupRootVerifyingKey(index);
    if (key) roots.push(bare(key));
  }
  return [...new Set(roots)].sort();
}

/**
 * The fleet a vessel WEARS, as its composer reads it (road `T34`): the root its own device edge names and its own atom key,
 * which names its ledger and signs its roll receipts. A joinee holds no root of that fleet, so the roster never decides
 * whether it reads its own fleet: the device edge does.
 */
export interface WornFleet {
  readonly fleetRoot: string;
  readonly atomKey:   string;
}

/** The fleet one door acts on and the key that names this vessel's ledger there: the worn fleet under its own atom, or a
 *  fleet the roster serves under that face's atom. Any other fleet refuses by name. */
async function seatOf(fleetRoot: string, worn: WornFleet | undefined, refusal: string): Promise<{ readonly fleetRoot: string; readonly vesselKey: string }> {
  if (worn !== undefined) {
    const wornRoot = bare(worn.fleetRoot), atomKey = bare(worn.atomKey);
    if (!HEX64.test(wornRoot) || !HEX64.test(atomKey)) throw new EdgeSeatError("the worn fleet names a 64-hex root and a 64-hex atom key.");
    if (wornRoot === fleetRoot) return { fleetRoot, vesselKey: atomKey };
  }
  if (!(await servedFleetRoots()).includes(fleetRoot)) throw new EdgeSeatError(refusal);
  return { fleetRoot, vesselKey: await atomKeyForFleet(fleetRoot) };
}

async function atomKeyForFleet(fleetRoot: string): Promise<string> {
  for (const index of await listPersonaRoots()) {
    if (bare((await loadPersonaGroupRootVerifyingKey(index)) ?? "") !== fleetRoot) continue;
    const anchors = await loadIdentityAnchors(index);
    const seed = anchors ? await loadFaceAtomOfGroup(anchors.personaGroupId) : null;
    if (!anchors || !seed) throw new EdgeSeatError("this face holds no atom; re-found or re-admit it");
    return faceAtomKeyFromSeed(seed, anchors.personaGroupId).key;
  }
  throw new EdgeSeatError("this vessel holds no face under that fleet root");
}

/**
 * Read the facts for each fleet this vessel serves, or for the one it names among them. The read runs through
 * the vessel's ledger, so a raise a hand deleted from the board still counts here.
 */
export async function runEdgeSeatFacts(opts: { readonly repo: Repo; readonly fleetRoot?: string; readonly worn?: WornFleet }): Promise<{ readonly fleets: readonly EdgeSeatFacts[] }> {
  const refusal = "REFUSED: this vessel holds no face under that fleet root — a vessel settles its own fleets alone.";
  let roots: string[];
  if (opts.fleetRoot !== undefined) {
    const named = bare(opts.fleetRoot);
    if (!HEX64.test(named)) throw new EdgeSeatError(`--fleet expects a 64-hex fleet root, got "${opts.fleetRoot}".`);
    roots = [named];
  } else roots = opts.worn !== undefined ? [bare(opts.worn.fleetRoot)] : await servedFleetRoots();
  const fleets: EdgeSeatFacts[] = [];
  for (const root of roots) {
    const { fleetRoot, vesselKey } = await seatOf(root, opts.worn, refusal);
    const read = await readVesselEdgeBoard({
      repo: opts.repo, scope: fleetRoot, kind: "fleet", boardUrl: fleetEdgeBoardDocUrl(fleetRoot), label: "board:edge-kapae",
      vesselKey, authorityFor: fleetEdgeAuthority(fleetRoot),
    });
    const edges = [...read.readings].filter(([, r]) => r.stands || r.raiseCids.length > 0)
      .map(([edgeId, r]) => ({ edgeId, aside: r.stands, raiseCids: [...r.raiseCids] }))
      .sort((a, b) => a.edgeId.localeCompare(b.edgeId));
    fleets.push({
      fleetRoot, acts: [...read.counted.acts].sort((a, b) => a.actCid.localeCompare(b.actCid)), edges,
      // A raise answered with no authority over its seat stays owed: the island tries it again at each settle.
      rolled: [...raisesSeenThrough(read.ledger.doc(), fleetRoot, vesselKey)].sort(),
      selfAside: read.readings.get(deviceEdgeId(fleetRoot, vesselKey))?.stands === true,
    });
  }
  await opts.repo.flush();
  return { fleets };
}

/**
 * The raises this vessel counts on the fleet it WEARS, and those no subscriber has taken yet (no signed mark): what the
 * content-key holder counts a removal version by, and what it owes a roll for, a restart included. The read runs through
 * the ledger, as `runEdgeSeatFacts` does, so a raise deleted from the board still counts.
 *
 * THE WORN FACE DECIDES, NEVER THE ROSTER (roads `T34`, `T35`): `worn` names the root the vessel's device edge pins and
 * its own atom key, a joinee's as a founder's. Only a vessel that wears no face (`worn: null`) answers `read: false`,
 * and the island judges that. A worn face whose root or atom stands unread refuses by name, so the sign door refuses
 * and nothing seals on a head an owed removal should have moved; it never answers a silent zero.
 */
export async function fleetRaisesOf(opts: {
  readonly repo: Repo; readonly worn: { readonly fleetRoot: string | null; readonly atomKey: string | null } | null;
}): Promise<{ readonly read: boolean; readonly counted: readonly string[]; readonly unanswered: readonly string[] }> {
  if (opts.worn === null) return { read: false, counted: [], unanswered: [] };
  const { fleetRoot: wornRoot, atomKey } = opts.worn;
  if (wornRoot === null || atomKey === null) {
    throw new EdgeSeatError(`the worn face reads no fold yet: its ${wornRoot === null ? "fleet root" : "atom"} stands unread, and a fold never reads a silent zero.`);
  }
  const worn: WornFleet = { fleetRoot: wornRoot, atomKey };
  const { fleetRoot, vesselKey } = await seatOf(bare(wornRoot), worn, "the worn fleet reads no board here.");
  const read = await readVesselEdgeBoard({
    repo: opts.repo, scope: fleetRoot, kind: "fleet", boardUrl: fleetEdgeBoardDocUrl(fleetRoot), label: "board:edge-kapae",
    vesselKey, authorityFor: fleetEdgeAuthority(fleetRoot),
  });
  const counted = [...new Set([...read.readings.values()].flatMap((r) => [...r.raiseCids]))].sort();
  const answered = raisesMarkedAnswered(read.ledger.doc(), fleetRoot, vesselKey);
  return { read: true, counted, unanswered: counted.filter((cid) => !answered.has(cid)) };
}

/**
 * Keep the rolls the key shore answered, in this vessel's own ledger: one mark for each raise, with the roll
 * beside it. A roll counts here only under a RECEIPT this vessel's own key signed (its daemon island signs each
 * roll it answers), only for a fleet this vessel serves, and only for a raise this vessel COUNTS on that
 * fleet's board, on the edge the fold holds it on. So no caller types a roll the key shore never gave, and no
 * hand marks a raise ahead of its arrival. The first mark of a raise stands.
 */
export async function runEdgeSeatMarks(opts: {
  readonly repo: Repo; readonly fleetRoot?: string; readonly worn?: WornFleet; readonly rolls: readonly unknown[];
}): Promise<{ readonly fleetRoot: string; readonly marked: readonly string[]; readonly unknown: readonly string[] }> {
  const named = bare(opts.fleetRoot ?? opts.worn?.fleetRoot ?? "");
  if (!HEX64.test(named)) throw new EdgeSeatError("a mark names its fleet root — expected 64 hex.");
  const { fleetRoot, vesselKey } = await seatOf(named, opts.worn,
    "REFUSED: this vessel holds no face under that fleet root — it keeps no roll for another fleet.");
  const read = await readVesselEdgeBoard({
    repo: opts.repo, scope: fleetRoot, kind: "fleet", boardUrl: fleetEdgeBoardDocUrl(fleetRoot), label: "board:edge-kapae",
    vesselKey, authorityFor: fleetEdgeAuthority(fleetRoot),
  });
  // raise cid → the edge it rides: a roll marks a raise only on the edge that carries it.
  const raiseEdge = new Map<string, string>();
  for (const [edgeId, r] of read.readings) for (const cid of r.raiseCids) raiseEdge.set(cid, edgeId);
  const marked: string[] = [], unknown: string[] = [];
  const keep: { cid: string; roll: SignedSeatRoll }[] = [];
  for (const raw of opts.rolls) {
    // ONLY THIS VESSEL'S OWN ISLAND ANSWERS FOR ITS KEYS: a roll counts under a receipt this vessel's key signed.
    const roll = verifiedSeatRoll(raw, vesselKey);
    const typed = Array.isArray((raw as { raiseCids?: unknown } | null)?.raiseCids)
      ? ((raw as { raiseCids: unknown[] }).raiseCids).filter((c): c is string => typeof c === "string").map((c) => c.toLowerCase()) : [];
    if (roll === null || bare(roll.scope) !== fleetRoot) { unknown.push(...typed); continue; }
    const edgeId = roll.edgeId.toLowerCase();
    for (const cid of roll.raiseCids.map((c) => c.toLowerCase())) {
      if (raiseEdge.get(cid) !== edgeId) { unknown.push(cid); continue; }
      // The mark keeps the whole roll with its receipt: every reader verifies it again (road `T33`).
      keep.push({ cid, roll: { ...roll, receipt: (raw as { receipt: string }).receipt } });
      marked.push(cid);
    }
  }
  if (keep.length > 0) read.ledger.change((d) => { for (const k of keep) markRaiseRolled(d, fleetRoot, k.cid, k.roll, vesselKey); });
  await opts.repo.flush();
  return { fleetRoot, marked: [...new Set(marked)].sort(), unknown: [...new Set(unknown)].sort() };
}
