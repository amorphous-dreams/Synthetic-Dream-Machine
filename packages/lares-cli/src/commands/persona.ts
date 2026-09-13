/**
 * `lares persona {new <index> --name <petname> [--handle <Handle>] [--seat] | wear <index> | list}` — the
 * operator's door to the
 * PLURALITY-PONO identity multitude. A vessel HOLDS a set of PersonaGroup-roots — one per persona
 * the operator wears (persona-vault) — and WEARS one at a time. This command DRIVES the existing node core;
 * it never re-implements minting, the custody wall, or the pet-name store.
 *
 *   new <index> --name <petname>       mint/load the persona-root at <index> (fail-closed via
 *                                      assertHandleIndex) + set its PRIVATE pet-name
 *              [--handle <Handle>]     declare the public Handle this persona answers to (an intent, not a
 *                                      publish — only an announce binds a persona to a glamour)
 *              [--seat]                stand this persona for a Kahu chair on THIS node (needs a Handle)
 *   wear <index>                       switch the active persona (one-face-to-mesh; reboot-to-switch)
 *   list                               the private multitude-view — held indices, active marker, labels, Handles
 *
 * The pet-name stays PRIVATE (persona-petname: fleet-syncs among the human's own vessels, never PUBLICLY
 * federates); minting a persona announces no public glamour, because only a publicly announced Handle binds
 * a PersonaGroup to a public glamour — a separate, deliberate publish, which `lares handle publish` performs.
 *
 * THREE NAMES, THREE JOBS (dyad, persona-declare). `--name` labels a compartment to its keeper and their own
 * fleet; `--handle` declares what that persona answers to outward; `lares handle publish` announces it. The label and
 * the Handle MAY read identical and stay two acts, so a human whose compartment reads "the-burner" can still
 * stand under any declared Handle — nothing joins them but the human's own say-so. Founder-side: `new` mints an
 * operator-root this vessel holds — a joining vessel receives a root by admit, never mints one here.
 */

import {
  generateOrLoadPersonaGroupRoot, wearPersona, listPersonaRoots, loadActivePersonaIndex,
  makeNodePersonaPetnameStore, makeNodePersonaDeclarationStore,
  runFoundTheFace, faceStands,
} from "@lararium/node";
import {
  renameOwnPersona, ownPersonaPetname, HANDLE_INDEX_CEILING,
  declarePersonaHandle, standForKahuSeat, declaredHandle,
  refuseSlot, personaSlotCeiling, type VesselClass,
} from "@lararium/mesh";
import { cmdPersonaAdmit } from "./persona-admit-cmd.js";
import { larDataDir } from "../env.js";
import {
  makeFleetPetnameStore, makeFleetDeclarationStore, readFleetSelves, fleetPeerDid,
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
 * the daemon boots by (`LAR_RECIPE`, `main.ts`): measured 2026-09-12, a hard-coded `"hearth"` here let the
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
      default:
        console.error(`lares persona: unknown sub-verb "${sub}"`);
        return usage(args, sub);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = err instanceof UsageError ? "usage" : "error";
    emit(args, { ok: false, error: { code, message: msg }, human: () => console.error(`lares persona ${sub}: ${msg}`) });
    return exitFor(code);
  }
}

/**
 * The two own-persona name stores, FLEET-MIRRORED. Each write lands on the local fs floor first (a founding
 * runs before any daemon breathes) and rides up to the persona plane when the sock answers; each read prefers the
 * fleet. The `seat` claim stays local by construction — the declaration store splits it out.
 */
async function fleetStores(): Promise<{
  petnames: Awaited<ReturnType<typeof makeNodePersonaPetnameStore>>;
  declarations: Awaited<ReturnType<typeof makeNodePersonaDeclarationStore>>;
  did: string | null;
}> {
  const did = await fleetPeerDid();
  const petnames     = await makeNodePersonaPetnameStore();
  const declarations = await makeNodePersonaDeclarationStore();
  // No vessel key = no place = no fleet. The pure local floor stands, and `persona sync` carries the names up
  // once the vessel does.
  if (did === null) return { petnames, declarations, did };
  return {
    petnames:     makeFleetPetnameStore(petnames, did),
    declarations: makeFleetDeclarationStore(declarations, did),
    did,
  };
}

