/**
 * `lares vessel floor status|accept [<release-cid>]|seed [--genesis <dir>]|adopt [--apply|--commit|--revert] [--genesis <dir>] [--nexus <aid>] [--porch <origin>]` — the vessel's pin on its Nexus's floor.
 * It rides the VESSEL door (the pin belongs to the vessel), never a top-level verb (the help's one-screen law).
 *
 * The VESSEL pins the floor (w26-floor-lane#/the-vessel-pin): one pin per (vessel, Nexus), in the vessel's control home.
 * `status` names the pinned release (or the genesis floor), the newest release the board shows, whether it descends from
 * the pin (a fast-forward) and whether a fork stands. `accept` fast-forwards along `prior` from the pin to the named
 * release, or the sole newest, verifying each one (the steward's seal, the cabal's approval, the epoch lineage); it refuses a
 * release that does not descend from the pin (`floor-not-descendant`) and refuses while two heads stand
 * (`floor-fork-unsettled`, naming both). Nothing accepts by itself. After an accept no island swaps its floor live, so each
 * live wiki raises the reboot-pending alert and the accepted floor mounts at the next boot. A seat session reads the status
 * and never accepts (`floor-needs-hand`).
 *
 * Both rows ride the store door (`floor-status`, `floor-accept`), so a standing vessel's own Repo answers.
 *
 * `seed [--genesis <dir>]` reads the seed a genesis dir offers (its CID and digests) beside the founding record's digests where
 * a house answers (`floor-status`), ratchet by ratchet; it moves nothing (`../seed-offered.ts`). The dir: `--genesis`, else the
 * one resolver's (`LAR_GENESIS`, the configured one, the root's, the shipped one), else the checkout's shipped genesis where
 * no house root stands. An image carries its genesis at `/app/genesis` (LAR_GENESIS), so inside a vessel this names the seed
 * the image offers; `--json` carries `seed`, and `--image <digest>` prints the whole pūlama frame (`{"digest":…,"seed":…}`) as
 * the one stdout line, which the shim hands to `pulama-main image '<frame>'` unparsed (it wins over `--json`). Where no house
 * answers (the one-shot image run at `up`), the founding record reads at boot.
 *
 * `status` prints both truths for every place (D1, shore recommendation 8): the founding record (the stored genesis island)
 * beside the seed (offered) and the floor pin, ratchet by ratchet. A place in no Nexus charter prints that part and names
 * the Nexus refusal on its own line; the read still answers.
 *
 * `adopt` (3d, follow-lei S2) reads the seed the genesis dir offers (its CID, the receipt, and its floor manifest, the genesis
 * witness) and asks the vessel to adopt that seed's plugins over the pin's base as a LOCAL FLOOR: bare it previews and moves nothing
 * (`floor-adopt`, open to a seat); `--apply` lands it, and `--commit` / `--revert` settle a staged one, each the hand's act
 * (`floor-adopt-apply`, `floor-needs-hand`). The engine never adopts here, and the founding record never moves. Once the hand
 * applies, a vessel whose custody a pūlama holds restands itself at its next quiet point, and the boot after commits the staged
 * floor at par or reverts it to the prior floor, naming why (`floor-restand`, `settleFloorAtBoot`); `status` reads that receipt.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-vessel-pin
 */
import { ratchetWords, ratchetsDiffer, type GenesisDigests, type RatchetDifference } from "@lararium/mesh/genesis-compare";
import { type FloorAcceptOutcome, type FloorStatus, type FloorAdoptOutcome, type FloorLocalAct, type FloorPin, type FloorSettleReceipt } from "@lararium/mesh/floor-pin";
import { type FloorDrift } from "@lararium/mesh/floor-drift";
import { GENESIS_FLOOR_TIDDLER } from "@lararium/mesh/floor-manifest";
import { type GenesisSeed } from "@lararium/mesh/genesis-doc";
import { ownEntry } from "@lararium/mesh/stored-value";
import { FloorRefused, FLOOR_GRAINS, floorCardFor, floorRowLine, readFloorDrifts, rowInGrain, type FloorCard, type FloorDriftRow, type FloorGrain, type FloorLagInput } from "@lararium/node";
import { emit, exitFor } from "../render.js";
import { storeVerb, storeFailure } from "../store-door.js";
import { runVerb } from "../verb-call.js";
import { readVerbOutcome } from "../verb-result.js";
import { vesselDid } from "../env.js";
import { readHouseLag } from "./lay.js";
import type { ParsedArgs } from "../parse-args.js";
import { HouseRootUnnamed, genesisSeedCid, resolveGenesis } from "@lararium/node";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@lararium/mesh/node";
import { existsSync } from "node:fs";
import { larBootstrapPath, larGenesisDir } from "../env.js";
import { udsAlive } from "../local-connector.js";
import { floorSeedRead, foundingRecordFromStatus, type FloorSeedRead } from "../seed-offered.js";

