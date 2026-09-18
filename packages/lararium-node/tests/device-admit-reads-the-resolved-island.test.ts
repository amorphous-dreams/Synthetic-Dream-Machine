/**
 * device-admit must read the persona-KEL board AT THE ISLAND THE BOOT RESOLVED.
 *
 * ── THE LATENT READ ──────────────────────────────────────────────────────────────────────────────
 * `device-admit.ts` resolved its board as `personaKelBoardDocUrl(await loadVesselVerifyingKey(dir))`,
 * under a comment reading "its gate key IS its Nexus key." After `91ce09afb` — every per-Nexus board
 * keys on the NEXUS — that sentence holds at exactly ONE point on the gradient, the `own` island,
 * and nowhere above it. A vessel that CLIMBED to a charter reads the PRIVATE board beneath its
 * charter island while its own boot reads the charter board.
 *
 * IT WORKS TODAY ONLY BECAUSE A CARRY COPIES. `carryPersonaKelUpTheGradient` writes the destination
 * and never unlinks the source ("NEVER EMPTIES THE SOURCE. A carry copies."), so the lower board
 * keeps its chain and the wrong-key read still finds one. The correctness rests on copy semantics in
 * a different package, one refactor away — and when it goes, device-admit throws
 * "persona-KEL chain … absent from the local board — run `lares vessel found --force`", a message
 * pointing at a torn founding over a founding that is perfectly sound.
 *
 * ── WHAT THIS PINS ───────────────────────────────────────────────────────────────────────────────
 * The RED compares TWO RESOLUTIONS over one climbed vessel's real disk state: the island the boot
 * resolves (`nexusIdentity` over the charter) and the island the admit door resolves. They must be
 * the same string. The CONTROL pins that an UN-CLIMBED vessel is unchanged — the two keys coincide
 * at `own`, so the cure moves nothing there.
 *
 * Reading the RESOLUTION rather than driving the whole `runDeviceAdmit` ceremony is deliberate: the
 * ceremony needs a founding, a bootstrap and a live daemon doc, and none of that is what broke. The
 * fault is a KEY, so the key is what is measured — and the weld at the tail pins that the door
 * actually composes this resolution rather than restating it.
 *
 * Isolation: a fresh `mkdtemp` under `LAR_ROOT` + XDG_*; the operator's live vessel is unreachable.
 */
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { nexusIdentity, nexusScopeOrThrow, personaKelBoardDocUrl, realmIdOfCharter } from "@lararium/mesh";

import { writeNexusDoc, readNexusDoc, nexusCharterStands, NEXUS_DOC_DOMAIN } from "../src/nexus-doc.js";
import { nodeNexusIsland, nodeNexusStandsAt, nodeNexusStanding, admittedJoineeIsland } from "../src/nexus-standing.js";
import { admitBoardIsland } from "../src/commands/device-admit.js";
import { larSealHome, larBootstrapPath } from "../src/vessel-paths.js";
import { hearthDialTiddlers, readHearthDialPin, HEARTH_ISLAND_KIND_TIDDLER } from "../src/hearth-dial-pin.js";

/** A stand-in vessel verifying key — the spelling `loadVesselVerifyingKey` would hand back. */
const OWN_KEY = "a1".repeat(32);
const CHARTER = `epoch0-${"7a".repeat(32)}`;

const saved: Record<string, string | undefined> = {};
function setEnv(k: string, v: string | undefined): void {
  if (!(k in saved)) saved[k] = process.env[k];
  if (v === undefined) delete process.env[k]; else process.env[k] = v;
}

