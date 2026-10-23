/**
 * gate-bundle-custody — a gate's bundle derives through ONE OF TWO DOORS, one per tier, and rests nowhere.
 *
 * A harness stages a root (`tools/test-scratch-marker.mjs`, then `tools/seed-test-custody.mjs`), so the
 * custody tree, the vessel key and the sealed custody root all stand as a founding writes them, and a vessel
 * key mints inside the held custody. A SOVEREIGN bundle asks the custody seat's door (`custodyGateDoor`); a
 * FLOOR bundle asks the floor key's door (`vesselFloorKeyDoor`).
 *
 * Proven:
 *   · CONTROL: an unlocked custody derives a bundle, and a second holder that opens the same tree derives
 *     the same pin (a restart changes nothing);
 *   · RED: a locked vessel derives every FLOOR bundle through the real floor door and no SOVEREIGN one;
 *   · RED: the two doors never pass for each other: the types refuse the swap, a door of the other tier
 *     refuses by name (`door-other-tier`), a door no seat minted refuses the same way, and a door dressed over
 *     the other root's derive refuses at that root (each root refuses the other tier's child by name);
 *   · RED: the two tiers' pins for one Nexus share nothing, and neither moves when the other root changes;
 *   · RED: the floor door answers a fresh buffer per call, never the floor key, and only registered names;
 *   · RED: two Nexuses under one custody share no key, and two custodies share none;
 *   · RED: the derivation writes no file: the staged root holds the same files before and after.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { GATE_BUNDLE_INFO, GATE_FLOOR_BUNDLE_INFO } from "@lararium/mesh";
import {
  GateBundleRefused, custodyRootDoor, deriveGateBundle, floorGateRoot, floorKeyDoor, floorRoute, sovereignGateRoot, sovereignRoute,
} from "../../lararium-mesh/src/gate-bundle.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { CustodyLocked, makeCustodyHolder, type CustodyHolder } from "../src/custody-holder.js";
import { CustodyRootRefused } from "../src/custody-root.js";
import { custodyGateDoor, seatCustody } from "../src/custody-seat.js";
import { FloorKeyDoorRefused, generateOrLoadVesselIdentity, loadVesselSigningSeed, vesselFloorKeyDoor } from "../src/node-vessel-identity.js";
import { vesselCustodyHomes } from "../src/vault-carriers.js";

const repoRoot = resolve(new URL(".", import.meta.url).pathname, "../../..");
/** The published test route a staged root's custody answers (`tools/test-custody-route.mjs`). */
const STAGED_ROUTE = "test-founding-passphrase";
const AID_A = new TextEncoder().encode("nexus-aaaaaaaaaaaaaaaa");
const AID_B = new TextEncoder().encode("nexus-bbbbbbbbbbbbbbbb");

let priorRoot: string | undefined;
const roots: string[] = [];

/** Stage a root as a harness does, and open a holder over its custody. */
async function staged(): Promise<{ root: string; holder: CustodyHolder; open(): Promise<CustodyHolder> }> {
  const root = mkdtempSync(join(tmpdir(), "gate-bundle-custody-"));
  roots.push(root);
  for (const tool of ["test-scratch-marker.mjs", "seed-test-custody.mjs"]) {
    execFileSync("node", [join(repoRoot, "tools", tool), root], { env: { ...process.env, LAR_ROOT: root }, stdio: "pipe" });
  }
  const open = async (): Promise<CustodyHolder> => {
    process.env["LAR_ROOT"] = root;
    const homes = vesselCustodyHomes();
    const holder = makeCustodyHolder({ io: new FsCustodyIo(homes), homes });
    const opened = await holder.unlock([{ kind: "passphrase", passphrase: STAGED_ROUTE }]);
    if (opened.reading !== "opens") throw new Error(`the staged custody reads ${opened.reading}`);
    // The seat holds this root's holder: `custodyGateDoor` asks the seat of the home `LAR_ROOT` names.
    seatCustody(holder);
    return holder;
  };
  const holder = await open();
  await generateOrLoadVesselIdentity();   // the floor key mints inside the held custody, as a founding mints it
  return { root, holder, open };
}