const short = (cid: string | null | undefined): string => (cid ? `${cid.slice(0, 16)}…` : "(genesis floor)");

/** What the floor-status row answers: the Nexus part where a charter stands, and both truths always. */
export type FloorStatusOutput = Partial<FloorStatus> & {
  readonly genesis?: {
    readonly record: GenesisDigests;
    readonly seed: { readonly cid: string; readonly ratchets: readonly RatchetDifference[] } | null;
    readonly floorPin: { readonly manifestCid: string; readonly ratchets: readonly RatchetDifference[] } | null;
    readonly line: string;
    readonly unread?: string;
  };
  readonly nexusRefused?: { readonly refusal: string; readonly message: string };
  /** How far the floor this vessel serves trails live public canon, by carrier; null (or absent, on a vessel older than the
   *  reading) where it does not read. */
  readonly floorDrift?: FloorDrift | null;
  /** Why `floorDrift` reads null, by name, where the vessel names it. */
  readonly floorDriftWhy?: string;
  /** The five drifts, each by its own word (`@lararium/node` floor-card); absent on a vessel older than the reading. */
  readonly drifts?: readonly FloorDriftRow[];
  /** The one card the read refreshed in the daemon wiki's working layer. */
  readonly card?: FloorCardReceipt;
  /** The latest settle of a staged local floor (the boot after its restand): committed at par, or reverted by cause. */
  readonly floorSettle?: FloorSettleReceipt;
};

/** What the card's write answered: its title and the door's decision (`put`, `noop`, or `unwritten` with the reason). */
export interface FloorCardReceipt { readonly title: string; readonly decision: string; readonly state: string; readonly why?: string }

/** The seed side speaks its floor by this name, so "the floor" names the canon floor alone. */
const seedWords = (rs: readonly RatchetDifference[]): string => rs.map((r) => `${r.ratchet === "floor" ? "the seed's floor" : r.ratchet} ${r.reading}`).join(" · ");

/** How many carrier names a drift line spells before it counts the rest. */
const DRIFT_NAMES = 8;
const named = (titles: readonly string[]): string =>
  `${titles.slice(0, DRIFT_NAMES).join(", ")}${titles.length > DRIFT_NAMES ? `, … ${titles.length - DRIFT_NAMES} more` : ""}`;

/** The drift's per-slug tally: `lararium 2 missing, 1 older · … · unread sdm`. */
export function floorDriftTally(d: FloorDrift): string {
  return [...d.slugs.map((s) => `${s.slug} ${s.missing.length} missing, ${s.older.length} older`), ...(d.unread.length > 0 ? [`unread ${d.unread.join(", ")}`] : [])].join(" · ");
}

/** The carrier names a drift reading spells, missing first, each line indented by `indent`. */
export function floorDriftNames(d: FloorDrift, indent: string): string[] {
  const missing = d.slugs.flatMap((s) => s.missing);
  const older = d.slugs.flatMap((s) => s.older);
  return [
    ...(missing.length > 0 ? [`${indent}missing: ${named(missing)}`] : []),
    ...(older.length > 0 ? [`${indent}older:   ${named(older)}`] : []),
  ];
}

/** The floor drift's lines on the status: the count by carrier and the names, or why it reads unread. */
function floorDriftLines(d: FloorDrift | null | undefined, why: string | undefined): string[] {
  if (d === undefined) return ["  floor drift:     unread (the standing vessel answers no drift reading: its build carries none, and a refresh brings it)"];
  if (d === null) return [`  floor drift:     unread (${why ?? "no reason named"})`];
  return [`  floor drift:     ${d.count} carrier(s) behind live canon · ${floorDriftTally(d)}`, ...floorDriftNames(d, "    ")];
}

