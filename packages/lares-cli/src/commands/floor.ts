/**
 * `lares vessel floor status|accept [<release-cid>] [--nexus <aid>] [--porch <origin>]` — the vessel's pin on its Nexus's floor.
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

const short = (cid: string | null | undefined): string => (cid ? `${cid.slice(0, 16)}…` : "(genesis floor)");

/** What the floor-status row answers: the Nexus part where a charter stands, and both truths always. */
export type FloorStatusOutput = Partial<FloorStatus> & {
  readonly genesis?: {
    readonly record: GenesisDigests;
    readonly seed: { readonly cid: string; readonly ratchets: readonly RatchetDifference[] } | null;
    readonly floorPin: { readonly manifestCid: string; readonly ratchets: readonly RatchetDifference[] } | null;
    readonly line: string;
  };
  readonly nexusRefused?: { readonly refusal: string; readonly message: string };
};

/** The human lines of `floor status`: both truths, then the Nexus part or its refusal by name. */
export function floorStatusLines(s: FloorStatusOutput): string[] {
  const lines: string[] = [s.nexus !== undefined ? `floor status · nexus ${s.nexus}` : "floor status"];
  const g = s.genesis;
  if (g) {
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

export async function cmdFloor(args: ParsedArgs): Promise<number> {
  const act = args.positional[0];
  if (act !== "status" && act !== "accept") {
    emit(args, { ok: false, error: { code: "usage", message: "vessel floor takes status or accept" }, human: () => console.error("lares vessel floor: name `status` or `accept [<release-cid>]`") });
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