/** Every file under a root, with its size: what a derivation must leave exactly as it found it. */
function census(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) census(path, out); else out.push(`${path}:${stat.size}`);
  }
  return out;
}

beforeAll(() => { priorRoot = process.env["LAR_ROOT"]; seatCustody(null); });
afterAll(() => {
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

describe("a gate bundle over a staged custody", { timeout: 180_000 }, () => {
  const sovereign = () => sovereignGateRoot(custodyGateDoor());
  const floor = async () => floorGateRoot(await vesselFloorKeyDoor());

  test("CONTROL: an unlocked custody derives a bundle, and a second holder over the same tree derives the same pin", async () => {
    const vessel = await staged();
    const first = deriveGateBundle(sovereign(), AID_A, sovereignRoute("/ws"));
    expect(first.pin.route).toBe("/ws");
    await vessel.holder.lock();
    await vessel.open();
    const again = deriveGateBundle(sovereign(), AID_A, sovereignRoute("/ws"));
    expect(again.pin).toEqual(first.pin);
    expect(again.knock).toBe(first.knock);
  });

  test("RED: a locked vessel derives every floor bundle through the real floor door and no sovereign one", async () => {
    const vessel = await staged();
    const whileRaised = deriveGateBundle(await floor(), AID_A, floorRoute("/flow")).pin;
    expect(deriveGateBundle(sovereign(), AID_A, sovereignRoute("/ws")).pin.nexus.length).toBeGreaterThan(0);   // CONTROL: it derived while unlocked
    await vessel.holder.lock();
    expect(() => deriveGateBundle(sovereign(), AID_A, sovereignRoute("/ws"))).toThrow(CustodyLocked);
    for (const path of ["/shelf", "/flow", "/announce", "/relay"]) expect(deriveGateBundle(await floor(), AID_A, floorRoute(path)).pin.tier).toBe("floor");
    expect(deriveGateBundle(await floor(), AID_A, floorRoute("/flow")).pin).toEqual(whileRaised);            // the same floor pin, locked or raised
    // No seat at all reads as locked: the door opens nothing and asks nobody.
    seatCustody(null);
    expect(() => deriveGateBundle(sovereign(), AID_A, sovereignRoute("/ws"))).toThrow(CustodyLocked);
    expect(deriveGateBundle(await floor(), AID_A, floorRoute("/flow")).pin).toEqual(whileRaised);
  });

  test("RED: the two doors never pass for each other, by type, by mint and by root", async () => {
    await staged();
    const custodyDoor = custodyGateDoor();
    const floorDoor = await vesselFloorKeyDoor();
    // BY TYPE: each line below fails to compile without its directive, and refuses by name where it runs.
    // @ts-expect-error the custody root's door never stands under the floor tier
    expect(() => floorGateRoot(custodyDoor)).toThrow(GateBundleRefused);
    // @ts-expect-error the floor key's door never stands under the sovereign tier
    expect(() => sovereignGateRoot(floorDoor)).toThrow(GateBundleRefused);
    expect((() => { try { floorGateRoot(custodyDoor as never); return null; } catch (e) { return (e as GateBundleRefused).refusal; } })()).toBe("door-other-tier");
    expect((() => { try { sovereignGateRoot(floorDoor as never); return null; } catch (e) { return (e as GateBundleRefused).refusal; } })()).toBe("door-other-tier");
    // BY MINT: a value dressed as a door, which no seat minted, refuses the same way.
    expect(() => floorGateRoot({ root: "floor-key", derive: custodyDoor.derive })).toThrow(/door-other-tier/);
    expect(() => sovereignGateRoot({ root: "custody-root", derive: floorDoor.derive })).toThrow(/door-other-tier/);
    // BY ROOT: a door minted over the other root's derive stands as a root and derives nothing, since each
    // root refuses the other tier's child by name.
    const dressedFloor = floorGateRoot(floorKeyDoor(custodyDoor));
    expect(() => deriveGateBundle(dressedFloor, AID_A, floorRoute("/flow"))).toThrow(CustodyRootRefused);
    const dressedSovereign = sovereignGateRoot(custodyRootDoor(floorDoor));
    expect(() => deriveGateBundle(dressedSovereign, AID_A, sovereignRoute("/ws"))).toThrow(FloorKeyDoorRefused);
    // CONTROL: each door under its own tier derives.
    expect(deriveGateBundle(floorGateRoot(floorDoor), AID_A, floorRoute("/flow")).pin.tier).toBe("floor");
    expect(deriveGateBundle(sovereignGateRoot(custodyDoor), AID_A, sovereignRoute("/ws")).pin.tier).toBe("sovereign");
  });

  test("RED: the two tiers' pins for one Nexus share nothing", async () => {
    await staged();
    const f = deriveGateBundle(await floor(), AID_A, floorRoute("/ws"));
    const s = deriveGateBundle(sovereign(), AID_A, sovereignRoute("/ws"));
    const keys = [f.pin.transportKey, f.pin.signingKey, s.pin.transportKey, s.pin.signingKey];
    expect(new Set(keys).size).toBe(4);
    expect(f.knock).not.toBe(s.knock);
    // The two children a pin's keys grow from differ too: no name of one root answers under the other.
    const floorChild = (await vesselFloorKeyDoor()).derive(GATE_FLOOR_BUNDLE_INFO);
    const custodyChild = custodyGateDoor().derive(GATE_BUNDLE_INFO);
    expect(Buffer.from(floorChild).equals(Buffer.from(custodyChild))).toBe(false);
  });

  test("RED: the floor door answers a fresh buffer per call, never the floor key, and only a registered name", async () => {
    await staged();
    const door = await vesselFloorKeyDoor();
    const one = door.derive(GATE_FLOOR_BUNDLE_INFO);
    const two = door.derive(GATE_FLOOR_BUNDLE_INFO);
    expect(one).not.toBe(two);
    expect(Buffer.from(one).equals(Buffer.from(two))).toBe(true);
    one.fill(0);                                                             // the caller overwrites what it received …
    expect(Buffer.from(door.derive(GATE_FLOOR_BUNDLE_INFO)).equals(Buffer.from(two))).toBe(true);   // … and the next call answers whole
    const seed = await loadVesselSigningSeed();
    expect(seed.length).toBe(32);                                            // CONTROL: the comparison below reads a real key
    expect(Buffer.from(two).equals(Buffer.from(seed))).toBe(false);
    expect(() => door.derive("lar:///ha.ka.ba/api/v0.1/pono/no-such-name")).toThrow(FloorKeyDoorRefused);
    expect(() => door.derive(GATE_BUNDLE_INFO)).toThrow(FloorKeyDoorRefused);
  });

  test("RED: two Nexuses under one custody share no key, and two custodies share none", async () => {
    await staged();
    const a = deriveGateBundle(sovereign(), AID_A, sovereignRoute("/ws"));
    const b = deriveGateBundle(sovereign(), AID_B, sovereignRoute("/ws"));
    const fa = deriveGateBundle(await floor(), AID_A, floorRoute("/flow"));
    await staged();
    const other = deriveGateBundle(sovereign(), AID_A, sovereignRoute("/ws"));
    const fother = deriveGateBundle(await floor(), AID_A, floorRoute("/flow"));
    const keys = [a, b, other, fa, fother].flatMap((bundle) => [bundle.pin.transportKey, bundle.pin.signingKey]);
    expect(new Set(keys).size).toBe(10);
    expect(new Set([a.knock, b.knock, other.knock, fa.knock, fother.knock]).size).toBe(5);
  });

  test("RED: a derivation rests nowhere: the staged root holds the same files before and after", async () => {
    const vessel = await staged();
    const before = census(vessel.root);
    expect(before.length).toBeGreaterThan(0);                                  // the census reads the staged tree
    const bundle = deriveGateBundle(sovereign(), AID_A, sovereignRoute("/ws"));
    await bundle.sign(new Uint8Array(0)).catch(() => undefined);
    bundle.drop();
    deriveGateBundle(await floor(), AID_A, floorRoute("/flow")).drop();
    expect(census(vessel.root)).toEqual(before);
  });
});