/** One line per drift, by its own word; the canon row spells its carriers beneath. */
function driftRowLines(s: FloorStatusOutput, grain: FloorGrain): string[] {
  return (s.drifts ?? []).filter((r) => rowInGrain(r, grain)).flatMap((r) =>
    [floorRowLine(r), ...(r.word === "canon floor drift" && s.floorDrift ? [`    ${floorDriftTally(s.floorDrift)}`, ...floorDriftNames(s.floorDrift, "    ")] : [])]);
}

/** The human lines of `floor status`: both truths, then the Nexus part or its refusal by name. */
export function floorStatusLines(s: FloorStatusOutput, grain: FloorGrain = "all"): string[] {
  const lines: string[] = [s.nexus !== undefined ? `floor status · nexus ${s.nexus}` : "floor status"];
  if (grain !== "all" && s.drifts) return [...lines, ...driftRowLines(s, grain)];
  const g = s.genesis;
  if (g?.unread !== undefined) lines.push(`  founding record: unread here (${g.unread})`);
  else if (g) {
    const d = (v: string | null) => v ?? "absent";
    lines.push(`  founding record: engine ${d(g.record.engine)} · grammar ${d(g.record.grammar)} · lararium ${d(g.record.lararium)} · plugins ${d(g.record.plugins)} · floor ${d(g.record.floor)}`);
    lines.push(g.seed === null
      ? "  seed (offered):  none reads"
      : ratchetsDiffer(g.seed.ratchets)
        ? `  seed (offered):  ${g.seed.cid} — a newer seed waits: ${seedWords(g.seed.ratchets)}; the founding record keeps serving, and lay moves canon, never the founding record`
        : `  seed (offered):  ${g.seed.cid} — same on every ratchet`);
    lines.push(g.floorPin !== null
      ? `  floor pin:       ${g.floorPin.manifestCid} — ${ratchetWords(g.floorPin.ratchets)}`
      : s.nexusRefused
        ? "  floor pin:       none (no Nexus charter; the founding record's genesis floor serves)"
        : `  floor pin:       ${s.pinned?.manifest ?? "?"} — its manifest does not read from this vessel's CAS`);
  }
  lines.push(...(s.drifts ? driftRowLines(s, "all") : floorDriftLines(s.floorDrift, s.floorDriftWhy)));
  if (s.card) lines.push(`  card:            ${s.card.title} (${s.card.decision}${s.card.why ? `: ${s.card.why}` : ""})`);
  if (s.floorSettle) lines.push(floorSettleReceiptLine(s.floorSettle));
  if (s.nexusRefused) {
    lines.push(`  nexus:           refused ${s.nexusRefused.refusal} — ${s.nexusRefused.message}`);
    return lines;
  }
  if (s.pinned) lines.push(`  pinned:  ${short(s.pinned.release)}  floor ${short(s.pinned.manifest)}  (${s.pinSource})`);
  if (s.fork) lines.push(`  FORK:    ${s.fork.join(" · ")} — the cabal settles it; no accept moves until then`);
  else if (s.newest === null || s.newest === undefined) lines.push("  newest:  no release counts on the board");
  else lines.push(`  newest:  ${short(s.newest)}  ${s.newest === s.pinned?.release ? "(the pin)" : s.descends ? `fast-forward over ${s.path?.length ?? 0} release(s)` : "does NOT descend from the pin"}`);
  if (s.refused && s.refused.length > 0) lines.push(`  set aside: ${s.refused.map((r) => `${short(r.keyCid)} ${r.reason}`).join(", ")}`);
  return lines;
}

/** The human lines of `floor seed`: the seed (offered) with its CID and dir, then the founding record or why none reads. */
export function floorSeedLines(r: FloorSeedRead): string[] {
  if (r.offered === null) return ["floor seed", `  seed (offered):  none reads at ${r.genesis}`];
  const d = (v: string | null) => v ?? "absent";
  const o = r.offered.digests;
  const lines = ["floor seed", `  seed (offered):  ${r.offered.cid} at ${r.genesis}`,
    `  seed digests:    engine ${d(o.engine)} · grammar ${d(o.grammar)} · lararium ${d(o.lararium)} · plugins ${d(o.plugins)} · floor ${d(o.floor)}`];
  if (r.noHouse === true) lines.push("  founding record: reads at boot (no house answers here)");
  else if (r.offer === null) lines.push(`  founding record: unread here (${r.recordUnread ?? "no house answers"})`);
  else {
    const g = r.offer.record;
    lines.push(`  founding record: engine ${d(g.engine)} · grammar ${d(g.grammar)} · lararium ${d(g.lararium)} · plugins ${d(g.plugins)} · floor ${d(g.floor)}`);
  }
  lines.push(`  ${r.seed}`);
  return lines;
}

