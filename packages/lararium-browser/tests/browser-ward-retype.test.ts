/**
 * browser-ward-retype — A WARD BINDS ONLY OVER A ROUTE TYPED TWICE ALIKE (row 7, S3b; seat-harness#/the-swarm-slices), in chromium.
 *
 * A ward MINT binds a fresh ward over the route the person types, and nothing reopens a ward bound over a typo: a mint asks its
 * route twice (`bind`, then `retype`) and binds only where both match; a mismatch refuses `ward-route-mismatch` and binds nothing.
 * An act over a ward that stands asks once (`open`). The dialog's words name the act truly: a bind binds, an open opens.
 * The tag door sweeps the face's sealed ward-key row from before the ward key moved under its own ward (alpha line, no shim).
 * Only the test-only entry seats the ward worker's spawn: a product caller's `spawn` reaches no door. A malformed face name refuses
 * in the browser's own refusal class.
 *
 * Reds: a typo'd retype binds; the old sealed row stays; a caller's spawn runs the act; a group holding "/" raises the mesh class.
 * Controls: a matching retype binds and its key opens under that route; an open asks once; the face's other rows stand.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/seat-harness#/the-swarm-slices
 */
import { bindFirstFaceSlot } from "../src/browser-face-custody.js";
import { expect, test } from "vitest";
import { browserKeystoreCustodyIo, BrowserWardRefused, readKeystoreRow, sealBrowserKeystore } from "../src/browser-custody.js";
import { browserVesselFaceTagDoor } from "../src/browser-face-atom.js";
import * as ward from "../src/browser-ward.js";
import { runWardAct } from "../src/ward-core.js";
import { keyed } from "../../lararium-mesh/tests/ward-cosign-table.js";

const PASS = "the route typed for this act";
const runs = { seated: 0, passed: 0 };
const core = (count: "seated" | "passed") => () => ({
  postMessage(_m: unknown, transfer: Transferable[]) { const port = transfer[0] as MessagePort; port.onmessage = async (m) => { runs[count]++; port.postMessage(await runWardAct(m.data)); }; },
  terminate() {},
});
const TESTING = "../src/testing.js";
const testing = await import(/* @vite-ignore */ TESTING).catch(() => null) as { seatWardWorkerSpawn(spawn: unknown): void } | null;
testing?.seatWardWorkerSpawn(core("seated"));

const codeOf = (p: Promise<unknown>): Promise<string | undefined> =>
  p.then(() => undefined, (e: { reading?: string; message: string }) => e.reading ?? /^[a-z-]+/.exec(e.message)?.[0] ?? e.message);

async function fresh() {
  const idbName = `lares:ward-retype-${globalThis.crypto.randomUUID()}`;
  await sealBrowserKeystore(idbName, { kind: "passphrase", passphrase: PASS });
  const G = `g-retype-${globalThis.crypto.randomUUID().slice(0, 8)}`;
  // The face's own tree binds before its first row (its tag secret rests there).
  await bindFirstFaceSlot(idbName, G, { kind: "passphrase", passphrase: PASS });
  return { idbName, io: browserKeystoreCustodyIo(idbName), G };
}

test("RED: a mint whose retype differs binds nothing and refuses `ward-route-mismatch`; CONTROL: a matching retype binds, its key opens under that route, and an open over the standing key asks once", async () => {
  const s = await fresh();
  const me = await keyed(91);
  const asked: [string, unknown][] = [];
  const typo = async (act: string, kind?: unknown) => { asked.push([act, kind]); return asked.length === 1 ? PASS : "the route typed fro this act"; };
  expect(await codeOf(browserVesselFaceTagDoor(s.idbName, { route: typo, spawn: core("passed") } as never)(s.G, me.key))).toBe("ward-route-mismatch");
  expect(asked.map(([, kind]) => kind)).toEqual(["bind", "retype"]);
  expect(await ward.browserWardKeyOf(s.idbName, s.G)).toBeNull();
  for (const row of ["slots", "seed", "public-key"]) expect(await s.io.read(`ward/sign/${s.G}/${row}`)).toBeNull();
  // the control: the same act retyped alike binds, and the key it binds signs under that route
  const kinds: unknown[] = [];
  const alike = async (_act: string, kind?: unknown) => { kinds.push(kind); return PASS; };
  const minted = await browserVesselFaceTagDoor(s.idbName, { route: alike, spawn: core("passed") } as never)(s.G, me.key);
  expect(kinds).toEqual(["bind", "retype"]);
  expect(await ward.browserWardKeyOf(s.idbName, s.G)).toBe(minted.wardKey);
  kinds.length = 0;
  const reread = await browserVesselFaceTagDoor(s.idbName, { route: alike, spawn: core("passed") } as never)(s.G, me.key);
  expect(reread.wardKey).toBe(minted.wardKey);
  expect(kinds).toEqual(["open"]);
});

