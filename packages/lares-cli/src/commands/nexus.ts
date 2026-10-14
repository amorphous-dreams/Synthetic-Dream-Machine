/**
 * `lares nexus seal {seat | rotate | commit | show}` — the operator's door to the founding-kahu ROSTER
 * and its PRE-ROTATED, hash-linked charter-epoch CHAIN (TUF ≈ KERI), the Kapae immune antigen's authority
 * home. The roster lives as data-as-authority in the `bags/nexus` charter DOC; the antigen roots on
 * the chain's HEAD epoch. The pure antigen fold/verify reads this same doc through `foundingRoster`.
 *
 *   seat    give each persona that STANDS for a chair a seat key of its own, minted behind the custody door
 *           and apart from every persona root, and establish the GENESIS epoch over those keys. The rite
 *           arms itself: each chair's NEXT key mints sealed beside its seat key and the genesis commits that
 *           set. FAILS CLOSED: a chair nobody stands for stays unseated; a quorum-short roster establishes no
 *           epoch (the antigen stays inert); a chain already ADVANCED past genesis refuses re-seat (rotate
 *           advances it, never a silent re-genesis).
 *   rotate  advance the chain: the door finds the next key-set the head committed among this vessel's own
 *           seat keys, seats the chairs that stand, has the committed hands sign the step, hash-links the new
 *           head to the prior epoch, and commits the set after. A roll the law refuses writes nothing.
 *   commit  compute a key-set commitment digest (`sealKeySetHash`) from a comma-separated `--keys` set +
 *           `--threshold`, to compare by hand.
 *   show    the current roster state — seated/unseated kahu, threshold, chain head epoch, quorum verdict.
 *
 * The pre-rotation is the recovery keel: stealing today's council keys cannot forge tomorrow's charter,
 * because each epoch pre-commits a digest of the NEXT epoch's keys before those keys ever sign.
 *
 * ── WHICH QUORUM THIS IS, BECAUSE ONE WORD NAMES TWO ────────────────────────────────────────────
 * "Kahu" names two k-of-n bodies that govern different objects, and reading one as the other produces
 * a wrong build every time:
 *
 *   THIS ONE — the NEXUS SEAL. Governs exactly three acts: carriage membership (`contract`/`revoke`),
 *   the antigen (`kapae`/`un_kapae`), and its own succession (`rotate`). Its chairs are seated from
 *   THIS vessel's own vault — `listPersonaRoots` reaches no other. A contract admits a carrier and seats
 *   nobody; an operator takes a chair by seating their own key in a fresh Nexus charter.
 *
 *   THE OTHER — the AMORPHOUS DREAMS CABAL (`kahu`). Holds `admin` on the ACCESS axis over the CORPUS
 *   bags and the genesis artifact: the written grammar, not any Nexus's membership. Multi-human by
 *   design, and it carries NO live command into a vessel — "the Cabal authors; the protocol
 *   distributes; the vessels enforce." No delegation grants it today and no sentinel names it.
 *
 * GOVERNING A REALM ⊥ GOVERNING THE METAL (operator ruling). This door is the metal.
 */

