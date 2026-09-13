/**
 * `lares nexus seal {seat | rotate | commit | show}` — the operator's door to the founding-kahu ROSTER
 * and its PRE-ROTATED, hash-linked charter-epoch CHAIN (TUF ≈ KERI), the Kapae immune antigen's authority
 * home. The roster lives as data-as-authority in the `bags/nexus` charter DOC; the antigen roots on
 * the chain's HEAD epoch. The pure antigen fold/verify reads this same doc through `foundingRoster`.
 *
 *   seat    read each held persona's ed25519 VERIFYING key from the vault (NEVER the signing seed), match it
 *           to a founding-kahu chair by its DECLARED HANDLE (never the private pet-name — matching the label
 *           would weld a compartment's private name to a public commitment), and establish the GENESIS epoch (sequence 0)
 *           bound to the seated key-set + an operator-supplied PRE-ROTATION commitment (`--next-key-commit`)
 *           to the next epoch's keys. FAILS CLOSED: a kahu with no matching held persona stays unseated; a
 *           quorum-short roster establishes no epoch (the antigen stays inert); a chain already ADVANCED past
 *           genesis refuses re-seat (rotate advances it, never a silent re-genesis).
 *   rotate  advance the chain: the operator has provisioned the pre-committed next key-set into the vault;
 *           rotate REVEALS it, verifies its digest matches the head's `nextKeyCommit` (FAIL CLOSED on
 *           mismatch), seats it as the new head, hash-linked to the prior epoch, and pre-commits the
 *           following key-set (`--next-key-commit`). A broken reveal writes nothing.
 *   commit  compute a key-set commitment digest (`sealKeySetHash`) from a comma-separated `--keys` set +
 *           `--threshold`, so the operator produces the `--next-key-commit` value OFFLINE from the next
 *           epoch's verifying keys, holding the next SIGNING seeds in offline custody.
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
 *   THIS vessel's own vault — `listPersonaRoots` reaches no other — so a seal quorum is one operator's
 *   faces by construction, which is why `nexusPhase` reads a fresh one as a SEED rather than a Nexus.
 *   `attestation-plane#3` rules the roles apart: the kahu HOST, and a Nexus's CONTRACTED OPERATORS
 *   ATTEST — so a contracted operator never becomes a chair here.
 *
 *   THE OTHER — the AMORPHOUS DREAMS CABAL (`kahu`). Holds `admin` on the ACCESS axis over the CORPUS
 *   bags and the genesis artifact: the written grammar, not any Nexus's membership. Multi-human by
 *   design, and it carries NO live command into a vessel — "the Cabal authors; the protocol
 *   distributes; the vessels enforce." No delegation grants it today and no sentinel names it.
 *
 * GOVERNING A REALM ⊥ GOVERNING THE METAL (operator ruling 2026-08-09). This door is the metal.
 */

import {
  readNexusDoc, writeNexusPractice,
  runNexusContract, runNexusAcceptCarriage, runNexusCarryFor, runNexusMembersList, NexusContractError,
} from "@lararium/node";
import { federationPostureFromDoc, type FederationPosture } from "@lararium/mesh";
import { larSealHome, vesselDid } from "../env.js";
import { runVerb } from "../verb-call.js";
import { summaryOutput } from "../verb-result.js";
import { emit, exitFor, refuseUsage } from "../render.js";
import { cmdKahuli, runKahuliRite } from "./nexus-kahuli.js";
import { cmdPublish } from "./nexus-publish.js";
import { cmdKapae, cmdUnKapae } from "./nexus-kapae-cmd.js";
import { cmdSeal, runCabalRite } from "./nexus-seal.js";
import type { ParsedArgs } from "../parse-args.js";