async function personaNew(args: ParsedArgs): Promise<number> {
  const index = parseIndex(args.positional[1]);
  const name = typeof args.options["name"] === "string" ? args.options["name"].trim() : "";
  if (name.length === 0) throw new UsageError("`persona new` needs a private label: --name '<petname>'");
  const handle = typeof args.options["handle"] === "string" ? args.options["handle"].trim() : "";
  const stands = args.flags["seat"] === true;
  // A seat claim answers to a CHAIR NAME, so it needs a Handle — either declared in this breath or already
  // standing from an earlier one. Refusing here beats seating a nameless claim the seal cannot join.
  const { petnames, declarations, did } = await fleetStores();
  if (stands && handle.length === 0) {
    const held = await declaredHandle(declarations, index);
    if (!held) {
      throw new UsageError(
        `--seat needs the Handle this persona answers to: --handle '<Handle>' (h${index} declares none yet)`,
      );
    }
  }

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
  if (index === 0) {
    await runFoundTheFace({ storageDir: larDataDir() });
  } else if (!faceStands()) {
    throw new UsageError("no face stands on this place yet — light it with `lares persona new 0 --name '<label>'` first.");
  } else {
    await runFoundTheFace({ storageDir: larDataDir(), handleIndex: index });
  }

  // Mint/load the operator-root (idempotent per index; assertHandleIndex guards inside the core), then
  // set the PRIVATE pet-name. renameOwnPersona keeps its own non-blank guard.
  const root = await generateOrLoadPersonaGroupRoot(larDataDir(), index);
  await renameOwnPersona(petnames, index, name);

  // The DECLARATION rides its own store, so the private label never becomes a public commitment by matching
  // a string. Each flag lands its own field; neither implies the other.
  if (handle.length > 0) await declarePersonaHandle(declarations, index, handle);
  if (stands) await standForKahuSeat(declarations, index, true);
  const declaration = await declarations.get(index);
  const fleetRead = did === null
    ? { reached: false as const, why: "this vessel stands no key yet" }
    : await readFleetSelves(did);

  emit(args, {
    ok: true,
    data: {
      handleIndex: index, petname: name, verifyingKey: root.verifyingKey, created: root.created,
      handle: declaration?.handle ?? null, seat: declaration?.seat === true, fleet: fleetRead.reached,
    },
    human: () => {
      console.log(`persona h${index} ${root.created ? "minted" : "loaded"} — "${name}"`);
      console.log(`  verifying key: ${root.verifyingKey}`);
      console.log(`  pet-name is PRIVATE — it fleet-syncs among your own vessels and never PUBLICLY federates.`);
      if (declaration?.handle) {
        console.log(`  declares the Handle "${declaration.handle}" — a local intent until you announce it;`);
        console.log(`  only a publicly announced Handle binds this persona to a public glamour — announce it with \`lares handle publish\`.`);
      } else {
        console.log(`  declares no Handle — name one with --handle '<Handle>' when it should answer outward.`);
      }
      if (declaration?.seat === true) {
        console.log(`  STANDS for a Kahu seat on THIS node; take the chair with: lares nexus seal seat`);
      }
      if (!fleetRead.reached) {
        console.log(`  NODE-LOCAL — no hearth answered (${fleetRead.why})`);
        console.log(`  the name stands here regardless; carry it to your other vessels with: lares persona sync`);
      }
    },
  });
  return 0;
}

