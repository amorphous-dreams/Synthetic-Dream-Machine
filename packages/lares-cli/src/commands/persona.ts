/**
 * `lares persona {new <index> --name <petname> [--handle <Handle>] [--seat [--chair <label>]] [--split-root] | wear <index> | list}` — the
 * operator's door to the
 * PLURALITY-PONO identity multitude. A vessel HOLDS a set of PersonaGroup-roots — one per persona
 * the operator wears (persona-vault) — and WEARS one at a time. This command DRIVES the existing node core;
 * it never re-implements minting, the custody wall, or the pet-name store.
 *
 *   new <index> --name <petname>       mint/load the persona-root at <index> (fail-closed via
 *                                      assertHandleIndex) + set its PRIVATE pet-name
 *              [--handle <Handle>]     declare the public Handle this persona answers to (an intent, not a
 *                                      publish — only an announce binds a persona to a glamour)
 *              [--seat [--chair <label>]] stand this persona for a Kahu chair on THIS node
 *              [--split-root]          arm its 2-of-3 recovery split
 *   wear <index>                       switch the active persona (one-face-to-mesh; reboot-to-switch)
 *   list                               the private multitude-view — held indices, active marker, labels, Handles
 *
 * The pet-name stays PRIVATE (persona-petname: rests sealed, fleet-syncs among the human's own vessels over a
 * persona plane whose rest seals, never PUBLICLY federates); minting a persona announces no public glamour, because only a publicly announced Handle binds
 * a PersonaGroup to a public glamour — a separate, deliberate publish, which `lares handle publish` performs.
 *
 * THREE NAMES, THREE JOBS (dyad, persona-declare). `--name` labels a compartment to its keeper and their own
 * fleet; `--handle` declares what that persona answers to outward; `lares handle publish` announces it. The label and
 * the Handle MAY read identical and stay two acts, so a human whose compartment reads "the-burner" can still
 * stand under any declared Handle — nothing joins them but the human's own say-so. Founder-side: `new` mints an
 * operator-root this vessel holds — a joining vessel receives a root by admit, never mints one here.
 */

import {
  faceStands, armRecoveryAtFounding, guardianOffer, type FoundFaceResult,
} from "@lararium/node";
import {
  renameOwnPersona, ownPersonaPetname, HANDLE_INDEX_CEILING,
  declarePersonaHandle, standForKahuSeat,
  refuseSlot, personaSlotCeiling, defaultChairLabel, faceLogViewLine, type VesselClass,
} from "@lararium/mesh";
import { cmdPersonaAdmit } from "./persona-admit-cmd.js";
import { storeVerb, storeFailure } from "../store-door.js";
import { sealedAct } from "../sealed-act-door.js";
import { vesselStanding } from "../custody-door.js";
import { larDataDir } from "../env.js";
import { readPersonaRoots, personaRootKey, sealedPetnameStore, sealedDeclarationStore } from "../sealed-rows.js";
import {
  makeFleetPetnameStore, makeFleetDeclarationStore, readFleetSelves, carryOwnName,
} from "../daemon-persona-store.js";
import { emit, exitFor, refuseUsage } from "../render.js";
import { helpLines } from "../command-help.js";
import type { ParsedArgs } from "../parse-args.js";

class UsageError extends Error {}

function usage(args: ParsedArgs, typed?: string): number {
  return refuseUsage(args, "persona", helpLines("persona"), typed ? `unknown sub-verb "${typed}"` : undefined);
}

/**
 * This vessel's persona-slot ceiling. A hearth or leaf carries an operator dial; a Herm carries none — a
 * faceless vessel stands CONTRACTED and mints no root through this verb. The class reads off the same dial
 * the daemon boots by (`LAR_RECIPE`, `main.ts`): a hard-coded `"hearth"` here would let the
 * refusal `personaSlotCeiling("herm") === 0` exist in mesh and never fire at the one door that mints a root.
 * `LAR_PERSONA_SLOTS` is the dial — a human holds a multitude, and the code decides no part of how large.
 */
