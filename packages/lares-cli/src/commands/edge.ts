/**
 * `lares edge {kapae | un-kapae} (<edge-id> | --member <key> | --device <key>) [--realm <id>] [--quorum]
 * [--as <root-index>]` — set one RELATIONSHIP aside, or take the marker back down.
 *
 * SCOPED UNDER `edge` to mirror `nexus kapae` / `nexus un_kapae`, and to keep them apart. Both acts set
 * something aside and both deserve the word, but they set aside DIFFERENT KINDS of thing: the nexus pair
 * shadows a PRESENTER on the antigen board under a kahu quorum, while this pair shadows one RELATIONSHIP
 * under a hand that holds it: the holder the edge names, or the seat quorum of the realm's charter. One bare `kapae` covering both would read as a single act with two
 * meanings — the pet-name failure this house keeps catching.
 *
 * The marker rides an EDGE, never a party. Setting a relationship aside says nothing about either end of it:
 * a vessel keeps standing, a face keeps standing, and only THAT relation stops counting. Every comparable
 * system raises its tombstone over a party instead, which is why each needed the whole world to agree.
 *
 * RAISING WINS THE FOLD; LOWERING TAKES A DELIBERATE HAND. Under partition two peers may disagree and the
 * raised marker holds the merge, so an eviction never quietly reverses when the partition heals. Nothing
 * un-shadows by accident — a lower is its own signed act, and it lands beside the raise in the causal record.
 *
 * THE WRITE ASSERTS NO AUTHORITY. It signs with a named persona root or the held seats; whether that hand
 * holds the edge gets decided by whichever reader consults the shadow. A raise by a root with no claim lands, verifies, and gets
 * dropped everywhere it matters.
 */

import { EdgeKapaeError, type EdgeKapaeResult } from "@lararium/node";
import type { ParsedArgs } from "../parse-args.js";
import { storeVerb } from "../store-door.js";
import { refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";

function usage(args: ParsedArgs, detail?: string): number {
  return refuseUsage(args, "edge", helpLines("edge"), detail);
}

export async function cmdEdge(args: ParsedArgs): Promise<number> {
  const verb = args.positional[0];
  if (verb !== "kapae" && verb !== "un-kapae") return usage(args, verb ? `unknown sub-verb "${verb}"` : undefined);

  const edgeId = args.positional[1];
  const member = args.options["member"], device = args.options["device"], realm = args.options["realm"];
  if ([edgeId, member, device].filter((v) => v !== undefined).length !== 1) return usage(args, "name one relationship: an edge id, --member or --device");
  const quorum = args.flags["quorum"] === true;

  const asRaw = args.options["as"];
  const handleIndex = asRaw === undefined ? undefined : Number(asRaw);
  if (handleIndex !== undefined && !Number.isInteger(handleIndex)) {
    console.error(`--as expects a persona-root index, got "${asRaw}"`);
    return 2;
  }
  try {
    const r = (await storeVerb("edge-kapae", {
      raised: verb === "kapae",
      ...(edgeId !== undefined ? { edgeId } : {}), ...(member !== undefined ? { member } : {}), ...(device !== undefined ? { device } : {}),
      ...(realm !== undefined ? { realm } : {}), ...(quorum ? { hand: "quorum" } : {}),
      ...(handleIndex !== undefined ? { handleIndex } : {}),
    }, EdgeKapaeError)).output as unknown as EdgeKapaeResult;
    // THE HEADLINE REPORTS STANDING, never the gesture: a lower may land while a raise it never cited still
    // stands beside it, and "stands again" would then tell a person the opposite of what every reader reads.
    console.log(r.raised
      ? (r.shadowStands ? "RAISED — the relationship stands aside" : "RAISE RECORDED — the shadow does not read as standing under this hand")
      : (r.shadowStands ? "LOWER RECORDED — the shadow STILL STANDS" : "LOWERED — the relationship stands again"));
    console.log(`  edge:     ${r.edgeId}`);
    console.log(`  act-cid:  ${r.actCid}`);
    console.log(`  parents:  ${r.parents.length === 0 ? "(genesis)" : r.parents.join(", ")}`);
    console.log(`  hand:     ${r.hand}  (${r.signers.length} signature${r.signers.length === 1 ? "" : "s"}: ${r.signers.map((k) => `${k.slice(0, 16)}…`).join(", ")})`);
    console.log(`  epoch-cid: ${r.epochCid}`);
    console.log(`  board:    ${r.board} · ${r.boardUrl}`);
    // What a reader consulting THIS signer as the edge's authority would now see — never a claim that every
    // reader agrees, since authority gets decided at the fold and this vessel does not get to decide it.
    console.log(`  shadow:   ${r.shadowStands ? "STANDS" : "down"} (as read under this hand${r.verdict ? `: ${r.verdict}` : ""})`);
    if (!r.raised && !r.shadowStands) {
      console.log("  keys:     a lift restores standing alone. A fresh crossing seats fresh keys; no earlier key returns.");
    }
    if (r.verdict === "unsettled") {
      console.log("  fork:     a raise and a lower stand with no causal order between them. Nothing picks a winner;");
      console.log("            the shadow stays up until a hand decides — run the verb again, and the new act cites both.");
    } else if (r.shadowStands && (r.verdict === "unavailable" || r.verdict === "rejected")) {
      console.log("  unread:   this replica holds an act on this edge whose ancestry it cannot read whole, so no lift");
      console.log("            stands proven. The shadow stays up until the missing act arrives.");
    }
    return 0;
  } catch (err) {
    if (err instanceof EdgeKapaeError) { console.error(`refused: ${err.message}`); return 1; }
    throw err;
  }
}