import { readFileSync } from "node:fs";
import {
  runNexusCarryFor, NexusContractError, SealedActRefused,
  AdmitBundleError, type NexusContractResult, type NexusMembersListResult,
} from "@lararium/node";
import { presentationFindingLine } from "@lararium/mesh";
import { larSealHome, vesselDid } from "../env.js";
import { runVerb } from "../verb-call.js";
import { summaryOutput } from "../verb-result.js";
import { emit, exitFor, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import { storeVerb, StoreDoorRefusal, pokeSealHomeRefold, storeFailure } from "../store-door.js";
import { sealedAct } from "../sealed-act-door.js";
import { cmdKahuli, runKahuliRite } from "./nexus-kahuli.js";
import { cmdPublish } from "./nexus-publish.js";
import { cmdOffering } from "./nexus-offering.js";
import { cmdKapae, cmdUnKapae } from "./nexus-kapae-cmd.js";
import { cmdSeal, runQuorumRite } from "./nexus-seal.js";
import type { ParsedArgs } from "../parse-args.js";

export async function cmdNexus(args: ParsedArgs): Promise<number> {
  const verb = args.positional[0];
  switch (verb) {
    case "seal":            return await cmdSeal(args);
    case "kapae":           return await cmdKapae(args);
    case "un_kapae":        return await cmdUnKapae(args);
    case "contract":        return await cmdContract(args, "admit");
    case "revoke":          return await cmdContract(args, "revoke");
    case "carry":           return await cmdContract(args, "carry");
    case "uncarry":         return await cmdContract(args, "uncarry");
    case "members":         return await cmdMembers(args);
    case "accept-carriage": return await cmdAcceptCarriage(args);
    case "admit-take":      return await cmdAdmitTake(args);
    case "carry-for":       return await cmdCarryFor(args);
    case "posture":         return await cmdPosture(args);
    case "rite":            return await runNexusRite(args);
    case "kahuli":          return await cmdKahuli(args);
    case "publish":         return await cmdPublish(args);
    case "offering":        return await cmdOffering(args);
    case "realm-bag":       return await cmdRealmBag(args);
    case "realm-bags":      return await cmdRealmBags(args);
    default:
      return refuseUsage(args, "nexus", helpLines("nexus"), verb ? `unknown verb "${verb}"` : undefined);
  }
}

/**
 * `lares nexus rite <petname>` — the pet-named procedures over the nexus primitives.
 *
 * A RITE names a complex multi-verb procedure, at second position so a composition never competes with a
 * primitive for namespace. The primitives keep every behaviour; a rite only orders them.
 */
const NEXUS_RITES: Readonly<Record<string, { readonly composes: string; readonly run: (a: ParsedArgs) => Promise<number> }>> = {
  quorum: { composes: "seal seat · seal show", run: runQuorumRite },
  kahuli: { composes: "kahuli grammar (· kahuli engine — held)", run: runKahuliRite },
};

/**
 * `lares nexus realm-bag <bag-uri>` — register a bag this vessel's steward keeps on the realm's shared CRDT
 * (realm-bag-brief). The bag's doc is the one this vessel names for the URI; the record
 * rides the seal of the key this vessel's WORN face presents to the realm's Nexus (`lares persona wear N`
 * first), never a persona root; @crossroads carries only that the bag exists and who keeps it.
 * A contracted member reads it through `meme get --bag <slug>`; the stewards alone write.
 *
 * A name enters a record by its own hand first. `--join` ASKS to keep a bag another hand keeps: this vessel's
 * worn face seals a record that names the standing stewards and itself. `--cosign` CONSENTS to a record that
 * names this vessel's steward. `--steward <key>` names a hand that already sealed a record of this realm.
 *
 * A verb names its realm. `--realm <id>` names a cabal realm (64 hex) or the charter-derived realm; with none
 * named the act lands in the charter-derived realm. An act in a cabal realm stands the vessel there.
 */
async function cmdRealmBag(args: ParsedArgs): Promise<number> {
  const bag = args.positional[1];
  if (!bag) { console.error("usage: lares nexus realm-bag <bag-uri> [--realm <id>] [--join | --cosign [--with <key>]] [--steward <key>…] [--tier <t>] [--expiry <rolls>] [--charter <key>=<realm-id>]"); return 2; }
  // `--steward` names a keeping hand by the key her worn face presents to this Nexus, and the vessel refuses a
  // key that sealed nothing in this realm: a hand that would keep the bag asks from her own vessel (`--join`).
  // The record is n-of-n: it counts nothing until every hand it names has sealed it.
  const stewards = (args.options["steward"] ?? "").split(",")
    .map((v) => v.trim().replace(/^0x/i, "").toLowerCase()).filter((v) => v.length > 0);
  const cosign = args.flags["cosign"] === true;
  const realm = typeof args.options["realm"] === "string" ? args.options["realm"].trim().toLowerCase() : "";
  const join = args.flags["join"] === true;
  // `--with <key>` names the hand a co-sign consents WITH, where several different proposals wait on this steward.
  const withName = typeof args.options["with"] === "string" ? args.options["with"].trim().replace(/^0x/i, "").toLowerCase() : "";
  // `--tier` declares the read (CONTRACT default; PUBLIC names a book the Herm carries by hash), `--expiry`
  // leases the registration in rolls of the realm's own pace, and `--charter <nym>=<realm-id>` names the
  // charter a second hand holds when the book spans two of them.
  const tier = typeof args.options["tier"] === "string" ? args.options["tier"].trim() : "";
  const expiry = args.options["expiry"] !== undefined ? Number(args.options["expiry"]) : undefined;
  const charters: Record<string, string> = {};
  for (const pair of (args.options["charter"] ?? "").split(",").map((v) => v.trim()).filter((v) => v.length > 0)) {
    const [nym, charterId] = pair.split("=");
    if (nym && charterId) charters[nym.replace(/^0x/i, "").toLowerCase()] = charterId;
  }
  try {
    const r = await runVerb("realm-bag", {
      bag: bag.startsWith("lar:") ? bag : `lar:///ha.ka.ba/bags/${bag}`, stewards, cosign, join,
      ...(withName ? { with: withName } : {}),
      ...(realm ? { realm } : {}),
      ...(tier ? { tier } : {}),
      ...(expiry === undefined || !Number.isFinite(expiry) ? {} : { expiry }),
      ...(Object.keys(charters).length > 0 ? { charters } : {}),
    }, await vesselDid());
    if (r.status === "error") {
      emit(args, { ok: false, error: { code: "error", message: r.errorMessage ?? "realm-bag failed" },
                   human: () => console.error(`lares nexus realm-bag: ${r.errorMessage ?? "failed"}`) });
      return 1;
    }
    const out = summaryOutput(r) ?? {};
    emit(args, {
      ok: true, data: out,
      human: () => {
        console.log("nexus realm-bag — the bag registers on the realm's shared CRDT:");
        console.log(`  realm:     ${String(out["realm"] ?? "?").slice(0, 24)}…`);
        console.log(`  bag:       ${String(out["bag"] ?? "?")}`);
        console.log(`  kept by:   ${(Array.isArray(out["keptBy"]) ? (out["keptBy"] as string[]) : []).map((n) => `${n.slice(0, 16)}…`).join(", ")}`);
        console.log(`  read tier: ${String(out["readTier"] ?? "?")}  (the contracted cabal reads; the stewards write)`);
        const awaiting = Array.isArray(out["awaiting"]) ? (out["awaiting"] as string[]) : [];
        if (awaiting.length > 0) {
          console.log(`  awaiting:  ${awaiting.map((n) => `${n.slice(0, 16)}…`).join(", ")}`);
          console.log(`             the record is n-of-n — it counts nothing until each named hand runs`);
          console.log(`             \`lares nexus realm-bag ${bag} --cosign\` on her own vessel`);
        }
      },
    });
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failure = storeFailure(err);
    emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus realm-bag: ${msg}`) });
    return exitFor(failure.code);
  }
}

/** `lares nexus realm-bags [--realm <id>]` — the standing registrations a realm carries, as of this vessel's
 *  last sync: the realm the verb names, or the charter-derived realm. A listing never enters a realm. */
async function cmdRealmBags(args: ParsedArgs): Promise<number> {
  try {
    const realm = typeof args.options["realm"] === "string" ? args.options["realm"].trim().toLowerCase() : "";
    const r = await runVerb("realm-bags", realm ? { realm } : {}, await vesselDid());
    if (r.status === "error") {
      emit(args, { ok: false, error: { code: "error", message: r.errorMessage ?? "realm-bags failed" },
                   human: () => console.error(`lares nexus realm-bags: ${r.errorMessage ?? "failed"}`) });
      return 1;
    }
    const out = summaryOutput(r) ?? {};
    const bags = Array.isArray(out["bags"]) ? (out["bags"] as Array<Record<string, unknown>>) : [];
    emit(args, {
      ok: true, data: out,
      human: () => {
        if (!out["realm"]) { console.log("nexus realm-bags — this vessel stands in no realm (no charter names one)"); return; }
        console.log(`nexus realm-bags — realm ${String(out["realm"]).slice(0, 24)}… carries ${bags.length} bag${bags.length === 1 ? "" : "s"}:`);
        for (const b of bags) {
          const kept = Array.isArray(b["keptBy"]) ? (b["keptBy"] as string[]).map((n) => `${n.slice(0, 16)}…`).join(", ") : "?";
          console.log(`  ${String(b["bag"])}  kept by ${kept}  (${String(b["readTier"])})`);
        }
      },
    });
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failure = storeFailure(err);
    emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus realm-bags: ${msg}`) });
    return exitFor(failure.code);
  }
}