/** The genesis dir `floor seed` reads: the named one, else the one resolver's, else the checkout's shipped genesis. */
function floorSeedDir(args: ParsedArgs): string {
  const named = args.options["genesis"];
  if (named !== undefined && named.trim() !== "") return named;
  try { return larGenesisDir(); }
  catch (err) {
    if (!(err instanceof HouseRootUnnamed)) throw err;
    return resolveGenesis({ explicit: process.env["LAR_GENESIS"], corpusRoot: repoRoot, shippedRoot: repoRoot }).dir;
  }
}

/**
 * Does a house answer here? A daemon on the socket, or a vessel founded under the root (its bootstrap stands). The one-shot
 * image run at `up` holds neither, and the store door then opens nothing: the founding record reads at boot.
 */
async function houseAnswers(): Promise<boolean> {
  if (await udsAlive()) return true;
  try { return existsSync(larBootstrapPath()); }
  catch (err) { if (err instanceof HouseRootUnnamed) return false; throw err; }
}

/** `floor seed`: the read and its answer; the founding record reads through the store door, and its failure only names why. */
async function cmdFloorSeed(args: ParsedArgs): Promise<number> {
  // `--image <digest>`: the one stdout line becomes the whole pūlama frame, so a shim passes it straight on with no JSON in
  // shell. It wins over `--json`: the frame IS the machine line, and the envelope would only wrap what the shim hands on.
  const image = args.options["image"];
  if (image !== undefined && image.trim() === "") {
    emit(args, { ok: false, error: { code: "usage", message: "floor seed --image names the image digest the frame carries" }, human: () => console.error("lares vessel floor seed: --image takes the image digest (`--image <digest>`)") });
    return 2;
  }
  const read = await floorSeedRead({
    genesisDir: floorSeedDir(args),
    record: async () => {
      if (!(await houseAnswers())) return { noHouse: true };
      try { return foundingRecordFromStatus((await storeVerb("floor-status", {})).output, "the house answers no founding record"); }
      catch (err) { return { unread: (err instanceof Error ? err.message : String(err)).replace(/[\r\n]+/g, " ").trim() || "no house answers" }; }
    },
  });
  if (image !== undefined) {
    process.stdout.write(JSON.stringify({ digest: image.trim(), seed: read.seed }) + "\n");
    return 0;
  }
  emit(args, { ok: true, data: { ...read }, human: () => { for (const line of floorSeedLines(read)) console.log(line); } });
  return 0;
}

/** The doors `floor status` reads and writes through: the vessel's status, the lay's lag, the card's landing. */
export interface FloorDoors {
  status(common: Record<string, unknown>): Promise<Record<string, unknown>>;
  lag(): Promise<{ readonly lag: FloorLagInput | null; readonly why?: string }>;
  vessel(): Promise<string>;
  putCard(card: FloorCard): Promise<{ readonly decision: string; readonly why?: string }>;
}

/** Where the card lands unwritten, the cure rides the reason: a vessel standing, then the read again. */
const UNWRITTEN_CURE = "stand the vessel with `lares vessel stand`, then read again with `lares vessel floor status`";
const unwritten = (why: string): { decision: string; why: string } => ({ decision: "unwritten", why: `${why}; ${UNWRITTEN_CURE}` });

/** Land the card in the worn face's daemon wiki working layer through the tiddler door, as any hand's put would. */
async function putCardLive(card: FloorCard): Promise<{ decision: string; why?: string }> {
  let out;
  try { out = readVerbOutcome(await runVerb("tiddler-put", { recipe: "default", title: card.title, text: card.text, fields: card.fields }, await vesselDid())); }
  catch (e) { return unwritten((e instanceof Error ? e.message : String(e)).replace(/[\r\n]+/g, " ").trim()); }
  // AN OWED CARD LANDED IN THE VESSEL'S MEMORY AND WAITS ON A SESSION'S SEAL: the reason names that wait, never a vessel to stand.
  if (out.code === "owed") return { decision: "owed", why: out.error ?? "owed: the card's save waits unsealed" };
  return out.ok ? { decision: String(out.output["decision"] ?? "put") } : unwritten(out.error ?? "the door refused and named no reason");
}