export function vesselCeiling(env: NodeJS.ProcessEnv = process.env): { cls: VesselClass; declared: number | undefined } {
  const raw = env["LAR_PERSONA_SLOTS"];
  const cls: VesselClass = env["LAR_RECIPE"] === "herm" ? "herm" : "hearth";
  return { cls, declared: raw === undefined ? undefined : Number(raw) };
}

/**
 * Parse a positional handle-index, fail-closed to a clean usage error. TWO bounds ride here and they mean
 * different things: the derivation's own range (structural — no dial reaches past SLIP-0010's hardened
 * ceiling) and THIS VESSEL's slot ceiling (an operator turn, raisable, and the refusal says so).
 */
export function parseIndex(raw: string | undefined, env: NodeJS.ProcessEnv = process.env): number {
  if (raw === undefined) throw new UsageError("a handle-index is required (e.g. `lares persona new 1 --name '…'`)");
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < 0 || n >= HANDLE_INDEX_CEILING) {
    throw new UsageError(`handle-index out of range: "${raw}" (expected 0 ≤ n < 0x80000000)`);
  }
  const { cls, declared } = vesselCeiling(env);
  const refusal = refuseSlot(cls, n, declared);
  if (refusal === "faceless-by-class") {
    throw new UsageError("this vessel holds no human face by class — a crossroads stands contracted, never self-stood.");
  }
  if (refusal === "past-ceiling") {
    throw new UsageError(
      `handle-index ${n} sits at or past this vessel's slot ceiling (${personaSlotCeiling(cls, declared)}) — ` +
      "raise it with LAR_PERSONA_SLOTS if this device should carry more faces.",
    );
  }
  return n;
}

