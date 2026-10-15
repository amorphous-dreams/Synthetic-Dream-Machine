/**
 * nexus-anchor-cmd — the two-vault roll anchor's door: `lares nexus seal anchor`.
 *
 * A roll whose seats rest in two vaults files its new head first (`seal roll file`), and its anchor follows: the
 * new quorum signs the closed epoch, its seats and the board's heads there, so an admit in the anchor's past carries
 * to the new head. No vault signs that anchor whole, so it crosses as a PARTIAL file, the way an admit does:
 *
 *   · `seal anchor [--nexus <aid>] --out <partial>` signs with the head's seats this vault holds and writes the
 *     partial; nothing lands on any board.
 *   · `seal anchor --edge --out <partial>` signs the realm edge anchors of the same roll: one partial for each realm
 *     board this vault keeps a quorum act for, written beside `<partial>` as `<stem>-<realm>.json`; nothing lands.
 *   · `seal anchor --from <partial> [--out <file>]` judges the partial against this vault's own rolled head, the
 *     epoch it closed and its own board BEFORE any signature: `ready` takes this vault's seats, `complete` lands the
 *     anchor, and any other verdict refuses by name with nothing signed or landed. `--out` writes the grown partial.
 *     A carried edge partial rides the same step: a vault that holds no board for its realm reads it `unavailable`.
 *
 * The rosters come off each vault's own verified lineage, never off the file. Each step answers where every realm's
 * edge anchor stands on this vault (`edgeAnchors`: anchored, or owed).
 *
 * ONE STORE DOOR: while the vessel stands, the act runs inside it; with no vessel standing, it runs here, holding
 * the store for the moment of the act (`store-door`). This door holds no reference back into `nexus-seal.ts`.
 */
import { readFileSync } from "node:fs";
import { NexusContractError, type NexusRollAnchorPartialResult } from "@lararium/node";
import { storeVerb, storeFailure } from "../store-door.js";
import { emit, exitFor } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";
import { partialOutOrRefuse, writePartialFile, type PartialWritten } from "./partial-file.js";

const ANCHOR_USAGE = "usage: lares nexus seal anchor [--nexus <aid>] [--edge] --out <partial> | lares nexus seal anchor --from <partial> [--out <file>]";
const refuseAnchor = (msg: string): Error => new NexusContractError(msg);

type EdgeStanding = { readonly realm: string; readonly state: "anchored" | "owed"; readonly anchorCid?: string };
type AnchorAnswer = NexusRollAnchorPartialResult & { readonly realm?: string; readonly edgeAnchors?: readonly EdgeStanding[] };
type EdgeOpened = { readonly realm: string; readonly partial: NexusRollAnchorPartialResult["partial"]; readonly verdict: string; readonly signed: readonly string[] };

/** Report one anchor step: the verdict here, the seats signed, where the file landed, and the anchor once it lands. */
function emitAnchor(args: ParsedArgs, step: string, r: AnchorAnswer, written: PartialWritten | null): number {
  const path = written?.path ?? null;
  emit(args, {
    ok: true,
    data: {
      verdict: r.verdict, signed: r.signed, path, ...(written?.error ? { outError: written.error } : {}), partial: r.partial,
      landed: r.landed ? { anchorCid: r.landed.anchorCid, parents: r.landed.parents, boardUrl: r.landed.boardUrl } : null,
      ...(r.realm ? { realm: r.realm } : {}),
      ...(r.edgeAnchors ? { edgeAnchors: r.edgeAnchors } : {}),
    },
    human: () => {
      console.log(`nexus seal ${step} → ${r.verdict.toUpperCase()} (${r.signed.length} seat(s) of the new head signed under ${r.partial.aid.slice(0, 22)}…)`);
      for (const s of r.signed) console.log(`    ${s.slice(0, 16)}…`);
      if (path) console.log(`  partial:     ${path}`);
      if (written?.error) console.error(`lares nexus seal ${step}: the act ran, and the partial file did not land (${written.error}); carry the partial below instead`);
      if (!path) console.log(`  partial (carry this): ${JSON.stringify(r.partial)}`);
      if (r.landed) {
        console.log(`  landed:      anchor ${r.landed.anchorCid.slice(0, 16)}… over ${r.landed.parents.length} board head(s); admits in its past carry to the new head`);
        console.log("  next:        carry the partial back, so the other vault lands the same anchor (`lares nexus seal anchor --from <partial>`)");
        if (r.edgeAnchors?.some((e) => e.state === "owed")) console.log("  realm edges: some anchors stay owed here (`lares nexus seal anchor --edge --out <partial>`)");
      } else {
        console.log("  next:        carry the partial to the vault that holds another seat (`lares nexus seal anchor --from <partial> --out <file>`)");
      }
    },
  });
  // A write that failed after the act ran answers non-zero, so automation reading the status alone never drops the partial.
  return written?.error ? 1 : 0;
}

