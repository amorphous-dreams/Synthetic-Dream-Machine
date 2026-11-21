/**
 * `lares vessel floor status|accept [<release-cid>]|seed [--genesis <dir>] [--nexus <aid>] [--porch <origin>]` — the vessel's pin on its Nexus's floor.
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
 * Meme: lar:///ha.ka.ba/lares/docs/pono/w26-floor-lane#/the-vessel-pin
 */
import { ratchetWords, ratchetsDiffer, type FloorAcceptOutcome, type FloorStatus, type GenesisDigests, type RatchetDifference } from "@lararium/mesh";
import { FloorRefused } from "@lararium/node";
import { emit, exitFor } from "../render.js";
import { storeVerb, storeFailure } from "../store-door.js";
import type { ParsedArgs } from "../parse-args.js";
import { HouseRootUnnamed, resolveGenesis } from "@lararium/node";
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
};

/** The human lines of `floor status`: both truths, then the Nexus part or its refusal by name. */
export function floorStatusLines(s: FloorStatusOutput): string[] {
  const lines: string[] = [s.nexus !== undefined ? `floor status · nexus ${s.nexus}` : "floor status"];
  const g = s.genesis;
  if (g?.unread !== undefined) lines.push(`  founding record: unread here (${g.unread})`);
  else if (g) {
    const d = (v: string | null) => v ?? "absent";
    lines.push(`  founding record: engine ${d(g.record.engine)} · grammar ${d(g.record.grammar)} · plugins ${d(g.record.plugins)} · floor ${d(g.record.floor)}`);
    lines.push(g.seed === null
      ? "  seed (offered):  none reads"
      : ratchetsDiffer(g.seed.ratchets)
        ? `  seed (offered):  ${g.seed.cid} — a newer seed waits: ${ratchetWords(g.seed.ratchets)}; the founding record keeps serving, and lay moves canon, never the founding record`
        : `  seed (offered):  ${g.seed.cid} — same on every ratchet`);
    lines.push(g.floorPin !== null
      ? `  floor pin:       ${g.floorPin.manifestCid} — ${ratchetWords(g.floorPin.ratchets)}`
      : s.nexusRefused
        ? "  floor pin:       none (no Nexus charter; the founding record's genesis floor serves)"
        : `  floor pin:       ${s.pinned?.manifest ?? "?"} — its manifest does not read from this vessel's CAS`);
  }
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
    `  seed digests:    engine ${d(o.engine)} · grammar ${d(o.grammar)} · plugins ${d(o.plugins)} · floor ${d(o.floor)}`];
  if (r.noHouse === true) lines.push("  founding record: reads at boot (no house answers here)");
  else if (r.offer === null) lines.push(`  founding record: unread here (${r.recordUnread ?? "no house answers"})`);
  else {
    const g = r.offer.record;
    lines.push(`  founding record: engine ${d(g.engine)} · grammar ${d(g.grammar)} · plugins ${d(g.plugins)} · floor ${d(g.floor)}`);
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

export async function cmdFloor(args: ParsedArgs): Promise<number> {
  const act = args.positional[0];
  if (act === "seed") return cmdFloorSeed(args);
  if (act !== "status" && act !== "accept") {
    emit(args, { ok: false, error: { code: "usage", message: "vessel floor takes status, accept or seed" }, human: () => console.error("lares vessel floor: name `status`, `accept [<release-cid>]` or `seed [--genesis <dir>]`") });
    return 2;
  }
  const common = {
    ...(args.options["nexus"] !== undefined ? { aid: args.options["nexus"] } : {}),
    ...(args.options["porch"] !== undefined ? { porch: args.options["porch"] } : {}),
  };
  try {
    if (act === "status") {
      const { output } = await storeVerb("floor-status", common);
      if (typeof output["refused"] === "string") throw new FloorRefused(String(output["refusal"] ?? "floor-status-refused"), output["refused"]);
      const s = output as unknown as FloorStatusOutput;
      emit(args, {
        ok: true, data: { ...s },
        human: () => { for (const line of floorStatusLines(s)) console.log(line); },
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