const NEXUS_USAGE: readonly string[] = [
  "usage: lares nexus <seal | rite | kapae | un_kapae | contract | revoke | carry | uncarry | members | accept-carriage | carry-for | posture | refresh | realm-bag | realm-bags>",
  "",
  "  seal <seat | reserve | rotate | commit | show | export | import | grow>  the founding-kahu roster + pre-rotated epoch chain; grow = the crossing record ceremony",
  "  kapae <nym> [--reason <text>]             raise a quorum-signed ban on a presenter nym",
  "  kapae --list                              read the currently-Kapae'd set (the fold)",
  "  un_kapae <nym>                            mint a quorum-signed lift at a higher version",
  "  contract <operator-pubkey> [--sig <hex>]  seat a vessel at the CONTRACT cap-tier (quorum + contract-in)",
  "  revoke <operator-pubkey>                  revoke a member (quorum-only)",
  "  carry <place-vessel-key> --carrier <hex>  contract a faceless PLACE (a Herm) as a CARRIER — quorum + its own",
  "                                            VESSEL-key seal. It NEVER enters the member set; its whole grant is",
  "                                            the realm's PUBLIC-declared books, by hash (heraldry#/the-herm-card)",
  "  uncarry <place-vessel-key>                end a carrier contract (quorum-only)",
  "  members --list                            read the currently-admitted member set (the fold)",
  "  accept-carriage [--index N]               (joining operator) mint the 'accepts carriage' contract-in",
  "  carry-for                                 (joining PLACE, on itself) mint the carrier seal with its OWN vessel",
  "                                            key — reads no persona, because a crossroads holds none",
  "  posture [private | open]                  read / flip the cross-Nexus federation posture",
  "  rite <petname>                            the pet-named procedures — `cabal` seats the founding quorum, `kahuli` overturns a ratchet tier",
  "  kahuli <engine | grammar>                 the OVERTURN — advance one ratchet tier of this Nexus's genesis composition",
  "  refresh                                   re-read the charter and re-fold the boards it names",
  "  realm-bag <bag-uri> [--index N]           register a bag this steward keeps on the realm's shared CRDT (read at CONTRACT)",
  "            [--steward <did>[,<did>]]       also NAME those stewards — the record waits on each one's own co-sign",
  "            [--cosign]                      consent as a named steward to a standing proposal",
  "            [--tier contract|public]        the DECLARED read — public names a book the Herm carries by hash",
  "            [--expiry <rolls>]              lease the registration against the realm's own pace",
  "            [--charter <nym>=<realm-id>]    the charter a named hand holds (a book spanning two charters)",
  "  publish <plugins>                         THE OFFERING DOOR — what THIS operator publishes for others to take;",
  "                                            held apart from `kahuli`, which overturns what the MESH shares",
  "  realm-bags                                the bags the realm carries, and who keeps each",
];

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
    case "carry-for":       return await cmdCarryFor(args);
    case "posture":         return await cmdPosture(args);
    case "rite":            return await runNexusRite(args);
    case "kahuli":          return await cmdKahuli(args);
    case "publish":         return await cmdPublish(args);
    case "refresh":         return await cmdNexusRefresh(args);
    case "realm-bag":       return await cmdRealmBag(args);
    case "realm-bags":      return await cmdRealmBags(args);
    default:
      return refuseUsage(args, "nexus", NEXUS_USAGE, verb ? `unknown verb "${verb}"` : undefined);
  }
}

/**
 * `lares nexus rite <petname>` — the pet-named procedures over the nexus primitives.
 *
 * A RITE names a complex multi-verb procedure, at second position so a composition never competes with a
 * primitive for namespace. The primitives keep every behaviour; a rite only orders them.
 */
const NEXUS_RITES: Readonly<Record<string, { readonly composes: string; readonly run: (a: ParsedArgs) => Promise<number> }>> = {
  cabal:  { composes: "seal reserve · seal seat · seal show", run: runCabalRite },
  kahuli: { composes: "kahuli grammar (· kahuli engine — held)", run: runKahuliRite },
};

/**
 * `lares nexus refresh` — re-read the disk charter and re-fold the boards it names.
 *
 * THE DOOR AN IMPORT NEEDS. A joining operator places a partner's charter and signs a contract-in,
 * and from that moment her vessel should fold the FOUNDER's members board rather than her own. The
 * daemon re-folds on its own when carriage re-dials, so nothing was wrong — there was simply no way
 * to ask, and an operator who had just imported a charter had to wait on a reconnect she cannot see.
 *
 * The refresh also OPENS the named board on the networked repo, which is what lets a board this
 * vessel has never held arrive at all.
 */