export async function cmdPersona(args: ParsedArgs): Promise<number> {
  const sub = args.positional[0];
  if (!sub) { usage(args); return 2; }
  try {
    switch (sub) {
      case "new":   return await personaNew(args);
      case "wear":  return await personaWear(args);
      case "list":  return await personaList(args);
      case "sync":  return await personaSync(args);
      case "admit": return await cmdPersonaAdmit(args);
      case "reissue": return await personaReissue(args);
      case "guardian": return await personaGuardian(args);
      case "provisional": return await personaProvisional(args);
      case "confirm": return await personaConfirm(args);
      case "view": return await personaView(args);
      default:
        console.error(`lares persona: unknown sub-verb "${sub}"`);
        return usage(args, sub);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const failure = err instanceof UsageError ? { code: "usage", message: msg } : storeFailure(err);
    emit(args, { ok: false, error: failure, human: () => console.error(`lares persona ${sub}: ${msg}`) });
    return exitFor(failure.code);
  }
}

/**
 * The two own-persona name stores, FLEET-MIRRORED. Each write lands on the sealed row first (a founding runs
 * before any vessel breathes) and gets carried up to the persona plane when a vessel with a lit face answers the
 * custody door; each read prefers the fleet. The `seat` claim stays local by construction: the declaration
 * store splits it out.
 */
function fleetStores(): {
  petnames: ReturnType<typeof sealedPetnameStore>;
  declarations: ReturnType<typeof sealedDeclarationStore>;
} {
  return {
    petnames:     makeFleetPetnameStore(sealedPetnameStore()),
    declarations: makeFleetDeclarationStore(sealedDeclarationStore()),
  };
}

/**
 * `lares persona reissue [--nexus <aid>]` — the face this vessel WEARS hands its key at one Nexus on to a fresh key
 * minted at random. Both keys sign one hand-over; it lands on that Nexus's carriage board, where every gate reads
 * it beside the face's admit, and the old key leaves this vessel. The admit keeps naming the key the Nexus admitted.
 * A compromised key takes the face-key roll instead (a revoke and a fresh admit), never a re-issue.
 */
async function personaReissue(args: ParsedArgs): Promise<number> {
  const raw = args.options["nexus"];
  const nexusAid = typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;
  const r = await sealedAct("persona.reissue", nexusAid ? { nexusAid } : {});
  emit(args, {
    ok: true,
    data: r,
    human: () => {
      console.log(`the face at h${String(r["handleIndex"])} handed its key in ${String(r["nexusAid"])} on to a fresh key`);
      console.log(`  from:      ${String(r["from"])}`);
      console.log(`  to:        ${String(r["to"])}`);
      console.log(`  admitted:  ${String(r["admitted"])}  (the admit keeps naming this key; gates read the line to the new one)`);
      console.log(`  hand-over: ${String(r["handOver"])}  (on the Nexus's carriage board)`);
    },
  });
  return 0;
}

/**
 * `lares persona provisional <index>` — whether a restored face still stands provisional, the head its restore read,
 * and who could confirm it (custody#/the-restore).
 */
async function personaProvisional(args: ParsedArgs): Promise<number> {
  const index = parseIndex(args.positional[1]);
  const r = await sealedAct("persona.provisional", { handleIndex: index });
  emit(args, {
    ok: true, data: r,
    human: () => {
      if (r["provisional"] !== true) { console.log(`the face at h${index} stands confirmed: no provisional mark rests on it`); return; }
      const head = r["head"] as { seq: number; eventCid: string };
      console.log(`the face at h${index} stands PROVISIONAL: its restore read head ${head.seq} (${head.eventCid.slice(0, 24)}…) off ${r["from"] === "board" ? "this vessel's board" : "its bundle's log"}.`);
      console.log("  it reads, recovers and serves its own content, and signs no act that changes who holds authority.");
      console.log("  who could confirm, each with its own view (`lares persona confirm <index> <lar-log-view:…>`):");
      for (const line of (r["couldConfirm"] ?? []) as string[]) console.log(`    ${line}`);
    },
  });
  return 0;
}

/**
 * `lares persona confirm <index> <lar-log-view:…>` — one party's own view of the face's head confirms a provisional
 * face where the party stands as itself on this vessel's rows and its head agrees with the one the restore read.
 */
async function personaConfirm(args: ParsedArgs): Promise<number> {
  const index = parseIndex(args.positional[1]);
  const view = args.positional[2];
  if (typeof view !== "string" || !view.startsWith("lar-log-view:")) throw new UsageError("`persona confirm` takes the face's index and one party's view line (lar-log-view:…)");
  const r = await sealedAct("persona.confirm", { handleIndex: index, view });
  emit(args, {
    ok: true, data: r,
    human: () => {
      const head = r["head"] as { seq: number };
      console.log(`the face at h${index} stands CONFIRMED: a ${String(r["party"])} (${String(r["key"]).slice(0, 16)}…) holds the same head (${head.seq}).`);
      console.log("  one agreeing party may itself sit stale: its view counts as evidence that no fork shows to it.");
    },
  });
  return 0;
}

/**
 * `lares persona view <persona-…> --seat-key <key>` — a CHAIR this vessel holds signs its own view of a face's head, read
 * off this vessel's board, for the restored face's vessel to confirm with.
 */
async function personaView(args: ParsedArgs): Promise<number> {
  const prefix = (args.positional[1] ?? "").trim();
  const seat = typeof args.options["seat-key"] === "string" ? args.options["seat-key"].trim().toLowerCase() : "";
  if (!/^persona-[0-9a-f]{64}$/.test(prefix) || !/^[0-9a-f]{64}$/.test(seat)) throw new UsageError("`persona view` names the face (persona-<64 hex>) and the chair it speaks as (--seat-key <64 hex>)");
  const r = await sealedAct("persona.view", { prefix, seat });
  const view = r["view"] as Parameters<typeof faceLogViewLine>[0];
  const line = faceLogViewLine(view);
  emit(args, {
    ok: true, data: { view, line },
    human: () => {
      console.log(`[lares persona view] this chair holds head ${view.seq} for ${prefix.slice(0, 24)}…; hand the face's holder this line:`);
      console.log(`  ${line}`);
    },
  });
  return 0;
}

/**
 * `lares persona guardian show <index>` — the face's prefix (what a guardian's offer names) and the set it holds.
 *
 * `lares persona guardian offer --prefix <persona-…>` — the GUARDIAN's half: mint a fresh recovery key for ONE face,
 * print the card the guardian keeps and the offer line the face's holder enrols. The key never rests on a vessel.
 *
 * `lares persona guardian enrol <index> --threshold <k> <offer>…` — the face at `<index>` enrols its FIRST guardian
 * set: its own key signs one typed event on its key history, and the set's record rests sealed here. A key another
 * face of this vessel already holds refuses (`guardian-key-serves-another-face`); every later change to the set
 * takes the guardians' quorum. The count and the threshold stay the person's.
 */
async function personaGuardian(args: ParsedArgs): Promise<number> {
  const verb = args.positional[1];
  if (verb === "offer") {
    const prefix = typeof args.options["prefix"] === "string" ? args.options["prefix"].trim() : "";
    if (!/^persona-[0-9a-f]{64}$/.test(prefix)) throw new UsageError("`persona guardian offer` names the face it guards: --prefix persona-<64 hex>");
    const o = await guardianOffer(prefix);
    emit(args, {
      ok: true,
      // The card rides to this process's own output alone: the key rests nowhere else, so a reading without it
      // would leave an offer for a key nobody holds.
      data: { prefix, recoveryPubKey: o.recoveryPubKey, offer: o.offer, card: o.code },
      human: () => {
        console.log(`[lares persona guardian offer] a fresh recovery key for the face ${prefix.slice(0, 24)}…`);
        console.log("  KEEP THIS CARD: it signs this face's recovery. Write it down now; it rests nowhere else.");
        console.log(`  card   ${o.code}`);
        console.log("  hand the face's holder this offer line:");
        console.log(`  ${o.offer}`);
      },
    });
    return 0;
  }
  if (verb === "show") {
    const index = parseIndex(args.positional[2]);
    const r = await sealedAct("persona.guardian.show", { handleIndex: index });
    emit(args, {
      ok: true,
      data: r,
      human: () => {
        console.log(`the face at h${index}: ${String(r["prefix"])}`);
        if (r["guardianSetHash"] === null && r["headSet"] === null) {
          console.log("  one-of-one: no guardians enrolled; a guardian cuts its offer with `lares persona guardian offer --prefix <the prefix above>`");
        } else if (r["committed"] === true) {
          console.log(`  guardians: ${String(r["guardians"])} at threshold ${String(r["threshold"])} (set ${String(r["guardianSetHash"])})`);
        } else {
          console.log(`  PENDING: this vessel's record names the set ${String(r["guardianSetHash"])}, and the key history it reads commits ${String(r["headSet"] ?? "none yet")}`);
          console.log("  the same offers complete a stopped enrolment; a set another vessel of this face enrolled first stands as the face's");
        }
      },
    });
    return 0;
  }
  if (verb === "enrol") {
    const index = parseIndex(args.positional[2]);
    const raw = args.options["threshold"];
    const threshold = typeof raw === "string" ? Number(raw) : NaN;
    if (!Number.isSafeInteger(threshold) || threshold < 1) throw new UsageError("`persona guardian enrol` needs --threshold <k>, a whole number from 1");
    const offers = args.positional.slice(3);
    if (offers.length === 0) throw new UsageError("`persona guardian enrol` takes one guardian offer line per guardian");
    const r = await sealedAct("persona.guardian.enrol", { handleIndex: index, offers: offers.join(" "), threshold });
    emit(args, {
      ok: true,
      data: r,
      human: () => {
        console.log(`the face at h${String(r["handleIndex"])} enrolled ${String(r["guardians"])} guardian(s) at threshold ${String(r["threshold"])}`);
        console.log(`  set:   ${String(r["guardianSetHash"])}  (on its key history, sequence ${String(r["seq"])})`);
        console.log("  every later change to this set takes the guardians' quorum");
      },
    });
    return 0;
  }
  return usage(args, "guardian");
}

async function personaNew(args: ParsedArgs): Promise<number> {
  const index = parseIndex(args.positional[1]);
  const name = typeof args.options["name"] === "string" ? args.options["name"].trim() : "";
  if (name.length === 0) throw new UsageError("`persona new` needs a private label: --name '<petname>'");
  const handle = typeof args.options["handle"] === "string" ? args.options["handle"].trim() : "";
  const stands = args.flags["seat"] === true;
  const chair = typeof args.options["chair"] === "string" ? args.options["chair"].trim() : "";
  const splitRoot = args.flags["split-root"] === true;
  // A ROOT SPLIT NEVER RIDES A STANDING VESSEL. Its two off-device shares rebuild the root, so no door hands them
  // to a caller: the split runs in a person's own process, under a key session that person opens. Beside a
  // standing vessel the command refuses here, before anything founds.
  if (splitRoot && (await vesselStanding()).reading !== "none") {
    throw new UsageError(
      "--split-root hands out shares that rebuild this persona's root, so it never rides a standing vessel. " +
      "Stop the vessel (`lares vessel stop`), run this command again, then stand the vessel.",
    );
  }
  const { petnames, declarations } = fleetStores();
  if (!stands && chair.length > 0 && (await declarations.get(index))?.seat !== true) {
    throw new UsageError("--chair labels a seat claim: pass it with --seat");
  }
  if (!stands && chair.length > 0) await standForKahuSeat(declarations, index, true, chair);

  // ── EACH FACE FOUNDS ITS OWN CRYPTOGRAPHIC INDIVIDUAL ────────────────────────────────────────
  // `lares vessel found` stands a PLACE — carrying, serving, faceless. A face lands here: h0 founds the
  // PersonaGroup, its private plane, the social planes, the device-binding edge and the persona-KEL
  // inception, joins that group to the cabal the place already carries, and MOUNTS. Canon rules each
  // PersonaGroup its OWN individual (persona-policy Ruling 2/2b), so `persona new N` (N>0) founds a full
  // SECOND face — its own group, cabal, planes, persona-KEL and veil — as a register-many compartment
  // beside the mounted one; it does not mount (wearing it is `persona wear N`, a later act).
  //
  // Every added compartment rides beside the founding face, so a vessel with no group refuses them:
  // persona h1 inside no PersonaGroup would mint a root the Binding Gate could never walk to.
  //
  // ONE STORE DOOR: the face founds on the store's one holder — inside the standing vessel when one stands (the
  // floor lifts on its next stand), here otherwise.
  if (index !== 0 && !faceStands()) {
    throw new UsageError("no face stands on this place yet — light it with `lares persona new 0 --name '<label>'` first.");
  }
  const founded = (await storeVerb("persona-new", { handleIndex: index })).output as unknown as FoundFaceResult;

  // THE SPLIT RUNS IN THIS PROCESS ALONE (the guard above refused it beside a standing vessel): its shares
  // print to the person at this terminal and ride no door. THE PERSON HOLDS BOTH OFF-DEVICE SHARES BEFORE THE
  // DEVICE SHARE RESTS: a run that stops between the two leaves no device share, and this command splits afresh.
  const recovery = splitRoot ? await armRecoveryAtFounding(larDataDir(), index, ({ recordedCode, escrowCarrier }) => {
    console.log(`[lares persona new] 2-of-3 memory split for h${index} — write both carriers down NOW; the device share seals next.`);
    console.log("  SHARES ARE KEYS: any two of the three rebuild this persona's root.");
    console.log("  Keep both carriers yourself, apart from this device and apart from each other. Handing one to another person makes that person plus this device able to rebuild the root.");
    console.log(`  recorded-code   ${recordedCode}`);
    console.log(`  escrow-carrier  ${escrowCarrier}`);
  }) : null;

  // The founding act above is the ONE door that mints a persona root; this reads the root it stood (or the one
  // already standing), never mints one. Then set the PRIVATE pet-name; renameOwnPersona keeps its own guard.
  const verifyingKey = await personaRootKey(index);
  if (!verifyingKey) throw new UsageError(`the face h${index} stands here with no persona root held — re-found it`);
  const root = { verifyingKey, created: !founded.alreadyStood };
  await renameOwnPersona(petnames, index, name);

  // The DECLARATION rides its own store, so the private label never becomes a public commitment by matching
  // a string. Each flag lands its own field; neither implies the other.
  if (handle.length > 0) await declarePersonaHandle(declarations, index, handle);
  if (stands) await standForKahuSeat(declarations, index, true, chair);
  const declaration = await declarations.get(index);
  if (splitRoot && recovery?.minted) {
    console.log(`[lares persona new] 2-of-3 memory split armed for h${index} — the device share sealed into the identity home.`);
  } else if (splitRoot) {
    console.log(`  root split already stands for h${index}: its device share rests here, and no second split runs over it.`);
  }
  const fleetRead = await readFleetSelves();

  emit(args, {
    ok: true,
    data: {
      handleIndex: index, petname: name, verifyingKey: root.verifyingKey, created: root.created,
      handle: declaration?.handle ?? null, seat: declaration?.seat === true,
      chair: declaration?.seat === true ? declaration.chair?.trim() || defaultChairLabel(index) : null,
      rootSplit: !splitRoot ? "none" : recovery?.minted ? "armed" : "standing", fleet: fleetRead.reached && fleetRead.rest === "sealed",
    },
    human: () => {
      console.log(`persona h${index} ${root.created ? "minted" : "loaded"} — "${name}"`);
      console.log(`  verifying key: ${root.verifyingKey}`);
      if (!splitRoot) {
        console.log("  root split: none (opt in with --split-root)");
      }
      console.log(`  the pet-name stays PRIVATE: it rests sealed here, rides to your own vessels only over a persona plane whose rest seals, and never PUBLICLY federates.`);
      if (declaration?.handle) {
        console.log(`  declares the Handle "${declaration.handle}" — a local intent until you announce it;`);
        console.log(`  only a publicly announced Handle binds this persona to a public glamour — announce it with \`lares handle publish\`.`);
      } else {
        console.log(`  declares no Handle — name one with --handle '<Handle>' when it should answer outward.`);
      }
      if (declaration?.seat === true) {
        console.log(`  stands for a Kahu seat as "${declaration.chair?.trim() || defaultChairLabel(index)}"; that chair label stays private to this node.`);
      }
      if (!fleetRead.reached) {
        console.log(`  NODE-LOCAL — no hearth answered (${fleetRead.why})`);
        console.log(`  the name stands here regardless; carry it to your other vessels with: lares persona sync`);
      } else if (fleetRead.rest !== "sealed") {
        console.log("  NODE-LOCAL — this face's persona plane rests in the clear on disk, so the name rides to no other vessel until that rest seals");
      }
    },
  });
  return 0;
}

async function personaWear(args: ParsedArgs): Promise<number> {
  const index = parseIndex(args.positional[1]);
  // The custody wall lives in the core: wearing REQUIRES a held root — an unheld index throws there.
  await sealedAct("persona.wear", { handleIndex: index });
  emit(args, {
    ok: true,
    data: { active: index },
    human: () => {
      console.log(`now wearing persona h${index}.`);
      console.log(`  reboot-to-switch: the live vessel presents one face per persona — restart the node to sign as it.`);
    },
  });
  return 0;
}

async function personaList(args: ParsedArgs): Promise<number> {
  const roster = await readPersonaRoots();
  const held = roster.roots.map(({ handleIndex }) => handleIndex);
  const active = roster.active;
  const orphans = roster.orphans;
  const { petnames, declarations } = fleetStores();

  const rows = await Promise.all(
    held.map(async (handleIndex) => ({
      handleIndex,
      active: handleIndex === active,
      petname: (await ownPersonaPetname(petnames, handleIndex)) ?? null,
      handle: (await declarations.get(handleIndex))?.handle ?? null,
      seat: (await declarations.get(handleIndex))?.seat === true,
      chair: (await declarations.get(handleIndex))?.seat === true
        ? (await declarations.get(handleIndex))?.chair?.trim() || defaultChairLabel(handleIndex) : null,
    })),
  );

  emit(args, {
    ok: true,
    data: { active: active ?? null, personas: rows, orphans },
    human: () => {
      for (const index of orphans) {
        console.log(`persona root h${index} stands with no roster line (a founding stopped between its two writes) — nothing reads it as held.`);
        console.log(`  adopt it:  lares persona new ${index} --name '<label>'   (the root loads; nothing mints over it)`);
      }
      if (rows.length === 0) {
        console.log("no personas held — stand the founder with `lares vessel stand --install`, then name each persona and add a seat claim with `--seat` (no --handle needed).");
        return;
      }
      console.log("personas (the private multitude — private label -> declared Handle):");
      for (const r of rows) {
        const declares = `${r.handle ? `  ->  "${r.handle}"` : ""}${r.seat ? ` [stands for a Kahu seat as "${r.chair}"]` : ""}`;
        console.log(`  ${r.active ? "*" : " "} h${r.handleIndex}  ${r.petname ?? "(unnamed)"}${declares}`);
      }
      console.log(`  (* = active${active === null ? "; none worn yet" : ""})`);
    },
  });
  return 0;
}

/**
 * personaSync — carry this node's own-persona names UP to the persona plane, so the fleet reads what this device knows.
 *
 * A vessel founds before it breathes, so names set pre-boot rest on the sealed rows alone. This walks those
 * rows and carries each held name through the custody door, onto that face's own plane, WHERE THE PLANE NEVER
 * HELD THAT NAME. A name some vessel of the face already wrote there stands, and so does a clear: this device
 * cannot tell an old name of its own from a newer one a fleet-mate set, so a sync never replaces either. A
 * rename on this device replaces it. The `seat` claim never rides — a Kahu chair belongs to the node that holds it.
 *
 * Idempotent, and safe to run from every device: a second run lands nothing the first one landed.
 */
async function personaSync(args: ParsedArgs): Promise<number> {
  const read = await readFleetSelves();
  if (!read.reached) {
    throw new UsageError(`the fleet did not answer (${read.why}) — stand the vessel (\`lares vessel stand --foreground\`) and open it (\`lares vault unlock\`) so the persona plane can carry these names`);
  }
  const localPetnames     = sealedPetnameStore();
  const localDeclarations = sealedDeclarationStore();

  const carried: Array<{ handleIndex: number; petname: string | null; handle: string | null; petnameLanded: boolean; handleLanded: boolean }> = [];
  const indices = new Set<number>([
    ...(await localPetnames.entries()).map(([i]) => i),
    ...(await localDeclarations.entries()).map(([i]) => i),
  ]);
  for (const handleIndex of [...indices].sort((a, b) => a - b)) {
    const petname = await localPetnames.get(handleIndex);
    const handle  = (await localDeclarations.get(handleIndex))?.handle;
    // A carry names the face and which name; the vessel reads the name off its own sealed row. It FILLS: a name
    // the face's plane already holds (or cleared) stands, since this device cannot tell its own older name from a
    // newer one a fleet-mate set.
    const moves = { petname: petname ? await carryOwnName(handleIndex, "petname", { fill: true }) : null, handle: handle ? await carryOwnName(handleIndex, "handle", { fill: true }) : null };
    for (const move of Object.values(moves)) {
      if (move && !move.landed && !move.kept) throw new Error(`the persona plane refused the names of h${handleIndex}: ${move.why}`);
    }
    carried.push({
      handleIndex, petname: petname ?? null, handle: handle ?? null,
      petnameLanded: moves.petname?.landed === true, handleLanded: moves.handle?.landed === true,
    });
  }

  emit(args, {
    ok: true,
    data: { carried },
    human: () => {
      if (carried.length === 0) { console.log("no own-persona names held — nothing to carry."); return; }
      console.log(`read ${carried.length} persona${carried.length === 1 ? "" : "s"} against the fleet (each face's own persona plane):`);
      const said = (held: string | null, landed: boolean): string => (held === null ? "" : landed ? " (carried up)" : " (the fleet already holds a name here; it stands)");
      for (const c of carried) {
        console.log(`  h${c.handleIndex}  ${c.petname ?? "(unnamed)"}${said(c.petname, c.petnameLanded)}${c.handle ? `  ->  "${c.handle}"${said(c.handle, c.handleLanded)}` : ""}`);
      }
      console.log("  to replace a name the fleet holds, rename the persona on this device.");
      console.log("  the seat claim stays on this node — a Kahu chair belongs to the node that holds it.");
    },
  });
  return 0;
}