async function runNexusRite(args: ParsedArgs): Promise<number> {
  const petname = args.positional[1];
  const rite = petname ? NEXUS_RITES[petname] : undefined;
  if (!rite) {
    if (petname) console.error(`lares nexus rite: unknown rite "${petname}"\n`);
    console.error("lares nexus rite <petname> — the pet-named procedures over the nexus primitives\n");
    for (const [name, r] of Object.entries(NEXUS_RITES)) console.error(`  ${name.padEnd(7)} ${r.composes}`);
    console.error("\n  quorum seats the kahu quorum on THIS node — the seats stand, the epoch arms, and the");
    console.error("  Nexus becomes ready to contract carriage with other operators.");
    return petname ? 2 : 0;
  }
  return rite.run(args);
}

/**
 * The one door over the carriage board's four acts — TWO relations that never fold into one another:
 *
 *   · `contract <operator-pubkey> [--sig <hex>]` / `revoke <operator-pubkey>` seat an OPERATOR (a person),
 *     whose own PERSONA ROOT signs the accepts-carriage token.
 *   · `carry <place-vessel-key> --carrier <hex>` / `uncarry <place-vessel-key>` seat a PLACE (a Herm or an
 *     unlit hearth), whose own device-minted VESSEL key signs the carrier seal. A place never enters the
 *     member set, and the result line says so rather than leaving a reader to assume it.
 *
 * FAIL CLOSED: an unseated charter, a sub-quorum, or a missing / invalid seal REFUSES and writes nothing.
 */