export const LIVE_FLOOR_DOORS: FloorDoors = {
  status: async (common) => (await storeVerb("floor-status", common)).output,
  lag: async () => {
    try { return { lag: await readHouseLag() }; }
    catch (e) { return { lag: null, why: `the lay's lag faulted: ${(e instanceof Error ? e.message : String(e)).replace(/[\r\n]+/g, " ").trim()}` }; }
  },
  vessel: () => vesselDid(),
  putCard: putCardLive,
};

/**
 * THE ONE READING: the five drifts into their five rows, and the one card they refresh. The vessel answers canon, seed and shadow;
 * this door adds the lay's lag (the disk lives here). The card write never fails the read: a door that refuses leaves `unwritten`
 * with its reason, and the rows still print.
 */
export async function readFloorStatus(common: Record<string, unknown>, doors: FloorDoors): Promise<FloorStatusOutput> {
  const output = await doors.status(common);
  if (typeof output["refused"] === "string") throw new FloorRefused(String(output["refusal"] ?? "floor-status-refused"), output["refused"]);
  const s = output as unknown as FloorStatusOutput;
  const lag = await doors.lag();
  const rows = readFloorDrifts({
    canon: { drift: s.floorDrift, ...(s.floorDriftWhy !== undefined ? { why: s.floorDriftWhy } : {}) },
    seed: s.genesis?.seed ?? null, ...(s.genesis?.unread !== undefined ? { seedWhy: `the founding record reads unread here (${s.genesis.unread})` } : {}),
    shadow: (output["floorShadow"] ?? null) as never, ...(typeof output["floorShadowWhy"] === "string" ? { shadowWhy: output["floorShadowWhy"] } : {}), lag: lag.lag, ...(lag.why !== undefined ? { lagWhy: lag.why } : {}),
  });
  const card = floorCardFor(rows, { vessel: await doors.vessel(), ...(s.nexus !== undefined ? { nexus: s.nexus } : {}) });
  const put = await doors.putCard(card).catch((e: unknown) => unwritten((e instanceof Error ? e.message : String(e)).replace(/[\r\n]+/g, " ").trim()));
  return { ...s, drifts: rows, card: { title: card.title, decision: put.decision, state: card.fields["floor-state"] ?? "level", ...("why" in put && put.why ? { why: put.why } : {}) } };
}

/** The seed a genesis dir offers, as the adopt asks for it: its CID (the receipt) and its floor manifest (the genesis witness). */
export function seedFloorOf(genesisDir: string): { readonly seedCid: string; readonly seedFloor: string } | { readonly why: string } {
  let bytes: Buffer;
  try { bytes = readFileSync(join(genesisDir, "seed.json")); } catch { return { why: `no seed.json reads at ${genesisDir}` }; }
  let seed: Partial<GenesisSeed> | null;
  try { seed = JSON.parse(bytes.toString("utf8")) as Partial<GenesisSeed> | null; } catch { return { why: `the seed at ${genesisDir} reads as no JSON` }; }
  // The seed stands as plain data (genesis-doc builds it so): its floor row reads as an own entry, never through the prototype.
  const row = ownEntry(seed?.tiddlers, GENESIS_FLOOR_TIDDLER) as { readonly tiddler?: { readonly cid?: unknown } } | undefined;
  const floor = row?.tiddler?.cid;
  if (typeof floor !== "string" || !/^[0-9a-f]{64}$/.test(floor)) return { why: `the seed at ${genesisDir} names no floor (${GENESIS_FLOOR_TIDDLER})` };
  return { seedCid: genesisSeedCid(new Uint8Array(bytes)), seedFloor: floor };
}

/**
 * The landing's next line. Under a pūlama the house restands itself at its next quiet point; with no custody outside the vessel the
 * hand's restart raises it. Either way the boot after settles the staged floor by its par (`settleFloorAtBoot`), under one receipt
 * `floor status` reads, and `--commit` / `--revert` stay the hand's explicit acts.
 */