async function cmdNexusRefresh(args: ParsedArgs): Promise<number> {
  try {
    const r = await runVerb("nexus-refresh", {}, await vesselDid());
    if (r.status === "error") {
      emit(args, { ok: false, error: { code: "error", message: r.errorMessage ?? "nexus-refresh failed" },
                   human: () => console.error(`lares nexus refresh: ${r.errorMessage ?? "failed"}`) });
      return 1;
    }
    const out = summaryOutput(r) ?? {};
    emit(args, {
      ok: true, data: out,
      human: () => {
        console.log("nexus refresh — charter re-read, boards re-folded:");
        console.log(`  posture:        ${String(out["posture"] ?? "?")}`);
        console.log(`  members board:  ${String(out["boardRoot"] ?? "?")}  (this vessel's own immune surface)`);
        console.log(`  member entries: ${String(out["memberEntries"] ?? 0)} · antigen entries: ${String(out["antigenEntries"] ?? 0)}`);
      },
    });
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(args, { ok: false, error: { code: "error", message: msg }, human: () => console.error(`lares nexus refresh: ${msg}`) });
    return 1;
  }
}

/**
 * `lares nexus realm-bag <bag-uri>` — register a bag this vessel's steward keeps on the realm's shared CRDT
 * (realm-bag-brief, ruled 2026-09-11). The bag's doc is the one this vessel names for the URI; the record
 * rides the steward's persona-root signature; @crossroads carries only that the bag exists and who keeps it.
 * A contracted member reads it through `meme get --bag <slug>`; the stewards alone write.
 */
async function cmdRealmBag(args: ParsedArgs): Promise<number> {
  const bag = args.positional[1];
  if (!bag) { console.error("usage: lares nexus realm-bag <bag-uri> [--steward <did>…] [--cosign] [--tier <t>] [--expiry <rolls>] [--charter <nym>=<realm-id>] [--index N]"); return 2; }
  const index = args.options["index"] !== undefined ? Number(args.options["index"]) : 0;
  // `--steward` names a SECOND keeping hand. The record is n-of-n, so naming is a proposal: it stands
  // unregistered until that hand runs `lares nexus realm-bag <bag> --cosign` on her own vessel.
  const stewards = (args.options["steward"] ?? "").split(",")
    .map((v) => v.trim().replace(/^0x/i, "").toLowerCase()).filter((v) => v.length > 0);
  const cosign = args.flags["cosign"] === true;
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
      bag: bag.startsWith("lar:") ? bag : `lar:///ha.ka.ba/bags/${bag}`, index, stewards, cosign,
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
          console.log(`             the record is n-of-n — it stands unregistered until each named hand runs`);
          console.log(`             \`lares nexus realm-bag ${bag} --cosign\` on her own vessel`);
        }
      },
    });
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(args, { ok: false, error: { code: "error", message: msg }, human: () => console.error(`lares nexus realm-bag: ${msg}`) });
    return 1;
  }
}

/** `lares nexus realm-bags` — the standing registrations the realm carries, as of this vessel's last sync. */
async function cmdRealmBags(args: ParsedArgs): Promise<number> {
  try {
    const r = await runVerb("realm-bags", {}, await vesselDid());
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
    emit(args, { ok: false, error: { code: "error", message: msg }, human: () => console.error(`lares nexus realm-bags: ${msg}`) });
    return 1;
  }
}