async function cmdContract(args: ParsedArgs, action: "admit" | "revoke" | "carry" | "uncarry"): Promise<number> {
  const place = action === "carry" || action === "uncarry";
  const nym = args.positional[1];
  if (!nym) {
    const spelled = action === "admit" ? "contract" : action;
    console.error(`usage: lares nexus ${spelled} <${place ? "place-vessel-key" : "operator-pubkey"}>${action === "admit" ? " [--sig <hex>]" : action === "carry" ? " --carrier <hex>" : ""}`);
    return 2;
  }
  try {
    const contractSig = action === "admit" ? (args.options["sig"] ?? args.options["contract"]) : undefined;
    const carrierSig  = action === "carry" ? (args.options["carrier"] ?? args.options["sig"]) : undefined;
    const { output } = await storeVerb("nexus-contract", {
      action, nym,
      ...(contractSig ? { contractSig } : {}),
      ...(carrierSig ? { carrierSig } : {}),
    }, NexusContractError);
    const r = output as unknown as NexusContractResult;
    emit(args, {
      ok: true,
      data: {
        action: r.action, nym: r.nym, parents: r.parents, evidenceCid: r.evidenceCid,
        sealEpochCid: r.sealEpochCid, threshold: r.threshold, signers: r.signers,
        contractIn: r.contractIn, boardUrl: r.boardUrl, memberHeld: r.memberHeld, carrierHeld: r.carrierHeld,
        bundle: r.bundle, findings: r.findings,
      },
      human: () => {
        // What the presenter noticed reaches the kahu who signed, and never stops the act.
        for (const f of r.findings) console.error(`lares nexus ${action}: the presenter noticed: ${presentationFindingLine(f)}`);
        const verb = action === "admit" ? "ADMITTED" : action === "carry" ? "CARRYING" : action === "uncarry" ? "UNCARRIED" : "REVOKED";
        console.log(`nexus ${action} → ${verb} ${nym.slice(0, 16)}… (act ${r.evidenceCid.slice(0, 16)}…, ${r.parents.length} parent(s))`);
        console.log(`  signed by:   ${r.signers.length} of ${r.threshold} required founding-kahu roots`);
        for (const s of r.signers) console.log(`    ${s.slice(0, 16)}…`);
        if (action === "admit") console.log(`  contract-in: ${r.contractIn === "self" ? "self-signed (held persona)" : "supplied token"}`);
        if (action === "carry") console.log(`  carrier seal: supplied, verified under the place's OWN vessel key`);
        console.log(`  epoch:       ${r.sealEpochCid}`);
        console.log(`  board:       ${r.boardUrl}`);
        if (place) {
          console.log(`  enforced:    ${r.carrierHeld ? "CARRIER (it follows this realm's PUBLIC-declared books BY HASH)" : "NOT a carrier (a standing uncarry or higher entry supersedes)"}`);
          console.log(`  and NOT:     a member — a place holds no read cap, no seat, and no membership (carry ⊥ read)`);
        } else {
          console.log(`  enforced:    ${r.memberHeld ? "MEMBER (a cross-operator under this nym co-federates / blind-transits sealed planes)" : "NOT a member (a standing revoke or higher entry supersedes)"}`);
        }
        if (r.bundle) {
          console.log(`  bundle:      the admit, its lineage (${r.bundle.lineage.length}), the Nexus and this hearth's gate key —`);
          console.log(`               \`--json\` emits it as \`data.bundle\`; the joinee runs \`lares nexus admit-take <file>\``);
        }
      },
    });
    return 0;
  } catch (err) {
    const msg  = err instanceof Error ? err.message : String(err);
    const failure = storeFailure(err, err instanceof NexusContractError ? "refused" : "error");
    emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus ${action}: ${msg}`) });
    return exitFor(failure.code);
  }
}

/**
 * `lares nexus members --list [--nexus <aid>]` folds one Nexus's members board — the public RECORD of the
 * admits its kahu signed, as this replica last synced it. It grants nothing. `--nexus` names a Nexus this
 * vessel holds a charter for (primary or carried); the default is the primary charter's.
 */
async function cmdMembers(args: ParsedArgs): Promise<number> {
  if (!args.flags["list"]) {
    console.error("usage: lares nexus members --list [--nexus <aid>]");
    return 2;
  }
  const aid = args.options["nexus"];
  try {
    const { output } = await storeVerb("nexus-members-list", aid !== undefined ? { aid } : {}, StoreDoorRefusal);
    const r = output as unknown as NexusMembersListResult;
    emit(args, {
      ok: true,
      data: {
        sealEpochCid: r.sealEpochCid || null, threshold: r.threshold,
        // WHOSE board this fold read. A members list is meaningless without it: the board is a shared
        // doc addressed by the island, so the same command on two vessels can fold two different Nexuses.
        aid: r.aid, island: r.island,
        seatedKeys: r.seatedKeys, members: r.members, entries: r.entries,
      },
      human: () => {
        console.log(`nexus members — the carriage-contracts board, a public record of admits (never authority):`);
        console.log(`  nexus:      ${r.aid ?? "(no charter — a private nexus of one)"}`);
        console.log(`  island:     ${r.island}`);
        console.log(`  epoch:      ${r.sealEpochCid || "(unseated — the registry stays inert)"}`);
        console.log(`  quorum:     ${r.threshold}-of-N · seated keys: ${r.seatedKeys}`);
        // "as of last sync" rides the label, never the reader's assumption. An EMPTY fold especially: a
        // definite "none contracted" is a claim ordinary partition can manufacture, and a human told a
        // negative as fact acts on it.
        console.log(`  members (${r.members.length} as of last sync):`);
        for (const n of r.members) console.log(`    ${n}`);
        if (r.members.length === 0) console.log(`    (none this replica has synced — a peer may hold members; the seated kahu remain the floor)`);
        console.log(`  board entries (${r.entries.length}):`);
        for (const e of r.entries) console.log(`    ${e.action.padEnd(6)} ${e.evidenceCid.slice(0, 16)}…  ${e.nym.slice(0, 16)}…  (${e.parents.length} parent(s), ${e.signers} sig${e.contractIn ? ", contract-in" : ""})`);
      },
    });
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failure = storeFailure(err);
    emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus members --list: ${msg}`) });
    return exitFor(failure.code);
  }
}