function floorAdoptNextLine(r: Extract<FloorAdoptOutcome, { ok: true; moved: true }> & { readonly alerted?: readonly string[] }): string {
  const settle = "the boot after commits it at par, or reverts it to the prior floor and names why (`lares vessel floor status` reads the receipt); `lares vessel floor adopt --commit` stays the hand's act";
  if (r.remount?.act === "restand") return `  next:     the house restands itself at its next quiet point to mount it (no write in flight, the sealed rest empty, the shores flushed); ${settle}`;
  const alerted = r.alerted?.length ? ` (alerted: ${r.alerted.join(", ")})` : "";
  return `  next:     no pūlama holds this vessel's custody, so the hand's restart mounts it (\`lares-container.sh down\`, then \`up\`); ${settle}${alerted}`;
}

/** The human lines of `floor adopt`: the preview or the landing, the local floor's base, receipt and prior, and the restart. */
export function floorAdoptLines(r: FloorAdoptOutcome & { readonly alerted?: readonly string[] }): string[] {
  if (!r.ok) return [`floor adopt → REFUSED ${r.refusal}: ${r.detail}`];
  if (!r.moved) return [`floor adopt → HELD: ${r.why}; nothing lands`];
  const l = r.pin.local!;
  return [
    r.applied ? `floor adopt → STAGED local floor ${r.pin.manifest}` : `floor adopt (preview) → would stage local floor ${r.pin.manifest}`,
    `  base:     ${l.base} (engine and canon snapshots stay the base's; the founding record never moves)`,
    `  moves:    ${r.moves.join(", ")} (grammar, lararium and plugins ride the seed's offering ${r.manifest.plugins})`,
    `  receipt:  seed ${l.receipt}`,
    `  prior:    ${l.prior?.manifest ?? "(none)"} kept; \`lares vessel floor adopt --revert\` lands it back`,
    r.applied ? floorAdoptNextLine(r) : "  apply:    `lares vessel floor adopt --apply` (the hand's act)",
  ];
}

/** The boot's settle receipt, as `floor status` prints it: the floor, the seed and the par reading. */
export function floorSettleReceiptLine(r: FloorSettleReceipt): string {
  return r.act === "committed"
    ? `  settle:          committed local floor ${r.floor} at par (seed ${r.seed})`
    : `  settle:          reverted local floor ${r.floor} to ${r.pinned}: ${r.par} (seed ${r.seed}; the staged floor's bytes stay in the CAS)`;
}

/** The human lines of `floor adopt --commit | --revert`. */
export function floorSettleLines(act: "commit" | "revert", r: FloorLocalAct & { readonly prior?: FloorPin }): string[] {
  if (!r.ok) return [`floor adopt --${act} → REFUSED ${r.refusal}: ${r.detail}`];
  if (!r.moved) return [`floor adopt --${act} → HELD: the local floor ${r.pin.manifest} already stands committed; nothing lands`];
  return act === "commit"
    ? [`floor adopt --commit → COMMITTED local floor ${r.pin.manifest}`]
    : [`floor adopt --revert → PINNED ${r.pin.manifest} back (a forward row; the reverted floor ${r.prior?.manifest ?? "?"} stays in the CAS)`, "  next:     the next boot mounts it"];
}

async function cmdFloorAdopt(args: ParsedArgs, common: Record<string, unknown>): Promise<number> {
  const flags = (["apply", "commit", "revert"] as const).filter((f) => args.flags[f] === true);
  if (flags.length > 1) {
    emit(args, { ok: false, error: { code: "usage", message: "floor adopt takes one of --apply, --commit or --revert" }, human: () => console.error("lares vessel floor adopt: name one of --apply, --commit or --revert") });
    return 2;
  }
  const act = flags[0] as "apply" | "commit" | "revert" | undefined;
  if (act === "commit" || act === "revert") {
    const { output } = await storeVerb("floor-adopt-apply", { ...common, act });
    if (typeof output["refused"] === "string") throw new FloorRefused(String(output["refusal"] ?? "floor-adopt-refused"), output["refused"]);
    const r = output as unknown as FloorLocalAct & { prior?: FloorPin };
    emit(args, { ok: r.ok, data: { ...r }, ...(r.ok ? {} : { error: { code: r.refusal, message: r.detail } }), human: () => { for (const line of floorSettleLines(act, r)) console.log(line); } });
    return r.ok ? 0 : 1;
  }
  const seed = seedFloorOf(floorSeedDir(args));
  if ("why" in seed) throw new FloorRefused("floor-seed-unread", `${seed.why}; name the genesis dir with --genesis <dir>`);
  const { output } = await storeVerb(act === "apply" ? "floor-adopt-apply" : "floor-adopt", { ...common, ...seed, ...(act === "apply" ? { act: "apply" } : {}) });
  if (typeof output["refused"] === "string") throw new FloorRefused(String(output["refusal"] ?? "floor-adopt-refused"), output["refused"]);
  const r = output as unknown as FloorAdoptOutcome & { alerted?: readonly string[] };
  emit(args, { ok: r.ok, data: { ...r }, ...(r.ok ? {} : { error: { code: r.refusal, message: r.detail } }), human: () => { for (const line of floorAdoptLines(r)) console.log(line); } });
  return r.ok ? 0 : 1;
}