async function runNexusRite(args: ParsedArgs): Promise<number> {
  const petname = args.positional[1];
  const rite = petname ? NEXUS_RITES[petname] : undefined;
  if (!rite) {
    if (petname) console.error(`lares nexus rite: unknown rite "${petname}"\n`);
    console.error("lares nexus rite <petname> — the pet-named procedures over the nexus primitives\n");
    for (const [name, r] of Object.entries(NEXUS_RITES)) console.error(`  ${name.padEnd(7)} ${r.composes}`);
    console.error("\n  cabal seats the founding quorum on THIS node — the kahu stand, the epoch arms, and the");
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
    const r = await runNexusContract({
      action, nym,
      ...(contractSig ? { contractSig } : {}),
      ...(carrierSig ? { carrierSig } : {}),
      sealHome: larSealHome(),
    });
    emit(args, {
      ok: true,
      data: {
        action: r.action, nym: r.nym, version: r.version, priorVersion: r.priorVersion,
        sealEpochCid: r.sealEpochCid, threshold: r.threshold, signers: r.signers,
        contractIn: r.contractIn, boardUrl: r.boardUrl, memberNow: r.memberNow, carrierNow: r.carrierNow,
      },
      human: () => {
        const verb = action === "admit" ? "ADMITTED" : action === "carry" ? "CARRYING" : action === "uncarry" ? "UNCARRIED" : "REVOKED";
        console.log(`nexus ${action} → ${verb} ${nym.slice(0, 16)}… (version ${r.version}${r.priorVersion !== null ? `, superseding ${r.priorVersion}` : ""})`);
        console.log(`  signed by:   ${r.signers.length} of ${r.threshold} required founding-kahu roots`);
        for (const s of r.signers) console.log(`    ${s.slice(0, 16)}…`);
        if (action === "admit") console.log(`  contract-in: ${r.contractIn === "self" ? "self-signed (held persona)" : "supplied token"}`);
        if (action === "carry") console.log(`  carrier seal: supplied, verified under the place's OWN vessel key`);
        console.log(`  epoch:       ${r.sealEpochCid}`);
        console.log(`  board:       ${r.boardUrl}`);
        if (place) {
          console.log(`  enforced:    ${r.carrierNow ? "CARRIER (it follows this realm's PUBLIC-declared books BY HASH)" : "NOT a carrier (a standing uncarry or higher entry supersedes)"}`);
          console.log(`  and NOT:     a member — a place holds no read cap, no seat, and no membership (carry ⊥ read)`);
        } else {
          console.log(`  enforced:    ${r.memberNow ? "MEMBER (a cross-operator under this nym co-federates / blind-transits sealed planes)" : "NOT a member (a standing revoke or higher entry supersedes)"}`);
        }
      },
    });
    return 0;
  } catch (err) {
    const msg  = err instanceof Error ? err.message : String(err);
    const code = err instanceof NexusContractError ? "refused" : "error";
    emit(args, { ok: false, error: { code, message: msg }, human: () => console.error(`lares nexus ${action}: ${msg}`) });
    return exitFor("error");
  }
}

/** `lares nexus members --list` folds the currently-admitted operator member set off the members board. */
async function cmdMembers(args: ParsedArgs): Promise<number> {
  if (!args.flags["list"]) {
    console.error("usage: lares nexus members --list");
    return 2;
  }
  try {
    const r = await runNexusMembersList({ sealHome: larSealHome() });
    emit(args, {
      ok: true,
      data: {
        sealEpochCid: r.sealEpochCid || null, threshold: r.threshold,
        // WHOSE board this fold read. A members list is meaningless without it: the board is a shared
        // doc addressed by a key, so the same command on two vessels can fold two different Nexuses.
        boardRoot: r.boardRoot,
        seatedKeys: r.seatedKeys, members: r.members, entries: r.entries,
      },
      human: () => {
        console.log(`nexus members — the carriage-contracts board fold:`);
        console.log(`  epoch:      ${r.sealEpochCid || "(unseated — the registry stays inert)"}`);
        console.log(`  quorum:     ${r.threshold}-of-N · seated keys: ${r.seatedKeys}`);
        // "as of last sync" rides the label, never the reader's assumption. An EMPTY fold especially: a
        // definite "none contracted" is a claim ordinary partition can manufacture, and a human told a
        // negative as fact acts on it.
        console.log(`  members (${r.members.length} as of last sync):`);
        for (const n of r.members) console.log(`    ${n}`);
        if (r.members.length === 0) console.log(`    (none this replica has synced — a peer may hold members; the seated kahu remain the floor)`);
        console.log(`  board entries (${r.entries.length}):`);
        for (const e of r.entries) console.log(`    ${e.action.padEnd(6)} v${e.version}  ${e.nym.slice(0, 16)}…  (${e.signers} sig${e.contractIn ? ", contract-in" : ""})`);
      },
    });
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(args, { ok: false, error: { code: "error", message: msg }, human: () => console.error(`lares nexus members --list: ${msg}`) });
    return exitFor("error");
  }
}

/**
 * `lares nexus accept-carriage [--index N]` — run by the JOINING operator on their OWN vessel: mint the
 * "accepts carriage" contract-in token the kahu supply to `nexus contract --sig <hex>`. The consent-first
 * seal (track contracts, never identities): the operator signs its pubkey + the charter epoch, nothing more.
 */