describe("device-admit resolves the island the boot resolved", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-admit-island-"));
    setEnv("LAR_ROOT", root);
    setEnv("XDG_STATE_HOME", join(root, "state"));
    setEnv("XDG_DATA_HOME", join(root, "state"));
    setEnv("XDG_CONFIG_HOME", join(root, "config"));
    setEnv("LAR_JOIN_GATE", undefined);   // no anchor pin — the charter, or `own`, decides
  });

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(root, { recursive: true, force: true });
  });

  /** Seat a charter on disk — the CLIMB. The vessel now stands at the charter island, not its own key. */
  function climb(): void {
    writeNexusDoc(larSealHome(), {
      kind: NEXUS_DOC_DOMAIN,
      threshold: 1,
      sealEpochCid: CHARTER,
      kahu: [{ displayName: "steward", verifyingKey: "b2".repeat(32) }],
    });
  }

  /** The island THE BOOT resolves, derived exactly as `open-node-vessel` derives it. */
  function bootIsland(): string {
    return nexusScopeOrThrow(nexusIdentity({
      genesisEpochCid: realmIdOfCharter(readNexusDoc(larSealHome())),
      charterStands:   nexusCharterStands(larSealHome()),
      anchorGateKey:   process.env["LAR_JOIN_GATE"] ?? null,
      ownVesselKey:    OWN_KEY,
    }));
  }

  // ── RED ─────────────────────────────────────────────────────────────────────────────────────────
  test("RED — a CLIMBED vessel's admit door resolves the CHARTER island, not its own vessel key", () => {
    climb();
    const boot = bootIsland();
    // The premise, pinned: the climb genuinely moved the island. Without this the test below would
    // pass vacuously on a vessel that never left `own`.
    expect(boot, "the charter did not move the island — the rig failed and the assertion is vacuous").not.toBe(OWN_KEY);
    expect(boot).toBe(CHARTER);

    const admit = admitBoardIsland(OWN_KEY);   // THE DOOR'S OWN resolution, not the helper's
    expect(admit, "the admit door resolved a different island than the boot").toBe(boot);
    // THE FAULT-PIN, on the BOARD rather than the key — a cure that resolved the right island and
    // still keyed the board off the vessel key would clear the assertion above.
    expect(personaKelBoardDocUrl(admit)).toBe(personaKelBoardDocUrl(boot));
    expect(personaKelBoardDocUrl(admit),
      "the admit door still keys the board on the vessel's own key — the read the carry's copy hides")
      .not.toBe(personaKelBoardDocUrl(OWN_KEY));
  });

  test("RED — an ANCHOR pin moves the admit door's island too, in the boot's own precedence", () => {
    const anchor = "c3".repeat(32);
    setEnv("LAR_JOIN_GATE", anchor);     // a joined vessel, no charter of its own
    expect(bootIsland()).toBe(anchor);
    expect(admitBoardIsland(OWN_KEY), "the door follows the boot's precedence").toBe(anchor);
    // And an explicit override still outranks the environment, as it does at the boot.
    expect(nodeNexusIsland({ ownVesselKey: OWN_KEY, joinGatePubKey: "d4".repeat(32) })).toBe("d4".repeat(32));
  });

  test("RED — a charter that STANDS and reads TORN refuses rather than falling back to the vessel key", () => {
    // A charter file that stands but carries no readable epoch — the third state `91ce09afb` named.
    writeNexusDoc(larSealHome(), {
      kind: NEXUS_DOC_DOMAIN,
      threshold: 1,
      sealEpochCid: "not-an-epoch-cid",
      kahu: [{ displayName: "steward", verifyingKey: "b2".repeat(32) }],
    });
    // The FALLBACK is the defect: keying a board on a name the boot never stands on. Fail closed.
    let fellBack: string | null = null;
    try { fellBack = admitBoardIsland(OWN_KEY); } catch { /* the refusal */ }
    expect(fellBack, "a torn charter fell back to the vessel key — a board keyed on a name no boot stands on").toBeNull();
  });

  // ── CONTROL ─────────────────────────────────────────────────────────────────────────────────────
  test("CONTROL — an UN-CLIMBED vessel is byte-identical to today: the island IS its own vessel key", () => {
    expect(nexusCharterStands(larSealHome()), "the rig seated a charter — this control tests nothing").toBe(false);
    const island = admitBoardIsland(OWN_KEY);
    // The POSITIVE: the resolved island is EXACTLY the spelling the old read used, so the admit
    // payload and the board url are unchanged at the `own` island.
    expect(island).toBe(OWN_KEY);
    expect(personaKelBoardDocUrl(island)).toBe(personaKelBoardDocUrl(OWN_KEY));
    expect(bootIsland()).toBe(OWN_KEY);
    expect(nodeNexusStandsAt({ ownVesselKey: OWN_KEY }).ownVesselKey).toBe(OWN_KEY);
  });

  // ── THE WELD · the door must COMPOSE the resolution, not restate it ─────────────────────────────
  // Every assertion above measures `nexus-standing`. What it cannot see is `device-admit` keeping a
  // second, private copy of the resolution beside it — which is the exact defect this cures (the
  // boot's own comment: "A second copy of this object would drift from the first"). So the door's
  // source is read for the composition, and for the ABSENCE of the spelling that broke.
  test("WELD — `device-admit` composes `nodeNexusIsland` and no longer keys a board on the vessel key", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../src/commands/device-admit.ts", import.meta.url), "utf8");
    // The symbol it must compose EXISTS and is exported — a token-only weld cannot tell a rename
    // from a deletion, so the export is asserted on the module that owns it.
    const owner = readFileSync(new URL("../src/nexus-standing.ts", import.meta.url), "utf8");
    expect(owner, "the composed resolver stands").toMatch(/export function nodeNexusIsland\(/);
    expect(src, "the door composes the shared resolution").toMatch(/nodeNexusIsland\(/);
    // AND THE STRUCTURAL FACT: no `personaKelBoardDocUrl` call in this file takes a key read straight
    // off `loadVesselVerifyingKey`. This reads the ARGUMENT, so a rename of the resolver still reds
    // the composition assertion above rather than quietly passing here.
    //
    // COMMENTS ARE STRIPPED FIRST, and that is not tidiness — it is a measured trap. The docblock
    // above `admitBoardIsland` NAMES the old spelling in order to explain why it was wrong, and this
    // sweep matched that prose and red over code that was already correct. A weld reading raw source
    // cannot tell an explanation of a defect from the defect; stripping comments makes it read CODE.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code, "the comment strip ate the file — the sweep below would pass vacuously")
      .toMatch(/personaKelBoardDocUrl\(/);
    for (const m of code.matchAll(/personaKelBoardDocUrl\(([^)]*)\)/g)) {
      expect(m[1], `a board keyed on a raw vessel key: ${m[0]}`).not.toMatch(/VerifyingKey|vesselKey/i);
    }
  });
});