/**
 * `lares nexus accept-carriage [--index N] [--nexus <aid>]` — run by the JOINING operator on their OWN vessel:
 * mint the "accepts carriage" contract-in token the kahu supply to `nexus contract --sig <hex>`, and keep a
 * copy for that one Nexus. The consent-first seal (track contracts, never identities): the operator signs its
 * per-Nexus leaf + that charter's head epoch, nothing more. `--nexus` names a charter this vessel holds,
 * primary or carried (`seal import --carry`); the default is the primary charter's Nexus.
 */
async function cmdAcceptCarriage(args: ParsedArgs): Promise<number> {
  const idxRaw = args.options["index"];
  const handleIndex = idxRaw !== undefined ? Number.parseInt(idxRaw, 10) : 0;
  if (!Number.isInteger(handleIndex) || handleIndex < 0) {
    console.error(`--index must be a non-negative integer (got "${idxRaw}")`);
    return 2;
  }
  try {
    const aid = args.options["nexus"];
    // The consent signs under a leaf of a persona root, which rests sealed: the act rides the custody door.
    const r = await sealedAct<{ aid: string; nym: string; sealEpochCid: string; contractSig: string }>(
      "carriage.accept", { handleIndex, ...(aid !== undefined ? { aid } : {}) });
    // H2: the consent just written sits beside the seal home, never on this vessel's Repo — poke a standing
    // vessel to refold at once rather than leave its live readings stale until some later board write does.
    // L3: the answer rides the JSON rather than vanishing into a log line nobody downstream can read.
    const refold = await pokeSealHomeRefold();
    emit(args, {
      ok: true,
      data: { aid: r.aid, nym: r.nym, sealEpochCid: r.sealEpochCid, contractSig: r.contractSig, refold },
      human: () => {
        console.log(`nexus accept-carriage — signed the 'accepts carriage' contract-in (persona index ${handleIndex}):`);
        console.log(`  nexus:        ${r.aid}`);
        console.log(`  your nym:     ${r.nym}`);
        console.log(`  epoch:        ${r.sealEpochCid}`);
        console.log(`  contract-sig: ${r.contractSig}`);
        console.log(`  refold:       ${refold}`);
        console.log(`  hand this to a founding kahu:  lares nexus contract ${r.nym} --sig ${r.contractSig}`);
      },
    });
    return 0;
  } catch (err) {
    const msg  = err instanceof Error ? err.message : String(err);
    const failure = storeFailure(err, err instanceof NexusContractError || (err instanceof SealedActRefused && err.reason === "act-refused") ? "refused" : "error");
    emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus accept-carriage: ${msg}`) });
    return exitFor(failure.code);
  }
}

/**
 * `lares nexus admit-take <bundle-file>` — run by the JOINING operator on her OWN vessel: take the admit bundle a
 * founding kahu handed over (`nexus contract --json` → `data.bundle`, or the bundle object alone). The take
 * verifies it OFFLINE against the charter this vessel holds for its Nexus, refuses a leaf this vessel does not
 * hold, and keeps it under the seal home beside the consent. Routed through the store's door (row
 * `nexus-admit-take`): a standing vessel takes it against its own live Repo and re-presents its dial to the
 * hearth that wrote it at once; with no vessel standing, the row keeps the bundle and the next boot's dial
 * presents it.
 */
async function cmdAdmitTake(args: ParsedArgs): Promise<number> {
  const file = args.positional[1];
  if (!file) { console.error("usage: lares nexus admit-take <bundle-file>"); return 2; }
  try {
    let raw: string;
    try { raw = readFileSync(file, "utf8"); } catch (err) {
      throw new AdmitBundleError(`cannot read ${file}: ${(err as NodeJS.ErrnoException).code ?? String(err)}`);
    }
    // Accept the contract's whole `--json` envelope as handed over, or the bundle alone.
    let text = raw;
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const inner = ((parsed["data"] as Record<string, unknown> | undefined)?.["bundle"]) ?? parsed["bundle"];
      if (inner !== undefined) text = JSON.stringify(inner);
    } catch { /* the take names the parse failure */ }
    const { output: r } = await storeVerb("nexus-admit-take", { raw: text }, AdmitBundleError);
    const represented = r["represented"] === true;
    emit(args, {
      ok: true,
      data: { aid: r["aid"], nym: r["nym"], admitCid: r["admitCid"], gatePubKey: r["gatePubKey"], lineage: r["lineage"], path: r["path"], represented },
      human: () => {
        console.log("nexus admit-take — the admit verified against the charter held for its Nexus, and kept:");
        console.log(`  nexus:   ${String(r["aid"])}`);
        console.log(`  leaf:    ${String(r["nym"])}`);
        console.log(`  admit:   ${String(r["admitCid"])} (lineage ${String(r["lineage"])})`);
        console.log(`  hearth:  ${String(r["gatePubKey"])}  (the dial to this gate presents it)`);
        console.log(`  kept at: ${String(r["path"])}`);
        console.log(represented
          ? "  the running vessel re-folded and re-presents its dial"
          : "  no running vessel answered — the next boot's dial presents it");
      },
    });
    return 0;
  } catch (err) {
    const msg  = err instanceof Error ? err.message : String(err);
    const failure = storeFailure(err, err instanceof AdmitBundleError ? "refused" : "error");
    emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus admit-take: ${msg}`) });
    return exitFor(failure.code);
  }
}