async function cmdAcceptCarriage(args: ParsedArgs): Promise<number> {
  const idxRaw = args.options["index"];
  const handleIndex = idxRaw !== undefined ? Number.parseInt(idxRaw, 10) : 0;
  if (!Number.isInteger(handleIndex) || handleIndex < 0) {
    console.error(`--index must be a non-negative integer (got "${idxRaw}")`);
    return 2;
  }
  try {
    const r = await runNexusAcceptCarriage({ handleIndex, sealHome: larSealHome() });
    emit(args, {
      ok: true,
      data: { nym: r.nym, sealEpochCid: r.sealEpochCid, contractSig: r.contractSig },
      human: () => {
        console.log(`nexus accept-carriage — signed the 'accepts carriage' contract-in (persona index ${handleIndex}):`);
        console.log(`  your nym:     ${r.nym}`);
        console.log(`  epoch:        ${r.sealEpochCid}`);
        console.log(`  contract-sig: ${r.contractSig}`);
        console.log(`  hand this to a founding kahu:  lares nexus contract ${r.nym} --sig ${r.contractSig}`);
      },
    });
    return 0;
  } catch (err) {
    const msg  = err instanceof Error ? err.message : String(err);
    const code = err instanceof NexusContractError ? "refused" : "error";
    emit(args, { ok: false, error: { code, message: msg }, human: () => console.error(`lares nexus accept-carriage: ${msg}`) });
    return exitFor("error");
  }
}

/**
 * `lares nexus carry-for` — run by the joining PLACE on its OWN vessel: mint the carrier seal the founding
 * kahu supply to `nexus carry <key> --carrier <hex>`. It reads the VESSEL key and nothing else, which is the
 * whole reason the verb exists: a Herm holds no persona root by law, so `accept-carriage` can never run here.
 */
async function cmdCarryFor(args: ParsedArgs): Promise<number> {
  try {
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
    const code = err instanceof NexusContractError ? "refused" : "error";
    emit(args, { ok: false, error: { code, message: msg }, human: () => console.error(`lares nexus carry-for: ${msg}`) });
    return exitFor("error");
  }
}

/**
 * `lares nexus posture [private | open]` — read or flip the per-Nexus federation posture on the nexus charter doc
 * doc. Default PRIVATE (a Nexus develops in isolation); OPEN lets cross-Nexus foreign operators co-federate the
 * PUBLIC planes (never a private plane). No arg reads the current posture.
 */
async function cmdPosture(args: ParsedArgs): Promise<number> {
  const sealHome = larSealHome();
  const want = args.positional[1];
  const doc = readNexusDoc(sealHome);
  if (want === undefined) {
    const posture = federationPostureFromDoc(doc);
    emit(args, {
      ok: true,
      data: { posture, present: doc !== null },
      human: () => {
        console.log(`nexus federation posture: ${posture}${doc ? "" : "  (no charter doc — default)"}`);
        console.log(posture === "private"
          ? `  PRIVATE — cross-Nexus foreign operators are denied co-federation; only same-Nexus members co-federate.`
          : `  OPEN — cross-Nexus foreign operators co-federate the PUBLIC planes (never a private plane).`);
      },
    });
    return 0;
  }
  if (want !== "private" && want !== "open") {
    console.error(`usage: lares nexus posture [private | open]   (got "${want}")`);
    return 2;
  }
  if (!doc) {
    emit(args, { ok: false, error: { code: "refused", message: "no nexus doc — run `lares nexus seal seat` before setting a posture" }, human: () => console.error("lares nexus posture: no charter doc — seat the charter first") });
    return exitFor("error");
  }
  const posture: FederationPosture = want;
  // The PRACTICE joint alone, and the narrowness IS the guard: this writer never parses the seal lineage
  // block, so the cheapest act in the house cannot reach the dearest joint in it.
  const path = writeNexusPractice(sealHome, { federationPosture: posture }, doc);
  emit(args, {
    ok: true,
    data: { posture, path },
    human: () => {
      console.log(`nexus federation posture → ${posture.toUpperCase()} (written ${path})`);
      console.log(posture === "open"
        ? `  the Nexus now co-federates the PUBLIC planes with cross-Nexus foreign operators (private planes stay sealed).`
        : `  the Nexus keeps to itself — only same-Nexus members co-federate (the fail-closed default).`);
      console.log(`  NOTE: a running node reads the posture as-of-boot; bounce it (or await the refresh hook) to apply a live flip.`);
    },
  });
  return 0;
}