/**
 * `hearthGatePubKey → anchorGateKey` — a SECOND defect one layer downstream of the one above.
 *
 * The suite above pins that `device-admit` reads the founder's persona-KEL board at the RIGHT island
 * (the board it snapshots the chain FROM). This suite pins the SEPARATE fact that the door then threw
 * that resolution away when it CARRIED the payload: the wire only ever carried `hearthGatePubKey` (the
 * founder's raw vessel key, on purpose — the anti-relay dial binding), and `init.ts` read that single
 * field back as `anchorGateKey`, so a joinee ALWAYS resolved `kind: "anchor"` regardless of what the
 * founder itself stood on. A CLIMBED founder (its own boot resolves `kind: "charter"`, `epoch0-…`) thus
 * handed its joinee an island the founder does NOT stand on — two disjoint persona-KEL boards.
 *
 * Option A splits the payload: `hearthGatePubKey` stays byte-identical (still the raw vessel key, still
 * what the V3 proof's anti-relay binding commits to); a SEPARATE `hearthIslandKind`/`hearthIslandScope`
 * rides beside it, carrying the founder's resolved `kind`/`scope` as a SNAPSHOT. `init.ts` feeds that
 * into `nexusIdentity` directly — the charter branch when `kind === "charter"`, else the pre-existing
 * anchor-by-gate-key branch, unchanged.
 *
 * This suite measures the SEAM at `admittedJoineeIsland` (nexus-standing.ts) — the one function both
 * `init.ts`'s admit-path and this test call, so a weld at the tail confirms `init.ts` actually composes
 * it rather than restating the ruling inline (the exact defect class the file above already fought once).
 */