export async function cmdFloor(args: ParsedArgs, doors: FloorDoors = LIVE_FLOOR_DOORS): Promise<number> {
  const act = args.positional[0];
  if (act === "seed") return cmdFloorSeed(args);
  if (act !== "status" && act !== "accept" && act !== "adopt") {
    emit(args, { ok: false, error: { code: "usage", message: "vessel floor takes status, accept, seed or adopt" }, human: () => console.error("lares vessel floor: name `status`, `accept [<release-cid>]`, `seed [--genesis <dir>]` or `adopt [--apply|--commit|--revert]`") });
    return 2;
  }
  const common = {
    ...(args.options["nexus"] !== undefined ? { aid: args.options["nexus"] } : {}),
    ...(args.options["porch"] !== undefined ? { porch: args.options["porch"] } : {}),
  };
  try {
    if (act === "adopt") return await cmdFloorAdopt(args, common);
    if (act === "status") {
      const grain = (args.options["grain"] ?? "all") as FloorGrain;
      if (!(FLOOR_GRAINS as readonly string[]).includes(grain)) {
        emit(args, { ok: false, error: { code: "usage", message: `--grain names one of ${FLOOR_GRAINS.join(" | ")}` }, human: () => console.error(`lares vessel floor status: --grain names one of ${FLOOR_GRAINS.join(" | ")} (got "${grain}")`) });
        return 2;
      }
      const s = await readFloorStatus(common, doors);
      emit(args, {
        ok: true, data: { ...s, ...(s.drifts ? { drifts: s.drifts.filter((r) => rowInGrain(r, grain)) } : {}) },
        human: () => { for (const line of floorStatusLines(s, grain)) console.log(line); },
      });
      return 0;
    }
    const target = args.positional[1];
    const { output } = await storeVerb("floor-accept", { ...common, ...(target !== undefined ? { release: target } : {}) });
    if (typeof output["refused"] === "string") throw new FloorRefused(String(output["refusal"] ?? "floor-accept-refused"), output["refused"]);
    const r = output as unknown as FloorAcceptOutcome & { alerted?: readonly string[] };
    if (!r.ok) throw new FloorRefused(r.refusal, `${r.refusal}: ${r.detail}`);
    emit(args, {
      ok: true, data: { ...r },
      human: () => {
        if (!r.moved) { console.log(`floor accept → HELD: the pin already names ${short(r.pin.release)}; nothing lands`); return; }
        console.log(`floor accept → PINNED ${r.pin.release}`);
        console.log(`  from:     ${short(r.prior.release)}`);
        console.log(`  walked:   ${r.path.map(short).join(" → ")}`);
        console.log(`  floor:    ${r.pin.manifest} (${r.staged.length} blob(s) staged in this vessel's CAS)`);
        if (r.remount?.act === "alert") console.log(`  remount:  ${r.remount.why}${r.alerted?.length ? ` (alerted: ${r.alerted.join(", ")})` : ""}`);
        else if (r.remount?.act === "swap-live") console.log("  remount:  the floor read-face swapped live");
      },
    });
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failure = storeFailure(err, err instanceof FloorRefused ? err.refusal : "error");
    emit(args, { ok: false, error: failure, human: () => console.error(`lares vessel floor ${act}: ${msg}`) });
    return exitFor(failure.code);
  }
}
