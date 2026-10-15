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

import { readFileSync } from "node:fs";
import { EdgeKapaeError, EdgeSeatError, EdgeCosignError, type EdgeKapaeResult, type EdgeSeatFacts, type EdgePartialResult, type EdgeCosignResult } from "@lararium/node";
import type { ParsedArgs } from "../parse-args.js";
import { storeVerb } from "../store-door.js";
import { refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";

function usage(args: ParsedArgs, detail?: string): number {
  return refuseUsage(args, "edge", helpLines("edge"), detail);
}

/** What the island's `seat-duties` verb hands back for one fleet. Plain data off the wire: read, never trusted for shape. */
interface SeatAnswer {
  readonly ran?:      boolean;
  readonly reason?:   string;
  readonly outcomes?: readonly { readonly did?: string; readonly fresh?: string; readonly said?: string; readonly duty?: { readonly kind?: string; readonly edgeId?: string; readonly raiseCids?: readonly string[]; readonly seat?: { readonly member?: string } } }[];
  readonly rolls?:    readonly unknown[];
}

const SEAT_LINES: Readonly<Record<string, string>> = {
  "revoked":      "REVOKED — the seat left the face's key group",
  "gone":         "GONE — the seat had left already; the raise reads as answered",
  "settled":      "SETTLED — no seat stood to revoke; the raise reads as answered",
  "no-authority": "STANDS UNDER ANOTHER HAND — this vessel holds no hand over that seat; the vessel that seated it revokes it",
  "seated":       "SEATED AFRESH — a fresh seat at a fresh key epoch",
  "unseated":     "STANDING, NO SEAT — the party holds standing and no key until its own fresh crossing",
  "forked":       "FORK — a shadow stands over THIS vessel's own edge; it performs no key act here",
  "undelivered":  "NOT ANSWERED — a subscriber to the roll refused it; the raise stays owed",
};

/**
 * `lares edge settle [--fleet <root>]` — answer, on the key side, the raises this vessel counts on its fleet's
 * edge board (kapae#/keys). Three steps: the vessel reads the facts, the daemon island answers them where the
 * face's group keys live, and the vessel marks what got answered. Running it again changes nothing.
 */
async function cmdSettle(args: ParsedArgs): Promise<number> {
  const fleet = args.options["fleet"];
  try {
    const facts = ((await storeVerb("edge-seat-facts", { ...(fleet !== undefined ? { fleetRoot: fleet } : {}) }, EdgeSeatError)).output["fleets"] ?? []) as readonly EdgeSeatFacts[];
    if (facts.length === 0) { console.log("no fleet to settle — this vessel holds no face's root (name one with --fleet <root>)."); return 0; }
    let owed = 0;
    for (const f of facts) {
      console.log(`fleet ${f.fleetRoot}`);
      if (f.edges.length === 0 && !f.selfAside) { console.log("  no raise counts on this fleet's board — nothing owed."); continue; }
      // The island's `seat-duties` verb answers the vessel's main thread alone: the store door's row reads this
      // fleet's facts itself and asks it there.
      let answer: SeatAnswer;
      try { answer = (await storeVerb("edge-seat-duties", { fleetRoot: f.fleetRoot }, EdgeSeatError)).output as SeatAnswer; }
      catch (err) { console.error(`  refused: ${err instanceof Error ? err.message : String(err)}`); owed++; continue; }
      if (answer.ran !== true) { console.log(`  not run: ${answer.reason ?? "the island answered nothing"}`); owed++; continue; }
      const outcomes = answer.outcomes ?? [];
      if (outcomes.length === 0) console.log("  every counted raise stands answered — nothing owed.");
      for (const o of outcomes) {
        const did = o.did ?? "";
        console.log(`  ${SEAT_LINES[did] ?? did}`);
        if (o.duty?.edgeId) console.log(`    edge:   ${o.duty.edgeId}`);
        if (o.duty?.seat?.member) console.log(`    seat:   ${o.duty.seat.member}`);
        if ((o.duty?.raiseCids ?? []).length > 0) console.log(`    raises: ${(o.duty!.raiseCids!).join(", ")}`);
        if (o.fresh === "seated") console.log("    then:   SEATED AFRESH — the lift stood, so a fresh seat followed the revocation");
        if (o.fresh === "unseated") console.log("    then:   standing holds and no seat landed here — the party takes one by its own fresh crossing");
        if (o.said) console.log(`    said:   ${o.said}`);
        if (did === "no-authority" || did === "undelivered" || did === "forked") owed++;
      }
      const rolls = answer.rolls ?? [];
      if (rolls.length > 0) {
        const m = (await storeVerb("edge-seat-marks", { fleetRoot: f.fleetRoot, rolls }, EdgeSeatError)).output;
        console.log(`  marked:  ${((m["marked"] as readonly string[] | undefined) ?? []).length} raise(s) answered in this vessel's own ledger`);
      }
    }
    if (owed > 0) console.log("something stays owed — the lines above name each one.");
    return owed > 0 ? 1 : 0;
  } catch (err) {
    if (err instanceof EdgeSeatError) { console.error(`refused: ${err.message}`); return 1; }
    throw err;
  }
}

const subjectLine = (s: EdgeCosignResult["subject"]): string =>
  s.kind === "member" ? `member ${s.member}` : `the vouch ${s.voucher} gave ${s.joiner}`;

/**
 * `lares edge kapae|un-kapae (--member <key> | --voucher <key> --joiner <key>) --realm <id> --quorum --partial`
 * — sign a quorum act with the seats this vessel holds and print it as a PARTIAL for the next seat's vessel.
 */
async function cmdPartial(args: ParsedArgs, raised: boolean): Promise<number> {
  const { member, voucher, joiner, realm } = args.options;
  if (realm === undefined) return usage(args, "a partial names its realm: --realm <realm-id>");
  const nexusRaw = args.options["nexus"];
  const nexusAid = typeof nexusRaw === "string" && nexusRaw.trim().length > 0 ? nexusRaw.trim().toLowerCase() : undefined;
  try {
    const r = (await storeVerb("edge-partial", {
      realm, raised, ...(member !== undefined ? { member } : {}), ...(voucher !== undefined ? { voucher } : {}), ...(joiner !== undefined ? { joiner } : {}),
      ...(nexusAid !== undefined ? { nexusAid } : {}),
    }, EdgeCosignError)).output as unknown as EdgePartialResult;
    console.log(`PARTIAL — ${r.signed.length} of ${r.threshold} seats signed; the act counts for nothing until the threshold meets`);
    console.log(`  gesture:  ${raised ? "raise (set aside)" : "lower (re-admit)"} over ${subjectLine(r.partial.subject)}`);
    console.log(`  realm:    ${r.partial.scope}`);
    console.log(`  edge:     ${r.edgeId}`);
    console.log(`  act-cid:  ${r.actCid}`);
    console.log(`  signed:   ${r.signed.map((k) => `${k.slice(0, 16)}…`).join(", ")}`);
    console.log("  next:     hand the LAST line to another seat's vessel, which reads it with `lares edge cosign '<partial>'`");
    console.log(JSON.stringify(r.partial));
    return 0;
  } catch (err) {
    if (err instanceof EdgeCosignError) { console.error(`refused: ${err.message}`); return 1; }
    throw err;
  }
}

/**
 * `lares edge cosign (<partial-json> | --from <file>) [--act <act-cid>]` — read a partial; with `--act`, add this
 * vessel's seats and land the act once it counts.
 *
 * THE WHOLE INPUT IS ONE PARTIAL. No line beside it gets read as a description: every line this verb prints
 * comes from the partial's own verified bytes. Without `--act` it signs nothing, so a person reads whom the act
 * sets aside before any seat signs; `--act` names the act id that read printed, and any other act refuses.
 */
async function cmdCosign(args: ParsedArgs): Promise<number> {
  const from = args.options["from"];
  let text = args.positional[1];
  if (text === undefined && from !== undefined) {
    try { text = readFileSync(from, "utf8"); } catch { console.error(`refused: cannot read ${from}`); return 1; }
  }
  if (text === undefined) return usage(args, "hand in the partial: its JSON text, or --from <file>");
  let partial: unknown;
  try { partial = JSON.parse(text.trim()); }
  catch { console.error("refused: the input must hold ONE JSON partial and nothing else"); return 1; }
  const confirmActCid = args.options["act"];
  try {
    const r = (await storeVerb("edge-cosign", { partial, ...(confirmActCid !== undefined ? { confirmActCid } : {}) }, EdgeCosignError)).output as unknown as EdgeCosignResult;
    console.log(r.would !== undefined
      ? `READ — ${r.signed.length} of ${r.threshold} seats signed; this call signed nothing and landed nothing`
      : r.landed
        ? (r.raised ? (r.shadowStands ? "LANDED — the quorum's raise counts, and the relationship stands aside" : "LANDED — the act counts; the shadow does not read as standing")
                    : (r.shadowStands ? "LANDED — the quorum's lower counts, and the shadow STILL STANDS" : "LANDED — the quorum's lower counts, and the relationship stands again"))
        : `COSIGNED — ${r.signed.length} of ${r.threshold} seats signed; the act still counts for nothing`);
    console.log(`  gesture:  ${r.raised ? "raise (set aside)" : "lower (re-admit)"} over ${subjectLine(r.subject)}`);
    console.log(`  realm:    ${r.partial.scope}`);
    console.log(`  edge:     ${r.edgeId}`);
    console.log(`  act-cid:  ${r.actCid}`);
    if (r.would !== undefined) {
      console.log(`  signed:   ${r.signed.map((k) => `${k.slice(0, 16)}…`).join(", ")}`);
      console.log(r.would === "cosign"
        ? `  next:     to add this vessel's seats, run the same command with --act ${r.actCid}`
        : `  next:     the act arrived whole; to land it on this vessel's board, run the same command with --act ${r.actCid}`);
      return 0;
    }
    console.log(`  added:    ${r.added.length === 0 ? "(none — the act arrived whole)" : r.added.map((k) => `${k.slice(0, 16)}…`).join(", ")}`);
    if (r.landed) console.log("  next:     hand the line below back, so each seat's vessel lands the same act (`lares edge cosign '<partial>'`, then `--act <act-cid>`)");
    else console.log("  next:     hand the line below to another seat's vessel");
    console.log(JSON.stringify(r.partial));
    return 0;
  } catch (err) {
    if (err instanceof EdgeCosignError) { console.error(`refused: ${err.message}`); return 1; }
    throw err;
  }
}

export async function cmdEdge(args: ParsedArgs): Promise<number> {
  const verb = args.positional[0];
  if (verb === "settle") return cmdSettle(args);
  if (verb === "cosign") return cmdCosign(args);
  if ((verb === "kapae" || verb === "un-kapae") && args.flags["partial"] === true) {
    if (args.flags["quorum"] !== true) return usage(args, "--partial serves the quorum hand: add --quorum");
    return cmdPartial(args, verb === "kapae");
  }
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
  const nexusRaw = args.options["nexus"];
  const nexusAid = typeof nexusRaw === "string" && nexusRaw.trim().length > 0 ? nexusRaw.trim().toLowerCase() : undefined;
  try {
    const r = (await storeVerb("edge-kapae", {
      raised: verb === "kapae",
      ...(edgeId !== undefined ? { edgeId } : {}), ...(member !== undefined ? { member } : {}), ...(device !== undefined ? { device } : {}),
      ...(realm !== undefined ? { realm } : {}), ...(quorum ? { hand: "quorum" } : {}),
      ...(handleIndex !== undefined ? { handleIndex } : {}), ...(nexusAid !== undefined ? { nexusAid } : {}),
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
    if (r.epochCid !== undefined) console.log(`  epoch-cid: ${r.epochCid}`);
    console.log(`  board:    ${r.board} · ${r.boardUrl}`);
    // What a reader consulting THIS signer as the edge's authority would now see — never a claim that every
    // reader agrees, since authority gets decided at the fold and this vessel does not get to decide it.
    console.log(`  shadow:   ${r.shadowStands ? "STANDS" : "down"} (as read under this hand${r.verdict ? `: ${r.verdict}` : ""})`);
    if (r.withdrawals) {
      const w = r.withdrawals;
      if (w.unread) console.log(`  gates:    NO WITHDRAWAL SIGNED — ${w.unread}.`);
      else {
        console.log(`  gates:    ${w.signed} certificate withdrawal(s) signed${w.standing > 0 ? `, ${w.standing} already standing` : ""}`);
        for (const u of w.unsigned) console.log(`            NOT SIGNED for face ${u.faceKey.slice(0, 16)}… at Nexus ${u.nexus.slice(0, 16)}…: ${u.why}`);
      }
    }
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
