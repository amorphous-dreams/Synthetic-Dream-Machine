/**
 * device-admit must carry the persona-KEL chain onto the CLIMBED island itself — the door never boots.
 *
 * ── THE GAP `carryPersonaKelUpTheGradient` LEFT, MEASURED AT THE DOOR THAT ACTUALLY THROWS ─────────
 * `device-admit-reads-the-resolved-island.test.ts` pins that `admitBoardIsland` resolves the RIGHT
 * KEY once a founder climbs — `91ce09afb`'s cure. But resolving the right key only helps if that
 * island's BOARD carries the chain, and the ONLY place anything carries it is `open-node-vessel.ts`'s
 * boot, which `lares device-admit` never runs: `device-admit.ts`'s own docblock says it opens the
 * store directly and exits (Node adapter, no daemon boot). So the ordinary walk —
 *
 *     lares vessel found → lares persona new 0 → lares nexus rite cabal → lares device-admit
 *
 * — with NO daemon ever booted in between (nothing here starts one; `nexus rite cabal` and
 * `device-admit` are both store-direct doors, exactly like the fleet harness's `found:` callback in
 * `tests/harness/instance.ts:478-495`) reaches the charter board with nothing ever carried onto it,
 * and `device-admit` throws "persona-KEL chain … absent from the local board — run
 * `lares vessel found --force`" over a founding that never tore.
 *
 * DIAGNOSIS: this is a PRODUCT gap, not a harness artifact. `device-admit` is store-direct in every
 * environment — the harness's shortcut is not a shortcut here, it is the real shape of this door.
 *
 * ── THE CURE, HONORING THE RULING ────────────────────────────────────────────────────────────────
 * `project_nexus_gradient_stand_then_connect.md` forbids a rite-time hook ("the path nobody
 * enumerates is the one that bricks a vessel") and wants the climb DERIVED from state. The boot
 * already derives it by calling `carryPersonaKelUpTheGradient` right before its own board read. This
 * cure composes the IDENTICAL call at device-admit's board read — the one seam this door already
 * names (`admitBoardIsland` / `nexus-standing.ts`) — so the carry runs "on read," not "on rite." A
 * second call site of the SAME function is not a second cure; `nodeNexusIslandsBelow` (added beside
 * `nodeNexusIsland`) keeps it a re-derivation of the one stated ranking, never a restated copy.
 *
 * Meme: lar:///ha.ka.ba/lararium/node/device-admit
 */
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { Repo } from "@automerge/automerge-repo";
import { runFoundingCeremony } from "@lararium/keyhive";
import {
  hex, materializeSharedLarDoc, personaKelBoardDocUrl, personaKelChainForPrefix,
  nexusIdentity, nexusScopeOrThrow,
} from "@lararium/mesh";
import * as ed25519 from "@noble/ed25519";

import { carryPersonaKelUpTheGradient } from "../src/persona-kel-ring.js";
import { writeNexusDoc, NEXUS_DOC_DOMAIN } from "../src/nexus-doc.js";
import { admitBoardIsland } from "../src/commands/device-admit.js";
import { nodeNexusIslandsBelow } from "../src/nexus-standing.js";
import { larSealHome } from "../src/vessel-paths.js";

const pubOf = async (s: Uint8Array): Promise<string> => hex(await ed25519.getPublicKeyAsync(s));
const seed  = (n: number): Uint8Array => new Uint8Array(32).fill(n);

const saved: Record<string, string | undefined> = {};
function setEnv(k: string, v: string | undefined): void {
  if (!(k in saved)) saved[k] = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
}

/** Stand a vessel the way a founding does: the board resolved AT THAT moment, which holds no charter. */
async function foundAtOwnIsland(vesselSeed: Uint8Array) {
  const repo     = new Repo({ sharePolicy: async () => true });
  const ownKey   = await pubOf(vesselSeed);
  const founding = nexusIdentity({ ownVesselKey: ownKey });
  expect(founding.kind, "a fresh founding stands a PRIVATE NEXUS OF ONE").toBe("own");
  const cer = await runFoundingCeremony({
    repo, vesselSeed, vesselVerifyingKey: ownKey, vesselDisplayName: "A",
    binding: { mode: "self-stood", signerSeed: vesselSeed }, hearthTrueName: "",
    nexusPubkey: nexusScopeOrThrow(founding),
  });
  return { repo, ownKey, cer };
}

/** `nexus rite cabal`'s own effect on disk — a charter seated at the seal home. */
function climb(charter: string): void {
  writeNexusDoc(larSealHome(), {
    kind: NEXUS_DOC_DOMAIN,
    threshold: 1,
    sealEpochCid: charter,
    kahu: [{ displayName: "steward", verifyingKey: "b2".repeat(32) }],
  });
}