test("RED: a face's ward-key mint asks its route twice and a mismatched retype binds none of the three `ward/sign/<group>` rows; CONTROL: a matching retype binds all three, and a retype that mismatches after a bound ward leaves them standing", async () => {
  const s = await fresh();
  const me = await keyed(94);
  const rows = ["slots", "seed", "public-key"];
  const bound = async () => Promise.all(rows.map(async (row) => (await s.io.read(`ward/sign/${s.G}/${row}`)) !== null));
  const asked: unknown[] = [];
  const typo = async (_act: string, kind?: unknown) => { asked.push(kind); return kind === "retype" ? "the route typed fro this act" : PASS; };
  expect(await codeOf(browserVesselFaceTagDoor(s.idbName, { route: typo, spawn: core("passed") } as never)(s.G, me.key))).toBe("ward-route-mismatch");
  expect(asked).toEqual(["bind", "retype"]);
  expect(await bound()).toEqual([false, false, false]);
  const alike = async () => PASS;
  await browserVesselFaceTagDoor(s.idbName, { route: alike, spawn: core("passed") } as never)(s.G, me.key);
  expect(await bound()).toEqual([true, true, true]);
  // a ward that stands asks once (`open`), so a typo'd retype never reaches it and the rows stay
  const again: unknown[] = [];
  await browserVesselFaceTagDoor(s.idbName, { route: async (_a: string, k?: unknown) => { again.push(k); return PASS; }, spawn: core("passed") } as never)(s.G, me.key);
  expect(again).toEqual(["open"]);
  expect(await bound()).toEqual([true, true, true]);
});

test("RED: the ward dialog's words name a bind as a bind; CONTROL: an open names an open, and neither says the other", () => {
  const words = (ward as unknown as { wardAskWords?: (act: string, kind: string) => string }).wardAskWords;
  expect(typeof words, "the browser names each ask's words by its kind").toBe("function");
  const bind = words!("the face's ward key", "bind"), retype = words!("the face's ward key", "retype"), open = words!("the admission's ward key proof", "open");
  expect(bind).toMatch(/bind a passphrase for this face's ward/);
  expect(bind).not.toMatch(/\bopens?\b/);
  expect(retype).toMatch(/again/);
  expect(open).toMatch(/\bopen/);
  expect(open).not.toMatch(/\bbind/);
});

test("RED: the face's sealed ward-key row from before the move stays on disk; CONTROL: the next tag ask sweeps it, and the tag row and the warded key rows stand", async () => {
  const s = await fresh();
  const me = await keyed(92);
  await s.io.write(`sealed/ward-sign/${s.G}`, new Uint8Array([7, 7, 7]));
  expect(await s.io.read(`sealed/ward-sign/${s.G}`)).not.toBeNull();
  const fields = await browserVesselFaceTagDoor(s.idbName, { route: async () => PASS, spawn: core("passed") } as never)(s.G, me.key);
  expect(await s.io.read(`sealed/ward-sign/${s.G}`)).toBeNull();
  expect(await readKeystoreRow(s.idbName, `vessel-face-tag/${s.G}`), "the tag row stands under the face's own tree").toBeInstanceOf(Uint8Array);
  expect(await ward.browserWardKeyOf(s.idbName, s.G)).toBe(fields.wardKey);
});

test("RED: a caller's `spawn` runs the tag door's ward act; CONTROL: only the test-only entry seats the worker, and the product index exports no seat", async () => {
  expect(testing, "the test-only entry seats the ward worker").not.toBeNull();
  const s = await fresh();
  const me = await keyed(93);
  runs.seated = 0; runs.passed = 0;
  await browserVesselFaceTagDoor(s.idbName, { route: async () => PASS, spawn: core("passed") } as never)(s.G, me.key);
  expect(runs.passed, "a product caller's spawn reaches no door").toBe(0);
  expect(runs.seated).toBe(1);
  const index = await import("../src/index.js") as Record<string, unknown>;
  expect(Object.keys(index).filter((k) => /spawn|seat/i.test(k) && /ward/i.test(k))).toEqual([]);
});

test("RED: a face name holding \"/\" raises the mesh's refusal class at the key read; CONTROL: it raises `BrowserWardRefused` by name at every ward-key door", async () => {
  const s = await fresh();
  const asClass = (p: Promise<unknown>) => p.then(() => "landed", (e: Error) => `${e.name}:${(e as { reading?: string }).reading ?? ""}`);
  const want = `BrowserWardRefused:ward-key-unnamed`;
  expect(await asClass(ward.browserWardKeyOf(s.idbName, "a/b"))).toBe(want);
  expect(await asClass(ward.browserWardKeySign(s.idbName, "a/b", PASS, new Uint8Array([1])))).toBe(want);
  expect(await asClass(ward.browserWardKeyMint(s.idbName, "a/b", "f".repeat(64), PASS))).toBe(want);
  expect(new BrowserWardRefused("x").name).toBe("BrowserWardRefused");
});
