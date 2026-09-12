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
  readNexusDoc, writeNexusDoc, writeNexusSeal, writeNexusKahu, writeNexusPractice, nexusCharterDocPath, nexusCharterDocRelPath,
  listPersonaRoots, generateOrLoadPersonaGroupRoot, makeNodePersonaDeclarationStore,
  runNexusKapae, runNexusKapaeList, NexusKapaeError,
  runNexusContract, runNexusAcceptCarriage, runNexusMembersList, NexusContractError,
  hasContractedInto,
  loadVesselVerifyingKey,
  sealReserveMineShare, writeCharterReserveState, readCharterReserveState,
} from "@lararium/node";
import { federationPostureFromDoc, type FederationPosture } from "@lararium/mesh";
import {
  emptyFoundingCharterDoc, rosterFromNexusDoc, foundingQuorumSeated, sealLineageHead,
  personasStandingForSeat, majorityThreshold, genesisCharterEpoch, rotateSealEpoch, sealKeySetHash,
  generateReserveSeed, deriveReserveKeySet, reserveNextKeyCommit, splitReserveSeed,
  RESERVE_THRESHOLD, RESERVE_KAHU_COUNT, defaultCryptoProvider,
  type NexusDoc, type NexusCharterKahu, type SealEpoch, type ReserveCard,
} from "@lararium/mesh";
import { existsSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { larSealHome, larDataDir, larRoot, vesselDid } from "../env.js";
import { runVerb } from "../verb-call.js";
import { summaryOutput } from "../verb-result.js";
import { makeFleetDeclarationStore, fleetPeerDid } from "../daemon-persona-store.js";
import { rosterStanding, nexusPhase, sealImportVerdict, foreignSeats } from "@lararium/mesh";
import {
  reserveTransitionCidOf, verifyReserveTransition, witnessSignBytes,
  reserveTransitionBytes, transitionSignerFromSeed,
  type ReserveTransition, type ReserveTransitionCore, type TransitionWitness,
} from "@lararium/mesh";
import type { QuorumSignature } from "@lararium/mesh";
import { loadPersonaGroupRootSeed, readGenesisEngineCid, readGenesisGrammarCid, readGenesisPluginsCid } from "@lararium/node";
import { emit, exitFor, refuseUsage } from "../render.js";
import type { ParsedArgs } from "../parse-args.js";

class UsageError extends Error {}

const NEXUS_USAGE: readonly string[] = [
  "usage: lares nexus <seal | rite | kapae | un_kapae | contract | revoke | members | accept-carriage | posture | refresh | realm-bag | realm-bags>",
  "",
  "  seal <seat | reserve | rotate | commit | show | export | import | grow>  the founding-kahu roster + pre-rotated epoch chain; grow = the crossing record ceremony",
  "  kapae <nym> [--reason <text>]             raise a quorum-signed ban on a presenter nym",
  "  kapae --list                              read the currently-Kapae'd set (the fold)",
  "  un_kapae <nym>                            mint a quorum-signed lift at a higher version",
  "  contract <operator-pubkey> [--sig <hex>]  seat a vessel at the CONTRACT cap-tier (quorum + contract-in)",
  "  revoke <operator-pubkey>                  revoke a member (quorum-only)",
  "  members --list                            read the currently-admitted member set (the fold)",
  "  accept-carriage [--index N]               (joining operator) mint the 'accepts carriage' contract-in",
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
  "  realm-bags                                the bags the realm carries, and who keeps each",
];

const SEAL_USAGE: readonly string[] = [
  "usage: lares nexus seal <seat | reserve | rotate | commit | show | export | import>",
  "",
  "  seat    form the roster from the personas that DECLARED a Handle + STOOD for a chair, then",
  "          establish the GENESIS epoch over their verifying keys:",
  "          --next-key-commit <digest>   the pre-rotation commitment",
  "          [--threshold <k>]            the quorum rule (default: majority of those that stood)",
  "  rotate  reveal the pre-committed next key-set (now in the vault) + advance the chain.",
  "          The roster becomes exactly what STANDS — the succession door: a kahu steps down by",
  "          no longer standing, a new one takes a chair by standing. Either way the reveal must",
  "          match the prior epoch's pre-commitment, so no seat moves without notice.",
  "          --next-key-commit <digest-of-the-FOLLOWING-key-set>",
  "          [--threshold <k>]  the quorum rule for the new roster (default: majority)",
  "  commit  compute a key-set commitment digest:  --keys <k1,k2,...> --threshold <k>",
  "  show    read the current founding-kahu roster + chain head + quorum verdict",
  "  reserve [refresh|show]                     custody the pre-rotation's NEXT key-set:",
  "          reserve         forge one reserve seed, derive the 3 next keys HARDENED, print the",
  "                          --next-key-commit + the 3 recovery cards   [--guardian-a --guardian-b]",
  "          reserve refresh re-seed + re-derive + re-issue the cards + print a NEW commit",
  "          reserve show    the reserve state (commit present, guardians, share sealed)",
];

export async function cmdNexus(args: ParsedArgs): Promise<number> {
  const verb = args.positional[0];
  switch (verb) {
    case "seal":            return await cmdSeal(args);
    case "kapae":           return await cmdKapae(args);
    case "un_kapae":        return await cmdUnKapae(args);
    case "contract":        return await cmdContract(args, "admit");
    case "revoke":          return await cmdContract(args, "revoke");
    case "members":         return await cmdMembers(args);
    case "accept-carriage": return await cmdAcceptCarriage(args);
    case "posture":         return await cmdPosture(args);
    case "rite":            return await runNexusRite(args);
    case "kahuli":          return await cmdKahuli(args);
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
 * The cabal rite — forge the pre-rotation, seat the roster it arms, and read the verdict.
 *
 * ── WHY IT DOES NOT MINT THE PERSONAS ───────────────────────────────────────────────────────────
 * A chair joins on a DECLARED HANDLE, and a handle is a name a human chooses and announces. A rite that
 * invented three of them would make the SOURCE decide who the founding kahu are, leaving the operator to
 * confirm a legitimacy call somebody else made. So the three `persona new` acts stay outside this rite,
 * deliberately, and the seat refuses when nobody stands — which is the correct refusal, not a gap.
 *
 * ── WHAT IT ACTUALLY REMOVES ────────────────────────────────────────────────────────────────────
 * The pre-rotation digest. `reserve` forges it and `seat` requires it, and between them an operator
 * transcribes a 64-character hex by hand — the only place in the whole founding where a value crosses on
 * a clipboard. The reserve WRITES that digest into its own state, so the rite reads it back and threads
 * it. A digest copied by hand is a digest that can be copied wrong, and a wrong one seats a pre-commitment
 * no future rotate can ever satisfy.
 */
async function runCabalRite(args: ParsedArgs): Promise<number> {
  const rest = { ...args, positional: args.positional.slice(2) };

  const reserved = await sealReserveProvision(rest, "provision");
  if (reserved !== 0) {
    console.error("lares nexus rite cabal: halted at `seal reserve` — nothing seated, nothing written.");
    return reserved;
  }

  // The digest crosses in memory rather than through a human. Absent state here names a reserve that
  // reported success and persisted nothing, which is worth refusing loudly rather than seating unarmed.
  const state = readCharterReserveState();
  const commit = state?.nextKeyCommit;
  if (!commit) {
    console.error("lares nexus rite cabal: the reserve wrote no next-key commit — refusing to seat unarmed.");
    console.error("  an unarmed genesis epoch cannot pre-commit its successor, so the chain could never rotate.");
    return 1;
  }

  const seated = await sealSeat({ ...rest, options: { ...rest.options, "next-key-commit": commit } });
  if (seated !== 0) {
    console.error("lares nexus rite cabal: halted at `seal seat`. The reserve stands; re-run after seating");
    console.error("  personas that declared a Handle AND stood for a chair (`persona new <i> --handle … --seat`).");
    return seated;
  }
  return await sealShow(rest);
}

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

// ── kāhuli — the OVERTURN ──────────────────────────────────────────────────────────────────────────
//
// One verb, the TIER is the argument (parity with `nexus seal <sub>` + `vessel rite <name>`). kāhuli is
// the act; ʻōlelo kāhuli is the result-state of `kahuli grammar`. Two ratchets ride one genesis doc:
//   · ENGINE  (engineCid = the hearth true-name) — SLOW, signed into every device delegation edge, so it
//             binds MEMBERSHIP. Advancing it re-binds the whole fleet; HELD until the graceful forward-
//             rebind (predecessor pointer + a both-epoch read span, ending by non-renewal) has its rulings.
//   · GRAMMAR (grammarCid = the REQUIRED memetic-wikitext grammar ALONE) — FAST, never the true-name.
// An operator's OWN plugin collection (pluginsCid) is NOT a kāhuli tier: it layers on the required base,
// overturns nobody else's reading, and moves with no ratchet act at all.

// The epochs read through the SAME composable genesis cap the vessel boots from (`LAR_GENESIS` →
// `~/.lares/config.json` → repo-relative `<corpus>/genesis`). A hand-rolled `larRoot()/genesis` read
// honoured neither, so with the cap pointed elsewhere this verb reported the epochs of an island the
// vessel does not boot — and the epoch it prints is the hearth true-name, the value an operator reads
// before deciding whether an overturn strands a fleet. A silent wrong answer is the worst shape here.

const KAHULI_USAGE: readonly string[] = [
  "usage: lares nexus kahuli <engine | grammar>",
  "",
  "  the OVERTURN — advance one ratchet tier of this Nexus's genesis composition:",
  "    engine   the SLOW ratchet: the hearth true-name (engineCid), signed into every device",
  "             delegation edge — it binds MEMBERSHIP. HELD: advancing re-binds the fleet mesh-wide;",
  "             the graceful forward-rebind span (predecessor + both-epoch reads) awaits its rulings.",
  "    grammar  the FAST ratchet: the REQUIRED memetic-wikitext grammar alone (grammarCid) —",
  "             never the true-name. Reads the current epoch; --apply re-derives the island (the bake).",
  "",
  "  a read NEVER builds — the deliberate build+push lives behind --apply and in `nexus rite kahuli`.",
];

/**
 * `lares nexus kahuli engine` — the SLOW ratchet, HELD. A deliberate not-yet, never an unknown verb: the
 * tier is real and its advance is withheld on purpose, because moving engineCid re-binds every device edge.
 */
function kahuliEngineHeld(): number {
  const engineCid = readGenesisEngineCid();
  console.error("nexus kahuli engine — HELD.");
  console.error(`  current engine epoch (true-name): ${engineCid ?? "(no island baked in this root yet)"}`);
  console.error("  advancing the engine re-binds MEMBERSHIP mesh-wide — every device delegation edge signs it.");
  console.error("  the graceful forward-rebind (predecessor pointer + a both-epoch read span, ending by");
  console.error("  non-renewal — NOT a unilateral fleet reset) awaits its coexistence-span rulings. See");
  console.error("  memory: project_nexus_identity_kahuli_onboarding — engine-watch EW-7.");
  return 2;
}

/**
 * `lares nexus kahuli grammar` — the FAST ratchet. This first version READS the current grammar epoch
 * (grammarCid) and reports it beside the operator's own collection; a read never builds. `--apply` is where the overturn composes the bake
 * (`vessel bake` re-derives the island at the freshly-packed plugin) and the mesh-push — both wired next.
 */
function kahuliGrammar(args: ParsedArgs): number {
  const grammarCid = readGenesisGrammarCid();
  const pluginsCid = readGenesisPluginsCid();
  const engineCid  = readGenesisEngineCid();

  if (args.flags["apply"]) {
    console.error("nexus kahuli grammar --apply — HELD (the overturn's payload is wired next).");
    console.error("  --apply composes the diff-gate → the genesis re-derive (`bakePlan`/`build-genesis-island`,");
    console.error("  the internal primitive — never a `vessel` door) → the mesh-push, which advances the LIVE");
    console.error("  Nexus's grammar epoch on the DreamNet. ONE hold remains: the push rides the same");
    console.error("  coexistence-span rulings as `kahuli engine`. Ledgered in the kāhuli onboarding memory.");
    return 2;
  }

  console.log("nexus kahuli grammar — the current genesis epoch (a read; nothing built):");
  const none = "(no island baked in this root yet)";
  console.log(`  grammar (grammarCid, fast ratchet): ${grammarCid ?? none}   the REQUIRED memetic-wikitext grammar`);
  console.log(`  engine  (engineCid, true-name):     ${engineCid ?? none}   the slow ratchet, binds membership`);
  console.log(`  plugins (pluginsCid, not a tier):   ${pluginsCid ?? none}   THIS operator's own collection`);
  console.log("");
  console.log("  to OVERTURN the grammar: pack the plugin, then compose the re-derive + push —");
  console.log("    pnpm --filter @lararium/tw5 build:plugin   (pack the memetic-wikitext grammar)");
  console.log("    lares nexus rite kahuli                    (diff-gate → re-derive → push; idempotent, skips-unchanged)");
  console.log("  the diff-gate (candidate grammarCid vs current) + --apply are wired next.");
  return 0;
}

/**
 * `lares nexus rite kahuli` — the composed OVERTURN, the deliberate build's home (so a read never builds).
 * Diff-gated + idempotent-by-intent: it runs whichever tier actually moved and skips an unchanged one. This
 * first version reports each tier's state and the holds; the bake+push payload lands as the zones settle.
 */
async function runKahuliRite(args: ParsedArgs): Promise<number> {
  const rest = { ...args, positional: args.positional.slice(2) };
  console.log("nexus rite kahuli — the composed overturn (diff-gated, idempotent, skips-unchanged):");
  console.log("  engine:  HELD — the slow ratchet's forward-rebind span awaits its rulings (see `kahuli engine`).");
  console.log("  grammar:");
  return await Promise.resolve(kahuliGrammar(rest));
}

async function cmdKahuli(args: ParsedArgs): Promise<number> {
  const tier = args.positional[1];
  switch (tier) {
    case "engine":  return kahuliEngineHeld();
    case "grammar": return await Promise.resolve(kahuliGrammar(args));
    default:
      return refuseUsage(args, "nexus kahuli", KAHULI_USAGE, tier ? `unknown tier "${tier}"` : undefined);
  }
}

/**
 * `lares nexus contract <operator-pubkey> [--sig <hex>]` writes a quorum-signed + contract-in admit onto the
 * members board; `lares nexus revoke <operator-pubkey>` writes a quorum-signed revoke. FAIL CLOSED: an unseated
 * charter, sub-quorum, or (for admit) a missing/invalid operator contract-in REFUSES and writes nothing.
 */
async function cmdContract(args: ParsedArgs, action: "admit" | "revoke"): Promise<number> {
  const nym = args.positional[1];
  if (!nym) {
    console.error(`usage: lares nexus ${action === "admit" ? "contract" : action} <operator-pubkey>${action === "admit" ? " [--sig <hex>]" : ""}`);
    return 2;
  }
  try {
    const contractSig = action === "admit" ? (args.options["sig"] ?? args.options["contract"]) : undefined;
    const r = await runNexusContract({ action, nym, ...(contractSig ? { contractSig } : {}), sealHome: larSealHome() });
    emit(args, {
      ok: true,
      data: {
        action: r.action, nym: r.nym, version: r.version, priorVersion: r.priorVersion,
        sealEpochCid: r.sealEpochCid, threshold: r.threshold, signers: r.signers,
        contractIn: r.contractIn, boardUrl: r.boardUrl, memberNow: r.memberNow,
      },
      human: () => {
        const verb = action === "admit" ? "ADMITTED" : "REVOKED";
        console.log(`nexus ${action} → ${verb} ${nym.slice(0, 16)}… (version ${r.version}${r.priorVersion !== null ? `, superseding ${r.priorVersion}` : ""})`);
        console.log(`  signed by:   ${r.signers.length} of ${r.threshold} required founding-kahu roots`);
        for (const s of r.signers) console.log(`    ${s.slice(0, 16)}…`);
        if (action === "admit") console.log(`  contract-in: ${r.contractIn === "self" ? "self-signed (held persona)" : "supplied token"}`);
        console.log(`  epoch:       ${r.sealEpochCid}`);
        console.log(`  board:       ${r.boardUrl}`);
        console.log(`  enforced:    ${r.memberNow ? "MEMBER (a cross-operator under this nym co-federates / blind-transits sealed planes)" : "NOT a member (a standing revoke or higher entry supersedes)"}`);
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
  const next = { ...doc, federationPosture: posture };
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

async function cmdSeal(args: ParsedArgs): Promise<number> {
  const sub = args.positional[1];
  try {
    switch (sub) {
      case "seat":    return await sealSeat(args);
      case "rotate":  return await sealRotate(args);
      case "commit":  return sealCommit(args);
      case "show":    return await sealShow(args);
      case "export":  return sealExport(args);
      case "import":  return sealImport(args);
      case "reserve": return await cmdCharterReserve(args);
      case "grow":    return await sealGrow(args);
      default:
        return refuseUsage(args, "nexus seal", SEAL_USAGE, sub ? `unknown sub-verb "${sub}"` : undefined);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = err instanceof UsageError ? "usage" : "error";
    emit(args, { ok: false, error: { code, message: msg }, human: () => console.error(`lares nexus seal ${sub ?? ""}: ${msg}`) });
    return exitFor(code);
  }
}

/**
 * `lares nexus kapae <nym> [--reason]` raises a quorum-signed ban; `lares nexus kapae --list` folds the
 * current Kapae'd set. FAIL CLOSED: a REFUSAL (unseated charter, sub-quorum, malformed nym) renders as a
 * clean error and writes nothing — main gates every hunk, so the writer never lands a sub-quorum entry.
 */
async function cmdKapae(args: ParsedArgs): Promise<number> {
  if (args.flags["list"]) return await kapaeList(args);
  const nym = args.positional[1];
  if (!nym) {
    console.error("usage: lares nexus kapae <nym> [--reason <text>]   |   lares nexus kapae --list");
    return 2;
  }
  return await kapaeRaise(args, "kapae", nym);
}

async function cmdUnKapae(args: ParsedArgs): Promise<number> {
  const nym = args.positional[1];
  if (!nym) {
    console.error("usage: lares nexus un_kapae <nym>");
    return 2;
  }
  return await kapaeRaise(args, "un_kapae", nym);
}

async function kapaeRaise(args: ParsedArgs, action: "kapae" | "un_kapae", nym: string): Promise<number> {
  const reason = args.options["reason"];
  try {
    const r = await runNexusKapae({ action, nym, ...(reason ? { reason } : {}), sealHome: larSealHome() });
    emit(args, {
      ok: true,
      data: {
        action: r.action, nym: r.nym, version: r.version, priorVersion: r.priorVersion,
        sealEpochCid: r.sealEpochCid, threshold: r.threshold, signers: r.signers,
        boardUrl: r.boardUrl, kapaedNow: r.kapaedNow,
      },
      human: () => {
        const verb = action === "kapae" ? "BANNED" : "LIFTED";
        console.log(`nexus ${action} → ${verb} ${nym.slice(0, 16)}… (version ${r.version}${r.priorVersion !== null ? `, superseding ${r.priorVersion}` : ""})`);
        console.log(`  signed by:  ${r.signers.length} of ${r.threshold} required founding-kahu roots`);
        for (const s of r.signers) console.log(`    ${s.slice(0, 16)}…`);
        console.log(`  epoch:      ${r.sealEpochCid}`);
        console.log(`  board:      ${r.boardUrl}`);
        console.log(`  enforced:   ${r.kapaedNow ? "Kapae'd (a presenter under this nym now draws Mu)" : "NOT Kapae'd (a standing lift or higher entry supersedes)"}`);
      },
    });
    return 0;
  } catch (err) {
    const msg  = err instanceof Error ? err.message : String(err);
    const code = err instanceof NexusKapaeError ? "refused" : "error";
    emit(args, { ok: false, error: { code, message: msg }, human: () => console.error(`lares nexus ${action}: ${msg}`) });
    return exitFor("error");
  }
}

async function kapaeList(args: ParsedArgs): Promise<number> {
  try {
    const r = await runNexusKapaeList({ sealHome: larSealHome() });
    emit(args, {
      ok: true,
      data: {
        sealEpochCid: r.sealEpochCid || null, threshold: r.threshold,
        seatedKeys: r.seatedKeys, kapaed: r.kapaed, entries: r.entries,
      },
      human: () => {
        console.log(`nexus kapae — the antigen board fold:`);
        console.log(`  epoch:      ${r.sealEpochCid || "(unseated — the antigen stays inert)"}`);
        console.log(`  quorum:     ${r.threshold}-of-N · seated keys: ${r.seatedKeys}`);
        console.log(`  Kapae'd (${r.kapaed.length}):`);
        for (const n of r.kapaed) console.log(`    ${n}`);
        if (r.kapaed.length === 0) console.log(`    (none stand banned)`);
        console.log(`  board entries (${r.entries.length}):`);
        for (const e of r.entries) console.log(`    ${e.action.padEnd(8)} v${e.version}  ${e.nym.slice(0, 16)}…  (${e.signers} sig)`);
      },
    });
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    emit(args, { ok: false, error: { code: "error", message: msg }, human: () => console.error(`lares nexus kapae --list: ${msg}`) });
    return exitFor("error");
  }
}

/** normalize a chair name / declared Handle for matching — trimmed, case-folded (a human types either). */
const norm = (s: string): string => s.trim().toLowerCase();

/** normalize a commitment/key hex — trimmed, lower-cased (the digest surface stays canonical lowercase hex). */
const normHex = (s: string | undefined): string => (s ?? "").trim().toLowerCase();

/**
 * Seat each kahu's verifying key from the vault by DECLARED HANDLE match. FAIL CLOSED: no match keeps the
 * doc's existing key (never invents, never unseats). A verifying key that is not in the vault can never be
 * seated — only vault reads flow in. Returns the updated kahu + the seated verifying keys (the CURRENT
 * key-set: at genesis the founding keys, at rotate the revealed next key-set the operator provisioned).
 */
/**
 * How a roster treats a chair NOBODY stands for.
 *
 *   · "keep" (seat)   — the chair stays, unseated. Before genesis a doc may already carry chairs the operator
 *                       wrote in a prior pass, and a persona that happens to sit unavailable this minute must
 *                       not lose its seat to a re-run.
 *   · "drop" (rotate) — the chair GOES. A rotation is how a Nexus changes who holds it, so the roster becomes
 *                       exactly what stands. This is the succession door, and it needs no admin verb: the
 *                       reveal must still match the head's pre-commitment, so an operator cannot quietly drop
 *                       a kahu — they must have PRE-COMMITTED the successor key-set an epoch earlier, in the
 *                       open, under the standing quorum.
 */
type UnstoodChairs = "keep" | "drop";

async function seatKahuFromVault(
  doc: NexusDoc, dataDir: string, unstood: UnstoodChairs = "keep",
): Promise<{ kahu: NexusCharterKahu[]; seatedKeys: string[] }> {
  // THE ROSTER FORMS FROM WHAT STOOD, never from a list this build shipped. A persona reaches a chair by
  // DECLARING the Handle it answers to and STANDING for a seat — two explicit acts on the operator's own
  // vessel — and the roster reads back exactly those. A scaffold carrying names would make the SOURCE decide
  // who the founding kahu are, leaving the operator to confirm a legitimacy call somebody else made.
  //
  // The chair name reads the DECLARED HANDLE, never the private pet-name. Matching the label would weld the
  // two registers: an operator could then seat only under the same string they call the compartment at home,
  // and every private label would become a public commitment by construction.
  const held = new Set(await listPersonaRoots(dataDir));
  // The declared Handle rides the FLEET (the persona plane), the seat claim stays LOCAL — so the seal reads a persona's
  // outward name as every device of the human knows it, and reads the chair claim as THIS node holds it.
  const localDeclarations = await makeNodePersonaDeclarationStore();
  const fleetDid = await fleetPeerDid();
  const declarations = fleetDid === null
    ? localDeclarations                                                  // no vessel key = no fleet to read
    : makeFleetDeclarationStore(localDeclarations, fleetDid);
  const standing = await personasStandingForSeat(declarations);

  // A doc already carrying chairs keeps them under "keep" — a re-seat before genesis fills keys rather than
  // re-writing who sits. Under "drop" (rotation) the roster becomes exactly what stands, which is how a kahu
  // steps down. Either way, a face standing under a name no chair carries ADDS one.
  const kahu: NexusCharterKahu[] = unstood === "drop" ? [] : doc.kahu.map((k) => ({ ...k }));
  const chairAt = new Map<string, number>(kahu.map((k, i) => [norm(k.displayName), i]));

  for (const [index, handle] of standing) {
    if (!held.has(index)) continue;             // a declaration without a held root seats nothing here
    const root = await generateOrLoadPersonaGroupRoot(dataDir, index);   // loads a held root; never mints here
    const at = chairAt.get(norm(handle));
    if (at === undefined) {
      chairAt.set(norm(handle), kahu.length);
      kahu.push({ displayName: handle, verifyingKey: root.verifyingKey });
    } else {
      kahu[at] = { displayName: kahu[at]!.displayName, verifyingKey: root.verifyingKey };
    }
  }
  const seatedKeys = kahu.map((k) => k.verifyingKey).filter((v): v is string => typeof v === "string" && v.length > 0);
  return { kahu, seatedKeys };
}

/**
 * The quorum rule this seat writes: the operator's `--threshold`, else the doc's own if it carries a live one,
 * else MAJORITY over the roster that stood. A threshold past the roster size would seat a Nexus no quorum can
 * ever satisfy, so it refuses rather than writing an unreachable rule.
 */
function resolveSeatThreshold(args: ParsedArgs, doc: NexusDoc, rosterSize: number): number {
  const raw = args.options["threshold"];
  if (raw !== undefined) {
    const t = Number(raw);
    if (!Number.isInteger(t) || t < 1) throw new UsageError(`--threshold expects a whole number ≥ 1, got "${raw}"`);
    if (t > rosterSize) {
      throw new UsageError(`--threshold ${t} sits past the ${rosterSize} chair${rosterSize === 1 ? "" : "s"} that stood — no quorum could ever reach it`);
    }
    return t;
  }
  if (Number.isInteger(doc.threshold) && doc.threshold >= 1 && doc.threshold <= rosterSize) return doc.threshold;
  return majorityThreshold(rosterSize);
}

async function sealSeat(args: ParsedArgs): Promise<number> {
  const sealHome = larSealHome();
  const dataDir = larDataDir();
  const doc = readNexusDoc(sealHome) ?? emptyFoundingCharterDoc();

  // FAIL CLOSED: a chain already advanced PAST genesis is never silently re-genesied — a re-seat would
  // strand every antigen entry rooted on a rotated head. The operator advances a live chain via `rotate`.
  if (doc.sealLineage && doc.sealLineage.length > 1) {
    throw new UsageError("the charter chain has already ROTATED past genesis — advance it with `lares nexus seal rotate`, never re-seat");
  }

  // A SEAT NEVER BUILDS ON A CHARTER THIS VESSEL DID NOT FOUND. A joining operator holds her partner's
  // charter in her own seal home — she cannot consent to one she has never seen — and seats her own
  // there too. Seating onto his MERGES the quorums: measured, six seated kahu at threshold two, so the
  // partner holds quorum over her Nexus using his own keys with no further act by her.
  const heldKeys = await Promise.all(
    (await listPersonaRoots(dataDir)).map(async (i) => (await generateOrLoadPersonaGroupRoot(dataDir, i)).verifyingKey));
  const foreign = foreignSeats(doc.kahu ?? [], heldKeys);
  if (!foreign.ok) throw new UsageError(foreign.why);

  const { kahu, seatedKeys } = await seatKahuFromVault(doc, dataDir);
  const nextKeyCommit = normHex(args.options["next-key-commit"]);
  if (kahu.length === 0) {
    throw new UsageError(
      "no persona stands for a chair — declare a Handle and stand for one first:\n" +
      "  lares persona new <index> --name '<label>' --handle '<Handle>' --seat",
    );
  }

  // NO FLOOR ON THE SEED. The keeper ladder starts at ONE — "founder (n=1, genesis) -> founder-multisig
  // (a 2nd keeper contracts in -> the group, not the original key, becomes root) -> k-of-n quorum"
  // (genesis-doc#governance). A floor of three refused phase 1 outright, so phase 2 could never be
  // reached and the ladder could not start.
  //
  // AND THE COUNT WAS NEVER THE THING. Every key a seat draws comes from THIS vessel's own vault, so
  // three chairs at genesis are three faces of one operator — one relationship, the operator with
  // themselves. A second OPERATOR is the first relation, and the Nexus is the relation. `nexusPhase`
  // reads that and the seal reports it; `rosterStanding` still names a fragile quorum without
  // refusing one.

  // THE THRESHOLD, and where it comes from. A doc that already carries one keeps it; otherwise the seat
  // derives MAJORITY over the roster that stood. Neither a constant in the source nor a silent guess: majority
  // refuses a single hand without handing any one kahu a veto, and `--threshold` takes the operator's own call
  // for a realm that wants a different rule.
  const threshold = resolveSeatThreshold(args, doc, kahu.length);

  // Establish the genesis epoch only once a quorum is seatable — below threshold, no epoch roots (inert).
  let sealLineage: SealEpoch[] | undefined;
  let sealEpochCid: string | null = null;
  if (seatedKeys.length >= threshold) {
    const genesis = genesisCharterEpoch(seatedKeys, threshold, nextKeyCommit);
    sealLineage = [genesis];
    sealEpochCid = genesis.epochCid;
  }

  const next: NexusDoc = sealLineage
    ? { kind: doc.kind, threshold, sealEpochCid, sealLineage, kahu }
    : { kind: doc.kind, threshold, sealEpochCid, kahu };
  // A seat moves TWO joints — the roster it seats and the genesis epoch it establishes — so it writes both
  // narrowly rather than re-emitting the practice dials it never touched.
  writeNexusKahu(sealHome, { threshold: next.threshold, kahu: next.kahu }, next);
  const path = writeNexusSeal(sealHome,
    sealLineage ? { kind: next.kind, sealEpochCid, sealLineage } : { kind: next.kind, sealEpochCid }, next);
  const quorum = foundingQuorumSeated(next);
  const armed = Boolean(sealLineage) && nextKeyCommit.length > 0;

  emit(args, {
    ok: true,
    data: {
      path, threshold: next.threshold, sealEpochCid, quorumSeated: quorum,
      rotationArmed: armed, nextKeyCommit: nextKeyCommit || null,
      kahu: kahu.map((k) => ({ displayName: k.displayName, seated: Boolean(k.verifyingKey), verifyingKey: k.verifyingKey })),
    },
    human: () => {
      // The headline names what STOOD. It once read "(genesis epoch)" unconditionally, three lines
      // above `epoch0: (unestablished)` — a confident claim over an honest correction, which is the
      // order an operator skims in reverse.
      console.log(sealLineage
        ? `nexus seal seated — GENESIS EPOCH established → ${path}`
        : `nexus seal seated — roster written, NO epoch (quorum short) → ${path}`);
      for (const k of kahu) {
        console.log(`  ${k.verifyingKey ? "seated  " : "UNSEATED"} ${k.displayName}${k.verifyingKey ? `  ${k.verifyingKey.slice(0, 16)}…` : ""}`);
      }
      console.log(`  threshold:  ${next.threshold} of ${kahu.length}`);
      // WHAT IT SURVIVES, AT THE MOMENT IT IS WRITTEN. A seat NAMES a fragile quorum and refuses none —
      // the keeper ladder starts at one, so a floor here would forbid its own first step. An operator
      // who has lost a kahu must be able to re-seat, and that is the case most likely to land fragile,
      // so the reading rides at the moment of writing as well as at `show`.
      const seatStanding = rosterStanding({ seated: seatedKeys.length, threshold: next.threshold });
      if (seatStanding.fragile) console.log(`  ⚠ survives:  ${seatStanding.reading}`);
      console.log(`  epoch0:     ${sealEpochCid ?? "(unestablished — seat a quorum first)"}`);
      if (quorum) {
        console.log(`  quorum STANDS — the antigen now reads a live roster rooted on the genesis epoch.`);
        console.log(`  rotation:   ${armed ? "ARMED (next key-set pre-committed)" : "UNARMED — supply --next-key-commit <digest> to arm pre-rotation"}`);
      } else {
        const missing = kahu.filter((k) => !k.verifyingKey).map((k) => `"${k.displayName}"`);
        console.log(`  quorum SHORT (fail-closed; the antigen stays inert). Unseated: ${missing.join(", ") || "(none)"}`);
        console.log(`  seat them: lares persona new <index> --name '<label>' --handle '<Handle>' --seat  →  lares nexus seal seat`);
        console.log(`  (a chair joins on the DECLARED Handle, never on the private label)`);
      }
    },
  });
  return 0;
}

// ── THE GROWTH RITE — the crossing record ceremony (`seal grow open|bind|sign|witness|seal`) ──────
//
// The rite SPANS the rotate: `open` captures the standing hands before anything moves; the operator
// pre-commits the successor and rotates (the succession door above); `bind` fixes the record's far
// side to the new head, closing the byte-image; hands SIGN (a key seated in both sets counts in both
// quorums); a WITNESS — a key seated in NEITHER — attests with a note; `seal` verifies the crossing
// whole (`verifyReserveTransition`) and keeps the record beside the charter. The record is CARRIAGE:
// it travels with the charter's own artifacts, self-announced by the charter — never a registry.

const TRANSITION_PENDING_FILE = "transition-pending.json";
const TRANSITIONS_FILE        = "transitions.json";
const GROWTH_RITE_URI         = "lar:///ha.ka.ba/lararium/mesh/founding-runbook#the-growth-rite";

interface PendingTransition {
  fromEpochCid:  string;
  oldKeys:       string[];
  oldThreshold:  number;
  toEpochCid?:   string;
  newKeys?:      string[];
  newThreshold?: number;
  rite:          string;
  oldSigs:       QuorumSignature[];
  newSigs:       QuorumSignature[];
  witnesses:     TransitionWitness[];
}

function pendingPath(): string { return join(larSealHome(), TRANSITION_PENDING_FILE); }
function transitionsPath(): string { return join(larSealHome(), TRANSITIONS_FILE); }

function readPending(): PendingTransition | null {
  if (!existsSync(pendingPath())) return null;
  try { return JSON.parse(readFileSync(pendingPath(), "utf8")) as PendingTransition; } catch { return null; }
}
function writePending(p: PendingTransition): void {
  mkdirSync(larSealHome(), { recursive: true });
  writeFileSync(pendingPath(), JSON.stringify(p, null, 2));
}
function boundCoreOf(p: PendingTransition): ReserveTransitionCore | null {
  if (!p.toEpochCid || !p.newKeys || p.newThreshold === undefined) return null;
  return {
    fromEpochCid:  p.fromEpochCid,
    toEpochCid:    p.toEpochCid,
    oldKeySetHash: sealKeySetHash(p.oldKeys, p.oldThreshold),
    newKeySetHash: sealKeySetHash(p.newKeys, p.newThreshold),
    rite:          p.rite,
  };
}
function seatedKeysOf(doc: { kahu: readonly { verifyingKey: string | null }[] }): string[] {
  return doc.kahu.map((k) => k.verifyingKey).filter((k): k is string => k !== null);
}

async function sealGrow(args: ParsedArgs): Promise<number> {
  const step = args.positional[2];
  const sealHome = larSealHome();
  const doc = readNexusDoc(sealHome);
  const head = sealLineageHead(doc);

  switch (step) {
    case "open": {
      if (!doc || !head) throw new UsageError("no charter chain stands — seat one before a crossing can open");
      if (readPending()) throw new UsageError("a crossing already stands open — seal it or remove transition-pending.json deliberately");
      writePending({
        fromEpochCid: head.epochCid,
        oldKeys: seatedKeysOf(doc), oldThreshold: doc.threshold,
        rite: GROWTH_RITE_URI, oldSigs: [], newSigs: [], witnesses: [],
      });
      emit(args, { ok: true, data: { open: { fromEpochCid: head.epochCid, oldHands: seatedKeysOf(doc).length } },
        human: () => console.log(`crossing OPEN from epoch ${head.epoch} — now pre-commit the successor, rotate, then \`grow bind\`.`) });
      return 0;
    }
    case "bind": {
      const p = readPending();
      if (!p) throw new UsageError("no crossing stands open — `grow open` before the rotate");
      if (!doc || !head) throw new UsageError("no charter chain stands");
      if (head.epochCid === p.fromEpochCid) throw new UsageError("the chain has not moved — rotate the succession in before binding the far side");
      if (p.toEpochCid) throw new UsageError("the crossing is already bound — sign, witness, and seal it");
      writePending({ ...p, toEpochCid: head.epochCid, newKeys: seatedKeysOf(doc), newThreshold: doc.threshold });
      emit(args, { ok: true, data: { bound: { toEpochCid: head.epochCid } },
        human: () => console.log(`crossing BOUND to epoch ${head.epoch} — the byte-image is closed; gather signatures and a witness.`) });
      return 0;
    }
    case "sign": {
      const p = readPending();
      const core = p && boundCoreOf(p);
      if (!p || !core) throw new UsageError("no bound crossing stands — `grow open`, rotate, `grow bind` first");
      const idx = Number(args.options["index"] ?? "0");
      const hand = await transitionSignerFromSeed(await loadPersonaGroupRootSeed(larDataDir(), idx));
      const inOld = p.oldKeys.some((k) => k.toLowerCase() === hand.signer.toLowerCase());
      const inNew = (p.newKeys ?? []).some((k) => k.toLowerCase() === hand.signer.toLowerCase());
      if (!inOld && !inNew) throw new UsageError("this hand sits in neither set — it may `grow witness`, never sign");
      const sig: QuorumSignature = { signer: hand.signer, sig: await hand.sign(reserveTransitionBytes(core)) };
      const dedupe = (list: QuorumSignature[]): QuorumSignature[] =>
        [...list.filter((x) => x.signer.toLowerCase() !== sig.signer.toLowerCase()), sig];
      writePending({ ...p, oldSigs: inOld ? dedupe(p.oldSigs) : p.oldSigs, newSigs: inNew ? dedupe(p.newSigs) : p.newSigs });
      emit(args, { ok: true, data: { signed: { as: hand.signer, old: inOld, new: inNew } },
        human: () => console.log(`signed${inOld ? " [handoff]" : ""}${inNew ? " [receipt]" : ""} as ${hand.signer.slice(0, 16)}…`) });
      return 0;
    }
    case "witness": {
      const p = readPending();
      const core = p && boundCoreOf(p);
      if (!p || !core) throw new UsageError("no bound crossing stands — a witness attests a closed byte-image");
      const idx = Number(args.options["index"] ?? "0");
      const note = args.options["note"];
      if (!note) throw new UsageError("a witness mark carries a note — what stood observed (--note)");
      const hand = await transitionSignerFromSeed(await loadPersonaGroupRootSeed(larDataDir(), idx));
      const holders = new Set([...p.oldKeys, ...(p.newKeys ?? [])].map((k) => k.toLowerCase()));
      if (holders.has(hand.signer.toLowerCase())) throw new UsageError("a keyholder attests as a party — `grow sign`, never witness");
      const mark: TransitionWitness = { witness: hand.signer, note, sig: await hand.sign(witnessSignBytes(core, note)) };
      writePending({ ...p, witnesses: [...p.witnesses.filter((w) => w.witness.toLowerCase() !== mark.witness.toLowerCase()), mark] });
      emit(args, { ok: true, data: { witnessed: { by: hand.signer } }, human: () => console.log(`witnessed by ${hand.signer.slice(0, 16)}… — "${note}"`) });
      return 0;
    }
    case "seal": {
      const p = readPending();
      const core = p && boundCoreOf(p);
      if (!p || !core) throw new UsageError("no bound crossing stands — nothing to seal");
      const rec: ReserveTransition = {
        ...core, transitionCid: reserveTransitionCidOf(core),
        oldSigs: p.oldSigs, newSigs: p.newSigs, witnesses: p.witnesses,
      };
      const v = await verifyReserveTransition(rec, {
        oldKeys: p.oldKeys, oldThreshold: p.oldThreshold,
        newKeys: p.newKeys!, newThreshold: p.newThreshold!,
      });
      if (!v.ok) {
        emit(args, { ok: false, error: { code: "error", message: `crossing REFUSED (fail-closed): ${v.reason}` },
          human: () => console.error(`seal grow REFUSED (fail-closed): ${v.reason} — the pending crossing stands; nothing written.`) });
        return exitFor("error");
      }
      const kept: ReserveTransition[] = existsSync(transitionsPath())
        ? (JSON.parse(readFileSync(transitionsPath(), "utf8")) as ReserveTransition[])
        : [];
      writeFileSync(transitionsPath(), JSON.stringify([...kept, rec], null, 2));
      rmSync(pendingPath(), { force: true });
      emit(args, { ok: true, data: { sealed: { transitionCid: rec.transitionCid, independentWitnesses: v.independentWitnesses } },
        human: () => console.log(`crossing SEALED — ${rec.transitionCid.slice(0, 20)}… · independent witnesses: ${v.independentWitnesses}. The record rides with the charter.`) });
      return 0;
    }
    default:
      console.error("lares nexus seal grow <open | bind | sign --index N | witness --index N --note '…' | seal>");
      return 2;
  }
}

async function sealRotate(args: ParsedArgs): Promise<number> {
  const sealHome = larSealHome();
  const dataDir = larDataDir();
  const doc = readNexusDoc(sealHome);
  const head = sealLineageHead(doc);
  if (!doc || !head) {
    throw new UsageError("no genesis charter chain to rotate — establish one with `lares nexus seal seat` first");
  }

  // REVEAL: the operator has provisioned the pre-committed next key-set into the vault; seating from the
  // vault reads it back. The revealed key-set becomes the new head's authorized quorum.
  // THE ROSTER BECOMES EXACTLY WHAT STANDS — the succession door. A kahu steps down by no longer standing;
  // a new one takes a chair by declaring a Handle and standing. Neither needs an admin verb, because the
  // reveal below must still match the head's PRE-COMMITMENT: a roster change only lands if the operator
  // pre-committed the successor key-set an epoch earlier, under the quorum that stood then.
  const { kahu, seatedKeys } = await seatKahuFromVault(doc, dataDir, "drop");
  if (kahu.length === 0) {
    throw new UsageError(
      "no persona stands for a chair — a rotation seats the roster that STANDS, and none does. " +
      "Stand them first: lares persona new <index> --name '<label>' --handle '<Handle>' --seat",
    );
  }
  const threshold = resolveSeatThreshold(args, doc, kahu.length);
  if (seatedKeys.length < threshold) {
    throw new UsageError(`the revealed key-set is short of the ${threshold}-of-${kahu.length} quorum (seated ${seatedKeys.length}) — provision the next personas before rotating`);
  }
  const nextKeyCommit = normHex(args.options["next-key-commit"]);

  // FAIL CLOSED: a revealed key-set whose digest does not match the head's pre-commitment REFUSES, and
  // writes nothing. A stolen current key-set cannot forge a successor it never pre-committed.
  const result = rotateSealEpoch(head, seatedKeys, threshold, nextKeyCommit);
  if (!result.ok) {
    // A CHANGED ROSTER lands here too, and reads as the same refusal for the same reason: the reveal must
    // match what the prior epoch pre-committed, so adding or dropping a kahu requires having pre-committed
    // that exact successor set. Naming the possibility turns an opaque digest mismatch into a next step.
    const rosterMoved = kahu.length !== doc.kahu.length || threshold !== doc.threshold;
    emit(args, {
      ok: false,
      error: { code: "error", message: `rotation REFUSED (fail-closed): ${result.reason}` },
      human: () => {
        console.error(`nexus seal rotate REFUSED (fail-closed): ${result.reason}`);
        console.error(`  the chain stays at epoch ${head.epoch}; nothing written.`);
        if (rosterMoved) {
          console.error(`  the roster MOVED (${doc.kahu.length} chairs @ ${doc.threshold} → ${kahu.length} @ ${threshold}).`);
          console.error(`  a succession lands only if THIS key-set was pre-committed an epoch ago:`);
          console.error(`    lares nexus seal commit --keys <the new set> --threshold <k>   → arm it on the PRIOR rotation`);
        }
      },
    });
    return exitFor("error");
  }

  const sealLineage: SealEpoch[] = [...(doc.sealLineage ?? []), result.epoch];
  const sealEpochCid = result.epoch.epochCid;
  const next: NexusDoc = { kind: doc.kind, threshold, sealEpochCid, sealLineage, kahu };
  // A rotation reaches the SEAL joint always, and the KAHU joint only when the roster actually moved — so an
  // ordinary re-key never rewrites a roster it did not touch.
  const path = writeNexusSeal(sealHome, { kind: next.kind, sealEpochCid, sealLineage }, next);
  if (kahu.length !== doc.kahu.length || threshold !== doc.threshold) {
    writeNexusKahu(sealHome, { threshold, kahu }, next);
  }
  const armed = nextKeyCommit.length > 0;

  emit(args, {
    ok: true,
    data: {
      path, epoch: result.epoch.epoch, sealEpochCid, prevEpochCid: result.epoch.prevEpochCid,
      chainDepth: sealLineage.length, rotationArmed: armed, nextKeyCommit: nextKeyCommit || null,
      quorumSeated: foundingQuorumSeated(next),
    },
    human: () => {
      console.log(`nexus seal ROTATED → epoch ${result.epoch.epoch} (chain depth ${sealLineage.length}) → ${path}`);
      console.log(`  reveal VERIFIED against the prior epoch's pre-commitment.`);
      console.log(`  head epoch: ${sealEpochCid}`);
      console.log(`  prev link:  ${result.epoch.prevEpochCid}`);
      console.log(`  rotation:   ${armed ? "ARMED (next key-set pre-committed)" : "UNARMED — the next rotate refuses until you supply --next-key-commit"}`);
    },
  });
  return 0;
}

function sealCommit(args: ParsedArgs): number {
  const raw = args.options["keys"];
  if (!raw) throw new UsageError("provide the next epoch's verifying keys: --keys <k1,k2,...> [--threshold <k>]");
  const keys = raw.split(",").map((k) => k.trim().toLowerCase()).filter((k) => k.length > 0);
  if (keys.length === 0) throw new UsageError("no keys supplied to --keys");
  const thRaw = args.options["threshold"];
  const threshold = thRaw !== undefined ? Number.parseInt(thRaw, 10) : keys.length;
  if (!Number.isInteger(threshold) || threshold < 1) throw new UsageError(`--threshold must be a positive integer (got "${thRaw}")`);
  const digest = sealKeySetHash(keys, threshold);

  emit(args, {
    ok: true,
    data: { digest, keys: keys.length, threshold },
    human: () => {
      console.log(`key-set commitment digest (${keys.length} keys, ${threshold}-of-${keys.length}):`);
      console.log(`  ${digest}`);
      console.log(`  supply it as:  lares nexus seal {seat|rotate} --next-key-commit ${digest}`);
      console.log(`  hold the matching SIGNING seeds in offline custody until the rotate ceremony reveals them.`);
    },
  });
  return 0;
}


/**
 * `lares nexus seal export` — the public charter material, for a partner who must consent to it.
 *
 * An operator cannot consent to a charter she has never seen, so this is what travels FIRST. Seated
 * keys, threshold and epoch lineage are public by construction — the material a joiner verifies a
 * quorum signature against — so the channel needs INTEGRITY and no secrecy. Nothing here is a key
 * this vessel holds; the charter grants its reader no quorum, which the crossing witness asserts.
 */
function sealExport(args: ParsedArgs): number {
  const sealHome = larSealHome();
  const path = nexusCharterDocPath(sealHome);
  const raw = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (raw === null) {
    emit(args, { ok: false, error: { code: "not-found", message: `no charter at ${path} — seat one first: \`lares nexus rite cabal\`` },
                 human: () => console.error(`lares nexus seal export: no charter at ${path} — seat one first: \`lares nexus rite cabal\``) });
    return 4;
  }
  emit(args, {
    ok: true, data: { path, charter: raw },
    human: () => {
      console.log(raw);
      console.error(`\n  ${path}`);
      console.error("  public material — hand it over any channel that preserves INTEGRITY. It grants its");
      console.error("  reader no quorum; it lets them verify yours and consent to carriage.");
    },
  });
  return 0;
}

/**
 * `lares nexus seal import <file>` — place a partner's charter, and refuse to destroy your own.
 *
 * `accept-carriage` signs a contract-in against whatever charter stands in the seal home it reads, so
 * dropping a partner's roster over your own does not add a file — it REPLACES a founding, and every
 * contract-in signed afterwards binds to the wrong epoch. The crossing witness carries this file with
 * `cp` onto a vessel that had no charter to lose, which is why nothing has met the destructive case.
 */
function sealImport(args: ParsedArgs): number {
  const from = args.positional[2] ?? "";
  if (!from) {
    console.error("usage: lares nexus seal import <path-to-founding-roster.mem>");
    return 2;
  }
  let incomingRaw: string;
  try { incomingRaw = readFileSync(from, "utf8"); }
  catch { console.error(`lares nexus seal import: cannot read ${from}`); return 4; }

  const sealHome = larSealHome();
  const dest = nexusCharterDocPath(sealHome);
  // READ THE INCOMING THROUGH THE CANONICAL PARSER, never a second one. A hand-rolled read of the
  // seal fence would drift from `readNexusDoc` exactly when the doc shape moves, and this decision
  // gates a destructive write. A throwaway home costs one file and keeps one parser.
  const probe = mkdtempSync(join(tmpdir(), "lares-seal-probe-"));
  let incoming = "";
  try {
    writeFileSync(join(probe, nexusCharterDocRelPath()), incomingRaw, "utf8");
    incoming = rosterFromNexusDoc(readNexusDoc(probe)).sealEpochCid;
  } finally { rmSync(probe, { recursive: true, force: true }); }
  const standing = existsSync(dest) ? rosterFromNexusDoc(readNexusDoc(sealHome)).sealEpochCid || null : null;

  const v = sealImportVerdict({ incoming, standing });
  if (!v.ok) {
    emit(args, { ok: false, error: { code: "refused", message: v.why },
                 data: { from, dest }, human: () => console.error(`lares nexus seal import: ${v.why}`) });
    return 3;
  }
  mkdirSync(sealHome, { recursive: true });
  writeFileSync(dest, incomingRaw, "utf8");
  emit(args, { ok: true, data: { from, dest, epoch: incoming },
               human: () => { console.log(`imported → ${dest}`); console.log(`  ${v.why}`); } });
  return 0;
}

async function sealShow(args: ParsedArgs): Promise<number> {
  const sealHome = larSealHome();
  const doc = readNexusDoc(sealHome);
  const roster = rosterFromNexusDoc(doc);
  const quorum = foundingQuorumSeated(doc);
  const head = sealLineageHead(doc);
  const chainDepth = doc?.sealLineage?.length ?? 0;
  // THE ONLY INPUT THAT MOVES THE PHASE. A contracted operator is a key this vessel has never held,
  // so it names a hand outside this vault — which is what a seated chair can never do. Unreachable
  // members read as none, which keeps the phase honest rather than optimistic.
  let contracted = 0;
  try { contracted = (await runNexusMembersList({ sealHome })).members.length; } catch { contracted = 0; }
  // This vessel's own consent, bound to the epoch that stands — a stale one grants nothing.
  const joined = await hasContractedInto(sealHome);

  emit(args, {
    ok: true,
    data: {
      path: nexusCharterDocPath(sealHome),
      present: doc !== null,
      threshold: roster.threshold,
      sealEpochCid: roster.sealEpochCid || null,
      chainDepth,
      rotationArmed: head ? head.nextKeyCommit.length > 0 : false,
      seatedKeys: roster.keys.length,
      quorumSeated: quorum,
      // WHAT THE QUORUM SURVIVES, beside what it is. A threshold met by every seated chair passes
      // every gate and locks the Nexus the day one seat goes dark — including for the rotation that
      // would repair it. The reading rides the payload so a harness can assert it, and the human
      // path prints it where the numbers already are.
      standing: rosterStanding({ seated: roster.keys.length, threshold: roster.threshold }),
      // WHERE THIS VESSEL STANDS ON THE KEEPER LADDER, read from RELATIONS rather than from the seat
      // count — every seated key came from this vault, so no number of them names a second hand.
      // BOTH HALVES OF THE RELATION. `contracted` counts operators THIS vessel admitted; the consent
      // counts the one it gave. A vessel that joined a Nexus admits nobody and would otherwise read a
      // seed forever, unable to see the relation it is standing in.
      phase: nexusPhase({ seatedKeys: roster.keys.length, contractedOperators: contracted, contractedInto: joined }),
      kahu: (doc?.kahu ?? []).map((k) => ({ displayName: k.displayName, seated: Boolean(k.verifyingKey) })),
    },
    human: () => {
      if (!doc) {
        console.log(`no nexus doc — run \`lares nexus seal seat\` (the antigen stays inert until a quorum stands).`);
        console.log(`  expected at: ${nexusCharterDocPath(sealHome)}`);
        return;
      }
      console.log(`nexus seal (${nexusCharterDocPath(sealHome)}):`);
      for (const k of doc.kahu) console.log(`  ${k.verifyingKey ? "seated  " : "UNSEATED"} ${k.displayName}`);
      console.log(`  threshold:  ${roster.threshold} · seated keys: ${roster.keys.length}`);
      console.log(`  chain:      ${chainDepth > 0 ? `${chainDepth} epoch(s), head at seq ${chainDepth - 1}` : "(none — no epoch established)"}`);
      console.log(`  head epoch: ${roster.sealEpochCid || "(unestablished)"}`);
      console.log(`  rotation:   ${head && head.nextKeyCommit.length > 0 ? "ARMED" : "UNARMED"}`);
      console.log(`  quorum:     ${quorum ? "STANDS (roster live)" : "SHORT (fail-closed — antigen inert)"}`);
      // THE PHASE COMES BEFORE THE FRAGILITY. A seed has no quorum to be fragile about, and a reader
      // who meets "quorum: STANDS" without it mistakes three faces of one operator for three hands.
      const phase = nexusPhase({ seatedKeys: roster.keys.length, contractedOperators: contracted, contractedInto: joined });
      console.log(`  ${phase.isNexus ? "phase:     " : "⚠ phase:   "} ${phase.reading}`);
      const standing = rosterStanding({ seated: roster.keys.length, threshold: roster.threshold });
      // A FRAGILE ROSTER EARNS THE LINE; a sound one earns silence. The cure is only available before
      // the loss, so it prints while it is still worth something.
      if (standing.fragile) {
        console.log(`  ⚠ survives:  ${standing.reading}`);
      } else if (standing.seated) {
        console.log(`  survives:   ${standing.tolerance} seat(s) going dark`);
      }
      console.log(`  posture:    ${federationPostureFromDoc(doc)} (cross-Nexus federation — default private)`);
      const reserve = readCharterReserveState();
      console.log(`  reserve:    ${reserve ? `commit ${reserve.nextKeyCommit.slice(0, 16)}… (epoch ${reserve.reserveEpoch}, guardians ${reserve.guardianA ?? "unassigned"}/${reserve.guardianB ?? "unassigned"})` : "(none — run `lares nexus seal reserve` to custody the pre-rotation)"}`);
    },
  });
  return 0;
}

// ── The charter reserve keel — custody the pre-rotation's NEXT key-set ────────────────────────────────
//
// The reserve seed is forged IN MEMORY, derives the three next-epoch kahu keys HARDENED (SLIP-0010, off a
// SEPARATE seed — never the live signing seed), and Shamir-splits 2-of-3 into three cards. The vessel keeps
// only Share 1 ("mine"), SEALED; the seed NEVER lands on disk (zeroized the instant the split returns).

async function cmdCharterReserve(args: ParsedArgs): Promise<number> {
  const op = args.positional[2];
  switch (op) {
    case undefined:
    case "provision": return await sealReserveProvision(args, "provision");
    case "refresh":   return await sealReserveProvision(args, "refresh");
    case "show":      return await sealReserveShow(args);
    default:
      console.error(`lares nexus seal reserve: unknown op "${op}" (expected refresh | show | <none>)`);
      return 2;
  }
}

/** Emit the three cards + the seat instruction — shared by provision and refresh. */
function reserveCardsEmission(
  args: ParsedArgs,
  data: Record<string, unknown>,
  cards: readonly ReserveCard[],
  nextKeyCommit: string,
  humanHead: () => void,
): void {
  emit(args, {
    ok: true,
    data,
    human: () => {
      humanHead();
      console.log(``);
      console.log(`  Place these THREE cards by hand (web3-pure — no cloud/email/API coupling):`);
      for (const c of cards) {
        console.log(`    ── ${c.label} ──`);
        console.log(`       share code:   ${c.shareCode}`);
        console.log(`       confirm:      ${c.confirmPhrase}   (read out-of-band to verify the card)`);
      }
      console.log(``);
      console.log(`  "mine" seals on THIS vessel; a printed/emailed copy of "mine" carries the SAME share —`);
      console.log(`  an operator-full-compromise reveals ONE share → nothing. The two guardian cards recover`);
      console.log(`  WITHOUT you; any TWO of the three rebuild the reserve.`);
      console.log(``);
      console.log(`  Arm the pre-rotation:  lares nexus seal seat --next-key-commit ${nextKeyCommit}`);
    },
  });
}

async function sealReserveProvision(args: ParsedArgs, mode: "provision" | "refresh"): Promise<number> {
  const guardianA = args.options["guardian-a"] ?? null;
  const guardianB = args.options["guardian-b"] ?? null;

  // The reserve epoch advances on refresh; founding provision seats epoch 1. A refresh with no prior state
  // still seats epoch 1 (nothing to advance) — surfaced in the human head below.
  const prior = readCharterReserveState();
  const reserveEpoch = mode === "refresh" ? (prior?.reserveEpoch ?? 0) + 1 : 1;

  // Read the charter chain to name the reconciliation route (below) — this command NEVER mutates the charter.
  const doc = readNexusDoc(larSealHome());
  const chainDepth = doc?.sealLineage?.length ?? 0;

  const rng = defaultCryptoProvider;
  const reserveSeed = generateReserveSeed(rng);
  try {
    const { verifyingKeys } = await deriveReserveKeySet(reserveSeed, reserveEpoch);
    const nextKeyCommit = reserveNextKeyCommit(verifyingKeys);      // sealKeySetHash(3 keys, threshold 2)
    const { cards, mineShare } = splitReserveSeed(reserveSeed, guardianA, guardianB, reserveEpoch, rng);

    // Seal ONLY the "mine" share; record the PUBLIC state (commit + guardians). The seed reaches neither.
    sealReserveMineShare(mineShare);
    writeCharterReserveState({
      reserveEpoch, nextKeyCommit, threshold: RESERVE_THRESHOLD, kahuCount: RESERVE_KAHU_COUNT,
      guardianA, guardianB, mineShareSealed: true, issuedAt: new Date().toISOString(),
    });

    // The refresh reconciliation FORK — named, never auto-resolved (the seated pre-commitment is frozen
    // into its epochCid; a reserve refresh cannot retro-fit a sealed head).
    const reconcile = mode === "provision"
      ? null
      : chainDepth <= 1
        ? "re-commit-before-seal"   // genesis-only (unrotated): re-run `seat --next-key-commit` to re-mint genesis
        : "full-rotation";          // rotated: the CURRENT reserve keys reveal at the pending rotate; this commit arms the FOLLOWING epoch

    reserveCardsEmission(
      args,
      {
        mode, reserveEpoch, nextKeyCommit, threshold: RESERVE_THRESHOLD, kahuCount: RESERVE_KAHU_COUNT,
        guardianA, guardianB, chainDepth, reconcile,
        cards: cards.map((c) => ({ slot: c.slot, label: c.label, custodian: c.custodian, shareCode: c.shareCode, confirmPhrase: c.confirmPhrase })),
      },
      cards,
      nextKeyCommit,
      () => {
        if (mode === "provision") {
          console.log(`nexus seal reserve — forged the pre-rotation's next key-set (reserve epoch ${reserveEpoch}).`);
          console.log(`  the reserve seed lived IN MEMORY only; the vessel keeps one SEALED share, never the seed.`);
        } else {
          console.log(`nexus seal reserve REFRESH — re-seeded + re-derived (reserve epoch ${reserveEpoch}).`);
          console.log(`  new --next-key-commit: ${nextKeyCommit}`);
          if (reconcile === "re-commit-before-seal") {
            console.log(`  RECONCILE (chain depth ${chainDepth}, genesis-only/unrotated): re-run`);
            console.log(`    lares nexus seal seat --next-key-commit ${nextKeyCommit}`);
            console.log(`  — a genesis re-mint is permitted BEFORE the first rotate (the pre-committed keys never signed yet).`);
          } else {
            console.log(`  RECONCILE (chain depth ${chainDepth}, ALREADY rotated): the CURRENT reserve keys must reveal`);
            console.log(`  at the pending \`rotate\` FIRST (a sealed head's pre-commitment is frozen into its epochCid).`);
            console.log(`  This new commit arms the FOLLOWING epoch — supply it at the NEXT:`);
            console.log(`    lares nexus seal rotate --next-key-commit ${nextKeyCommit}`);
          }
        }
      },
    );
    return 0;
  } finally {
    reserveSeed.fill(0);   // the reserve seed never lands on disk, and never lingers past the split
  }
}

async function sealReserveShow(args: ParsedArgs): Promise<number> {
  const state = readCharterReserveState();
  emit(args, {
    ok: true,
    data: state
      ? {
          present: true, reserveEpoch: state.reserveEpoch, nextKeyCommit: state.nextKeyCommit,
          threshold: state.threshold, kahuCount: state.kahuCount,
          guardianA: state.guardianA, guardianB: state.guardianB,
          mineShareSealed: state.mineShareSealed, issuedAt: state.issuedAt,
        }
      : { present: false },
    human: () => {
      if (!state) {
        console.log(`no charter reserve — run \`lares nexus seal reserve\` to custody the pre-rotation's next key-set.`);
        return;
      }
      console.log(`nexus seal reserve:`);
      console.log(`  commit:     ${state.nextKeyCommit}   (${state.threshold}-of-${state.kahuCount})`);
      console.log(`  epoch:      ${state.reserveEpoch}   (issued ${state.issuedAt})`);
      console.log(`  guardians:  A=${state.guardianA ?? "unassigned"}  B=${state.guardianB ?? "unassigned"}`);
      console.log(`  mine share: ${state.mineShareSealed ? "SEALED on this vessel" : "NOT sealed"}`);
      console.log(`  (the seed and the full share-set are NEVER shown — only the public commit + labels)`);
    },
  });
  return 0;
}