/**
 * `lares nexus carry-for` — run by the joining PLACE on its OWN vessel: mint the carrier seal the founding
 * kahu supply to `nexus carry <key> --carrier <hex>`. It reads the VESSEL key and nothing else, which is the
 * whole reason the verb exists: a Herm holds no persona root by law, so `accept-carriage` can never run here.
 */
async function cmdCarryFor(args: ParsedArgs): Promise<number> {
  try {
    // NO POKE HERE (unlike `accept-carriage`): `runNexusCarryFor` only SIGNS — it writes nothing beside the
    // seal home, so there is nothing for a standing vessel's live readings to have gone stale over.
    const r = await runNexusCarryFor({ sealHome: larSealHome() });
    emit(args, {
      ok: true,
      data: { nym: r.nym, sealEpochCid: r.sealEpochCid, carrierSig: r.carrierSig },
      human: () => {
        console.log("nexus carry-for — signed 'I carry for this Nexus' with this vessel's OWN key (no persona read):");
        console.log(`  this place:   ${r.nym}`);
        console.log(`  epoch:        ${r.sealEpochCid}`);
        console.log(`  carrier-sig:  ${r.carrierSig}`);
        console.log(`  hand this to a founding kahu:  lares nexus carry ${r.nym} --carrier ${r.carrierSig}`);
      },
    });
    return 0;
  } catch (err) {
    const msg  = err instanceof Error ? err.message : String(err);
    const failure = storeFailure(err, err instanceof NexusContractError ? "refused" : "error");
    emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus carry-for: ${msg}`) });
    return exitFor(failure.code);
  }
}

/**
 * `lares nexus posture [private | open]` — read or flip the per-Nexus federation posture on the nexus charter doc
 * doc. Default PRIVATE (a Nexus develops in isolation); OPEN lets cross-Nexus foreign operators co-federate the
 * PUBLIC planes (never a private plane). No arg reads the current posture. Routed through the store's door
 * (row `nexus-posture`): a standing vessel flips the joint AND refolds its live gate at once; with no vessel
 * standing, the row writes the joint and the next boot reads it.
 */
async function cmdPosture(args: ParsedArgs): Promise<number> {
  const want = args.positional[1];
  if (want !== undefined && want !== "private" && want !== "open") {
    console.error(`usage: lares nexus posture [private | open]   (got "${want}")`);
    return 2;
  }
  try {
    const { output: r } = await storeVerb("nexus-posture", want === undefined ? {} : { want }, StoreDoorRefusal);
    const posture = String(r["posture"]);
    if (want === undefined) {
      emit(args, {
        ok: true,
        data: { posture, present: r["present"] === true },
        human: () => {
          console.log(`nexus federation posture: ${posture}${r["present"] ? "" : "  (no charter doc — default)"}`);
          console.log(posture === "private"
            ? `  PRIVATE — cross-Nexus foreign operators are denied co-federation; only same-Nexus members co-federate.`
            : `  OPEN — cross-Nexus foreign operators co-federate the PUBLIC planes (never a private plane).`);
        },
      });
      return 0;
    }
    emit(args, {
      ok: true,
      data: { posture, path: r["path"] },
      human: () => {
        console.log(`nexus federation posture → ${posture.toUpperCase()} (written ${String(r["path"])})`);
        console.log(posture === "open"
          ? `  the Nexus now co-federates the PUBLIC planes with cross-Nexus foreign operators (private planes stay sealed).`
          : `  the Nexus keeps to itself — only same-Nexus members co-federate (the fail-closed default).`);
        console.log(`  a standing vessel's live gate refolded at once; the next boot reads it either way.`);
      },
    });
    return 0;
  } catch (err) {
    const msg  = err instanceof Error ? err.message : String(err);
    const failure = storeFailure(err, err instanceof StoreDoorRefusal ? "refused" : "error");
    emit(args, { ok: false, error: failure, human: () => console.error(`lares nexus posture: ${msg}`) });
    return exitFor(failure.code);
  }
}