describe("device-admit carries the founder's RESOLVED island, not just its gate key", () => {
  const OWN_KEY  = "a1".repeat(32);
  const JOINEE   = "e5".repeat(32);
  const CHARTER  = `epoch0-${"7a".repeat(32)}`;

  const saved: Record<string, string | undefined> = {};
  function setEnv(k: string, v: string | undefined): void {
    if (!(k in saved)) saved[k] = process.env[k];
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }

  let root: string;
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "lares-admit-carry-"));
    setEnv("LAR_ROOT", root);
    setEnv("XDG_STATE_HOME", join(root, "state"));
    setEnv("XDG_DATA_HOME", join(root, "state"));
    setEnv("XDG_CONFIG_HOME", join(root, "config"));
    setEnv("LAR_JOIN_GATE", undefined);
  });
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
    rmSync(root, { recursive: true, force: true });
  });

  function climb(): void {
    writeNexusDoc(larSealHome(), {
      kind: NEXUS_DOC_DOMAIN,
      threshold: 1,
      sealEpochCid: CHARTER,
      kahu: [{ displayName: "steward", verifyingKey: "b2".repeat(32) }],
    });
  }

  // ── RED ─────────────────────────────────────────────────────────────────────────────────────────
  test("RED — a CLIMBED founder's carry seats the joinee on the CHARTER board, not the founder's vessel key", () => {
    climb();
    // The founder's own resolution — exactly what `runDeviceAdmit` computes and carries (device-admit.ts).
    const founderIdentity = nodeNexusStanding({ ownVesselKey: OWN_KEY });
    expect(founderIdentity.kind, "the climb did not move the founder's own standing — the rig is vacuous").toBe("charter");
    expect(founderIdentity.scope).toBe(CHARTER);

    // The CARRY, exactly as device-admit.ts builds it: hearthGatePubKey stays the raw vessel key
    // (untouched — the anti-relay binding), hearthIslandKind/Scope ride beside it.
    const carried = {
      hearthGatePubKey:  OWN_KEY,
      hearthIslandKind:  founderIdentity.kind,
      hearthIslandScope: founderIdentity.scope,
    };

    // THE FAULT THIS CURES: forcing `anchorGateKey := hearthGatePubKey` alone (the OLD read) would
    // resolve `kind: "anchor"`, `scope: OWN_KEY` — never the charter. The joinee must instead resolve
    // the CHARTER island the founder itself stands on.
    const joineeIsland = admittedJoineeIsland({ ...carried, ownVesselKey: JOINEE });
    expect(joineeIsland, "the joinee seated on the founder's raw vessel key, not the charter it stands on")
      .toBe(CHARTER);
    expect(personaKelBoardDocUrl(joineeIsland)).toBe(personaKelBoardDocUrl(founderIdentity.scope));
  });

  // ── CONTROL ─────────────────────────────────────────────────────────────────────────────────────
  test("CONTROL — an UN-CLIMBED founder's carry is unchanged: the joinee still seats on the gate key", () => {
    expect(nexusCharterStands(larSealHome()), "the rig seated a charter — this control tests nothing").toBe(false);
    const founderIdentity = nodeNexusStanding({ ownVesselKey: OWN_KEY });
    expect(founderIdentity.kind).toBe("own");
    expect(founderIdentity.scope).toBe(OWN_KEY);

    const carried = {
      hearthGatePubKey:  OWN_KEY,
      hearthIslandKind:  founderIdentity.kind,
      hearthIslandScope: founderIdentity.scope,
    };
    const joineeIsland = admittedJoineeIsland({ ...carried, ownVesselKey: JOINEE });
    // Byte-identical to the OLD (pre-fix) resolution at this notch: the gate key IS the scope here.
    expect(joineeIsland).toBe(OWN_KEY);
    expect(joineeIsland).toBe(carried.hearthGatePubKey);
  });

  // ── An OLDER payload (no island carried) is unchanged too — the new fields are strictly additive ──
  test("CONTROL — a payload with NO hearthIslandKind/Scope resolves exactly as before this carry existed", () => {
    const joineeIsland = admittedJoineeIsland({ hearthGatePubKey: OWN_KEY, ownVesselKey: JOINEE });
    expect(joineeIsland).toBe(OWN_KEY);
  });

  // ── The full round trip through the hearth-dial-pin (what a REAL `init.ts --admit` persists) ──────
  test("the pin round-trips kind+scope through the bootstrap file, kind-aware on read-back", () => {
    mkdirSync(dirname(larBootstrapPath()), { recursive: true });
    const packed = {
      tiddlers: hearthDialTiddlers("wss://hearth.example/ws", OWN_KEY, { kind: "charter", scope: CHARTER }),
    };
    writeFileSync(larBootstrapPath(), JSON.stringify({ text: JSON.stringify(packed) }), "utf8");
    const pin = readHearthDialPin(larBootstrapPath());
    expect(pin?.gatePubKey).toBe(OWN_KEY);
    expect(pin?.islandKind).toBe("charter");
    expect(pin?.islandScope).toBe(CHARTER);
  });

  // ── FAIL-CLOSED: a torn island half refuses the WHOLE pin, exactly as a torn sync/gate half does ──
  test("a torn island half (kind present, scope malformed) refuses the whole pin, never a silent drop", () => {
    mkdirSync(dirname(larBootstrapPath()), { recursive: true });
    const good = hearthDialTiddlers("wss://hearth.example/ws", OWN_KEY);
    const torn = {
      ...good,
      [HEARTH_ISLAND_KIND_TIDDLER]: { title: HEARTH_ISLAND_KIND_TIDDLER, text: "charter", kind: "hearth-door" },
      // scope deliberately absent — one half of the pair, torn.
    };
    writeFileSync(larBootstrapPath(), JSON.stringify({ text: JSON.stringify({ tiddlers: torn }) }), "utf8");
    expect(readHearthDialPin(larBootstrapPath()), "a torn island half must fail the WHOLE pin closed").toBeNull();
  });

  // ── REVERT-VERIFY: forcing kind:"anchor" regardless (the OLD behavior) reds the climbed-founder case ──
  test("REVERT-VERIFY — forcing kind:\"anchor\" regardless reproduces the old defect (must NOT equal CHARTER)", () => {
    climb();
    const founderIdentity = nodeNexusStanding({ ownVesselKey: OWN_KEY });
    expect(founderIdentity.kind).toBe("charter");
    // The MUTATION: pretend the carry always forced "anchor", exactly as the pre-fix `init.ts` did.
    const mutated = admittedJoineeIsland({
      hearthGatePubKey:  OWN_KEY,
      hearthIslandKind:  "anchor",       // ← forced, ignoring the founder's true kind
      hearthIslandScope: OWN_KEY,
      ownVesselKey:      JOINEE,
    });
    expect(mutated, "the mutation should reproduce the OLD, broken behavior").toBe(OWN_KEY);
    expect(mutated, "REVERT-VERIFY: the mutated read must NOT reach the charter board — proving the real fix is load-bearing")
      .not.toBe(CHARTER);
  });

  // ── THE WELD · `init.ts` must COMPOSE `admittedJoineeIsland`, not restate the ruling inline ────────
  test("WELD — `init.ts`'s admit-path composes `admittedJoineeIsland` and carries hearthIslandKind/Scope", async () => {
    const { readFileSync } = await import("node:fs");
    const initSrc  = readFileSync(new URL("../src/commands/init.ts", import.meta.url), "utf8");
    const admitSrc = readFileSync(new URL("../src/commands/device-admit.ts", import.meta.url), "utf8");
    const standingSrc = readFileSync(new URL("../src/nexus-standing.ts", import.meta.url), "utf8");
    const meshIdentitySrc = readFileSync(
      new URL("../../lararium-mesh/src/nexus-identity.ts", import.meta.url), "utf8");
    // `admittedJoineeIsland` moved to `@lararium/mesh/nexus-identity.ts` (Follow-on 1 — it composes only
    // `nexusIdentity`/`nexusScopeOrThrow` and touches no disk, so the browser leaf can import it with no
    // node dependency). `nexus-standing.ts` now RE-EXPORTS it so `init.ts`'s import path needs no change —
    // the weld below still pins that init.ts composes the shared resolution, never a restated inline copy.
    expect(meshIdentitySrc, "the composed resolver stands in mesh, platform-blind")
      .toMatch(/export function admittedJoineeIsland\(/);
    expect(standingSrc, "nexus-standing.ts re-exports it rather than restating it")
      .toMatch(/export \{ admittedJoineeIsland \} from "@lararium\/mesh";/);
    expect(initSrc, "init.ts composes the shared resolution rather than restating it").toMatch(/admittedJoineeIsland\(/);
    expect(admitSrc, "device-admit.ts carries the resolved kind").toMatch(/hearthIslandKind/);
    expect(admitSrc, "device-admit.ts carries the resolved scope").toMatch(/hearthIslandScope/);
    // The old defect's own spelling must not survive as the ONLY read: init.ts must not force
    // `anchorGateKey` straight off `hearthGatePubKey` outside of `admittedJoineeIsland`'s own body.
    const code = initSrc.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(code, "init.ts still forces anchorGateKey off hearthGatePubKey directly in the admit path")
      .not.toMatch(/anchorGateKey:\s*payload\.hearthGatePubKey/);
  });
});