async function personaWear(args: ParsedArgs): Promise<number> {
  const index = parseIndex(args.positional[1]);
  // The custody wall lives in the core: wearing REQUIRES a held root — an unheld index throws there.
  await wearPersona(larDataDir(), index);
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
  const dataDir = larDataDir();
  const held = await listPersonaRoots(dataDir);
  const active = await loadActivePersonaIndex(dataDir);
  const { petnames, declarations } = await fleetStores();

  const rows = await Promise.all(
    held.map(async (handleIndex) => ({
      handleIndex,
      active: handleIndex === active,
      petname: (await ownPersonaPetname(petnames, handleIndex)) ?? null,
      handle: (await declarations.get(handleIndex))?.handle ?? null,
      seat: (await declarations.get(handleIndex))?.seat === true,
    })),
  );

  emit(args, {
    ok: true,
    data: { active: active ?? null, personas: rows },
    human: () => {
      if (rows.length === 0) {
        console.log("no personas held — stand the founder with `lares vessel stand --install`, then name + declare every kahu (three symmetric commands): `lares persona new 0/1/2 --name '<label>' --handle '<Handle>' --seat` (new 0 loads+names the founder).");
        return;
      }
      console.log("personas (the private multitude — private label -> declared Handle):");
      for (const r of rows) {
        const declares = r.handle ? `  ->  "${r.handle}"${r.seat ? " [stands for a Kahu seat]" : ""}` : "";
        console.log(`  ${r.active ? "*" : " "} h${r.handleIndex}  ${r.petname ?? "(unnamed)"}${declares}`);
      }
      console.log(`  (* = active${active === undefined ? "; none worn yet" : ""})`);
    },
  });
  return 0;
}

/**
 * personaSync — carry this node's own-persona names UP to the persona plane, so the fleet reads what this device knows.
 *
 * A vessel founds before it breathes, so names set pre-boot live only in the local fs floor. This walks that
 * floor and re-writes each name through the fleet-mirroring store; the verb's own stamp rule decides the rest
 * (a name a fleet-mate set LATER stands, and this device's stale copy loses without a clobber). The `seat`
 * claim never rides — a Kahu chair belongs to the node that holds it.
 *
 * Idempotent, and safe to run from every device: two vessels syncing the same persona converge, because each
 * name carries its own stamp and the later one reads.
 */
async function personaSync(args: ParsedArgs): Promise<number> {
  const did = await fleetPeerDid();
  if (did === null) {
    throw new UsageError("this install stands no vessel key — run `lares vessel found` before carrying names to a fleet");
  }
  const read = await readFleetSelves(did);
  if (!read.reached) {
    throw new UsageError(`the fleet did not answer (${read.why}) — start the node (\`lares vessel stand --foreground\`) so the persona plane can carry these names`);
  }
  const localPetnames     = await makeNodePersonaPetnameStore();
  const localDeclarations = await makeNodePersonaDeclarationStore();
  const petnames     = makeFleetPetnameStore(localPetnames, did);
  const declarations = makeFleetDeclarationStore(localDeclarations, did);

  const carried: Array<{ handleIndex: number; petname: string | null; handle: string | null }> = [];
  const indices = new Set<number>([
    ...(await localPetnames.entries()).map(([i]) => i),
    ...(await localDeclarations.entries()).map(([i]) => i),
  ]);
  for (const handleIndex of [...indices].sort((a, b) => a - b)) {
    const petname = await localPetnames.get(handleIndex);
    const handle  = (await localDeclarations.get(handleIndex))?.handle;
    if (petname) await petnames.set(handleIndex, petname);
    if (handle)  await declarations.set(handleIndex, { ...(await localDeclarations.get(handleIndex) ?? {}), handle });
    carried.push({ handleIndex, petname: petname ?? null, handle: handle ?? null });
  }

  emit(args, {
    ok: true,
    data: { carried },
    human: () => {
      if (carried.length === 0) { console.log("no own-persona names held — nothing to carry."); return; }
      console.log(`carried ${carried.length} persona name${carried.length === 1 ? "" : "s"} up to the fleet (the persona plane):`);
      for (const c of carried) {
        console.log(`  h${c.handleIndex}  ${c.petname ?? "(unnamed)"}${c.handle ? `  ->  "${c.handle}"` : ""}`);
      }
      console.log("  the seat claim stays on this node — a Kahu chair belongs to the node that holds it.");
    },
  });
  return 0;
}