describe("device-admit carries persona-KEL in-session, with no daemon boot between the climb and the admit", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-admit-carry-session-"));
    setEnv("LAR_ROOT", root);
    setEnv("XDG_STATE_HOME", join(root, "state"));
    setEnv("XDG_DATA_HOME", join(root, "state"));
    setEnv("XDG_CONFIG_HOME", join(root, "config"));
    setEnv("LAR_JOIN_GATE", undefined);
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    for (const k of Object.keys(saved)) delete saved[k];
    rmSync(root, { recursive: true, force: true });
  });

  // ── RED ─────────────────────────────────────────────────────────────────────────────────────────
  test("RED — the charter board reads NO chain when nothing ever carried it (the fault, isolated)", async () => {
    const { repo, ownKey, cer } = await foundAtOwnIsland(seed(21));
    const charter = `epoch0-${"9a".repeat(32)}`;
    climb(charter);

    const boardIsland = admitBoardIsland(ownKey);
    expect(boardIsland, "the climb did not move the door's resolution — the rig is vacuous").toBe(charter);

    // THE FAULT, reproduced exactly as `device-admit.ts` hits it: nothing has EVER carried the chain
    // onto this island (no daemon boot ran between the climb and this read).
    const board = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(boardIsland), "board:persona-kel");
    const chain = personaKelChainForPrefix(board.doc(), cer.personaKelPrefix);
    expect(chain, "the charter board must be empty here — this IS the halt device-admit throws on").toBeNull();

    // And the chain is NOT actually lost — it stands on the island below, exactly as the ruling notes
    // ("a carry copies … the board below keeps its chain").
    const ownBoard = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(ownKey), "board:persona-kel");
    expect(personaKelChainForPrefix(ownBoard.doc(), cer.personaKelPrefix), "the founding board still holds it").not.toBeNull();
  }, 60_000);

  // ── THE CURE, exercised directly at the seam device-admit composes ───────────────────────────────
  test("GREEN — carrying on read (nodeNexusIslandsBelow + carryPersonaKelUpTheGradient) reaches the chain, no boot required", async () => {
    const { repo, ownKey, cer } = await foundAtOwnIsland(seed(22));
    const charter = `epoch0-${"9b".repeat(32)}`;
    climb(charter);

    const boardIsland = admitBoardIsland(ownKey);
    expect(boardIsland).toBe(charter);

    // THE CURE: the exact call `device-admit.ts` now makes before it reads the board.
    const carried = await carryPersonaKelUpTheGradient({
      repo, nexusPubkey: boardIsland, prefix: cer.personaKelPrefix,
      priorIslands: nodeNexusIslandsBelow({ ownVesselKey: ownKey }),
    });
    expect(carried.carried, "the carry must move the inception onto the charter board").toBeGreaterThan(0);

    const board = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(boardIsland), "board:persona-kel");
    const chain = personaKelChainForPrefix(board.doc(), cer.personaKelPrefix);
    expect(chain, "device-admit can now read the chain with no daemon ever having booted").not.toBeNull();
    expect(chain![0]!.prefix).toBe(cer.personaKelPrefix);
  }, 60_000);

  // ── CONTROL — an un-climbed vessel's admit is byte-for-byte unchanged ────────────────────────────
  test("CONTROL — an un-climbed vessel needs no carry: priorIslands is empty and the board already carries it", async () => {
    const { repo, ownKey, cer } = await foundAtOwnIsland(seed(23));
    const boardIsland = admitBoardIsland(ownKey);
    expect(boardIsland).toBe(ownKey);

    const priorIslands = nodeNexusIslandsBelow({ ownVesselKey: ownKey });
    expect(priorIslands, "standing at the bottom of the gradient carries no sources").toEqual([]);

    const carried = await carryPersonaKelUpTheGradient({
      repo, nexusPubkey: boardIsland, prefix: cer.personaKelPrefix, priorIslands,
    });
    expect(carried).toEqual({ carried: 0, from: null });

    const board = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(boardIsland), "board:persona-kel");
    expect(personaKelChainForPrefix(board.doc(), cer.personaKelPrefix)).not.toBeNull();
  }, 60_000);

  // ── CONTROL — a genuinely-absent chain still refuses, carry or no carry ──────────────────────────
  test("CONTROL — a chain nobody ever seated stays absent after the carry runs — the refusal survives", async () => {
    const { repo, ownKey } = await foundAtOwnIsland(seed(24));
    const charter = `epoch0-${"9c".repeat(32)}`;
    climb(charter);
    const boardIsland = admitBoardIsland(ownKey);
    const absentPrefix = "persona-nobodyeverseatedthisidentifier";

    const carried = await carryPersonaKelUpTheGradient({
      repo, nexusPubkey: boardIsland, prefix: absentPrefix,
      priorIslands: nodeNexusIslandsBelow({ ownVesselKey: ownKey }),
    });
    expect(carried, "no lower board carries an identifier nobody ever seated").toEqual({ carried: 0, from: null });

    const board = await materializeSharedLarDoc(repo, personaKelBoardDocUrl(boardIsland), "board:persona-kel");
    expect(personaKelChainForPrefix(board.doc(), absentPrefix), "a genuinely torn/absent chain must still refuse").toBeNull();
  }, 60_000);

  // ── THE WELD · device-admit.ts must COMPOSE the carry at its own board read, not merely resolve the key ──
  test("WELD — device-admit.ts carries on read (nodeNexusIslandsBelow + carryPersonaKelUpTheGradient) before reading the chain", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../src/commands/device-admit.ts", import.meta.url), "utf8");
    const standingSrc = readFileSync(new URL("../src/nexus-standing.ts", import.meta.url), "utf8");
    expect(standingSrc, "the shared islands-below re-derivation stands beside nodeNexusIsland")
      .toMatch(/export function nodeNexusIslandsBelow\(/);
    expect(src, "device-admit composes the shared islands-below re-derivation").toMatch(/nodeNexusIslandsBelow\(/);
    expect(src, "device-admit composes the SAME carry the boot runs").toMatch(/carryPersonaKelUpTheGradient\(/);

    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const carryAt = code.indexOf("carryPersonaKelUpTheGradient(");
    const readAt  = code.indexOf("personaKelChainForPrefix(");
    expect(carryAt, "the carry call must exist in code, not only in a comment").toBeGreaterThan(-1);
    expect(readAt, "the chain read must exist in code").toBeGreaterThan(-1);
    expect(carryAt, "the carry must run BEFORE the chain read it feeds").toBeLessThan(readAt);
  });
});
