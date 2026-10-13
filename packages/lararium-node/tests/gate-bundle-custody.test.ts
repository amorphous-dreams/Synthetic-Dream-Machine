/**
 * gate-bundle-custody — a gate's bundle derives from the SEALED custody root, through the custody holder's
 * own derive door, and rests nowhere.
 *
 * A harness stages a root (`tools/test-scratch-marker.mjs`, then `tools/seed-test-custody.mjs`), so the
 * custody tree, the vessel key and the sealed custody root all stand as a founding writes them. The bundle
 * then asks the holder for one registered child and derives its keys in memory.
 *
 * Proven:
 *   · CONTROL: an unlocked custody derives a bundle, and a second holder that opens the same tree derives
 *     the same pin (a restart changes nothing);
 *   · RED: a locked custody derives nothing: the vessel at its floor holds no gate key;
 *   · RED: two Nexuses under one custody share no key, and two custodies share none;
 *   · RED: the derivation writes no file: the staged root holds the same files before and after.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { deriveGateBundle } from "../../lararium-mesh/src/gate-bundle.js";
import { FsCustodyIo } from "../src/custody-io.js";
import { CustodyLocked, makeCustodyHolder, type CustodyHolder } from "../src/custody-holder.js";
import { seatCustody } from "../src/custody-seat.js";
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
    return holder;
  };
  return { root, holder: await open(), open };
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
  test("CONTROL: an unlocked custody derives a bundle, and a second holder over the same tree derives the same pin", async () => {
    const vessel = await staged();
    const first = deriveGateBundle(vessel.holder, AID_A, "/ws");
    expect(first.pin.route).toBe("/ws");
    await vessel.holder.lock();
    const again = deriveGateBundle(await vessel.open(), AID_A, "/ws");
    expect(again.pin).toEqual(first.pin);
    expect(again.knock).toBe(first.knock);
  });

  test("RED: a locked custody derives nothing: a vessel at its floor holds no gate key", async () => {
    const vessel = await staged();
    expect(deriveGateBundle(vessel.holder, AID_A, "/ws").pin.nexus.length).toBeGreaterThan(0);   // CONTROL: it derived while unlocked
    await vessel.holder.lock();
    expect(() => deriveGateBundle(vessel.holder, AID_A, "/ws")).toThrow(CustodyLocked);
  });

  test("RED: two Nexuses under one custody share no key, and two custodies share none", async () => {
    const one = await staged();
    const a = deriveGateBundle(one.holder, AID_A, "/ws");
    const b = deriveGateBundle(one.holder, AID_B, "/ws");
    const other = deriveGateBundle((await staged()).holder, AID_A, "/ws");
    const keys = [a, b, other].flatMap((bundle) => [bundle.pin.transportKey, bundle.pin.signingKey]);
    expect(new Set(keys).size).toBe(6);
    expect(new Set([a.knock, b.knock, other.knock]).size).toBe(3);
  });

  test("RED: a derivation rests nowhere: the staged root holds the same files before and after", async () => {
    const vessel = await staged();
    const before = census(vessel.root);
    expect(before.length).toBeGreaterThan(0);                                  // the census reads the staged tree
    const bundle = deriveGateBundle(vessel.holder, AID_A, "/ws");
    await bundle.sign(new Uint8Array(0)).catch(() => undefined);
    bundle.drop();
    expect(census(vessel.root)).toEqual(before);
  });
});