/** The path one realm's edge partial lands at: `<stem>-<realm first 12>.json` beside the named `--out`. */
const edgeOutPath = (out: string, realm: string): string => `${out.replace(/\.json$/, "")}-${realm.slice(0, 12)}.json`;

/** `--edge --out`: open one partial for each realm edge board this vault keeps a quorum act for. */
async function openEdgeAnchors(args: ParsedArgs, out: string): Promise<number> {
  partialOutOrRefuse(refuseAnchor, out);
  const aid = args.options["nexus"];
  const { output } = await storeVerb("nexus-roll-anchor-edge-open", aid ? { aid } : {}, NexusContractError);
  const opened = (output["partials"] ?? []) as readonly EdgeOpened[];
  const written = opened.map((o) => ({ o, w: writePartialFile(edgeOutPath(out, o.realm), o.partial) }));
  emit(args, {
    ok: true,
    data: { realms: written.map(({ o, w }) => ({ realm: o.realm, verdict: o.verdict, signed: o.signed, path: w.path, ...(w.error ? { outError: w.error } : {}), partial: o.partial })) },
    human: () => {
      console.log(`nexus seal anchor --edge → ${opened.length} realm partial(s)`);
      for (const { o, w } of written) {
        console.log(`  realm ${o.realm.slice(0, 12)}…: ${o.verdict.toUpperCase()} (${o.signed.length} seat(s) signed) → ${w.path ?? `(not written: ${w.error})`}`);
        if (!w.path) console.log(`    partial (carry this): ${JSON.stringify(o.partial)}`);
      }
      if (opened.length === 0) console.log("  no realm edge board holds a quorum act here for this roll; nothing owes an edge anchor");
      else console.log("  next:        carry each file to the vault that holds another seat (`lares nexus seal anchor --from <partial> --out <file>`)");
    },
  });
  return written.some(({ w }) => w.error) ? 1 : 0;
}

/** `lares nexus seal anchor` — open (`--out`) or take (`--from`) a two-vault roll anchor. */
export async function cmdSealAnchor(args: ParsedArgs): Promise<number> {
  const from = args.options["from"];
  const out = args.options["out"];
  const step = from !== undefined ? "anchor --from" : "anchor --out";
  try {
    if (from === undefined) {
      if (out === undefined) { console.error(ANCHOR_USAGE); return 2; }
      if (args.flags["edge"] === true) return await openEdgeAnchors(args, out);
      partialOutOrRefuse(refuseAnchor, out);
      const aid = args.options["nexus"];
      const { output } = await storeVerb("nexus-roll-anchor-open", aid ? { aid } : {}, NexusContractError);
      const r = output as unknown as AnchorAnswer;
      return emitAnchor(args, step, r, writePartialFile(out, r.partial));
    }
    if (out !== undefined) partialOutOrRefuse(refuseAnchor, out, from);
    let partial: unknown;
    try { partial = JSON.parse(readFileSync(from, "utf8")); }
    catch { throw new NexusContractError(`cannot read ${from} as a partial file`); }
    const { output } = await storeVerb("nexus-roll-anchor-partial", { partial }, NexusContractError);
    const r = output as unknown as AnchorAnswer;
    return emitAnchor(args, step, r, out !== undefined ? writePartialFile(out, r.partial) : null);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failure = storeFailure(err, err instanceof NexusContractError ? "refused" : "error");
    emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus seal ${step}: ${msg}`) });
    return exitFor(failure.code);
  }
}
