/**
 * sealed-act-door — a command's sealed act rides the standing vessel's custody door, and no second key session opens.
 *
 * A vessel stands here as its main thread composes it: a store claim, the verb socket's front, and the custody
 * door ahead of every verb. Its acts answer from a stand-in table, so nothing this "vessel" answers touches the
 * command's own custody seat: whatever opens that seat, the COMMAND opened.
 *
 *   D1  RED: `lares persona list` beside a standing, unlocked vessel opens NO key session of its own: the
 *       published test route never fires, the command's seat stays locked, and the roster it prints came through
 *       act frames.               control: with no vessel standing the same command opens its own session once
 *   D2  RED: a sealed row read in the command's own process beside a standing vessel refuses by name and opens
 *       nothing: an unlocked vessel "holds the key session", a locked one names `lares vault unlock`.
 *                                 control: with no vessel standing the same read opens by the test route
 *   D3  a vessel's refusal returns under the class the same act throws in process (`CustodyLocked`,
 *       `CustodyRowUnavailable`, `SealedActRefused`), and the frame a command sends holds `op`, `act` and `args`
 *       alone.
 *   D4  another command holding the store for one act answers no custody door: the act runs in this process.
 *   D5  RED: a root split never rides a standing vessel: `persona new --split-root` beside one, unlocked or locked,
 *       refuses before anything founds, and the vessel hears a `custody` probe and nothing else.
 *                                 control: the table names no act that answers a share
 *   D6  RED: THE FLEET MIRROR SENDS NO VERB. A pet-name set and a Handle declared through the fleet-mirroring stores
 *       beside a standing vessel reach it as act frames alone, and the carry frames hold a face's index and which
 *       name, never the name. No source file of the command line names a verb that takes or answers a face's own
 *       name.                     control: the sealed write's own frame holds the name (the search finds it there),
 *                                 and with no vessel standing the carry refuses by name while the sealed row keeps
 *                                 the name
 *   D7  `lares persona sync` FILLS: each held name rides one `selves.carry` frame marked `fill`, so a name the
 *       face's plane already holds stands, and the command says which names landed and which the fleet kept.
 *                                 control: a rename (`makeFleetPetnameStore.set`) sends its carry with no `fill`
 *   D11 RED: A CLEAR PLANE OUTRANKS NO SEALED ROW. While `selves.read` names its rest `clear`, the fleet stores read
 *       the sealed row first, so a re-lit label reads over a name an older vessel left on the plane.
 *                                 control: with the rest `sealed`, the plane's name outranks the device's copy
 *   D8  RED: A SEAT'S KEY NEVER CROSSES THE DOOR. `lares nexus seal seat` beside a standing vessel sends an arming
 *       frame that carries no key and asks whether the read-back stands in; it takes public halves back, mints each
 *       chair's cold card in its own process, and opens no key session of its own. No frame carries a card.
 *                                 control: the charter the command wrote seats exactly the halves the door answered
 *   D9  RED: A CARRIED INVITE RIDES NO VERB. `lares walk`, `walk take` and `walk invite` beside a standing vessel
 *       send act frames alone (`walk.state`, `walk.take`, `walk.invite`); the invite a person carries in, and the
 *       one the wallet hands out, appear in no frame that names a verb, and the command opens no key session.
 *       A vessel's refusal of a take reads as the walk door's own refusal (exit code and words).
 *                                 control: the take's act frame holds the carried invite, and the command
 *                                 prints `via: daemon` as every store door does
 *   D10 RED: A HOST INVITE RIDES NO VERB. `lares host`, `host roll` and `host invite` beside a standing vessel send
 *       act frames alone (`host.state`, `host.roll`, `host.invite`); the invite the hearth mints appears in no
 *       frame, and the command opens no key session. A vessel's refusal of a roll reads as the hosting door's own
 *       refusal (exit code and words).
 *                                 control: the roll's act frame holds its Nexus and its cap, and nothing else
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import type { Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CustodyLocked, CustodyRowUnavailable, FsCustodyIo, SEALED_ACT_NAMES, SealedActRefused, claimStore, custodyFrameHandler, foundCustody,
  larDataDir, larSealHome, loadIdentityAnchors, makeCustodyHolder, persistIdentityAnchors, readNexusDoc, seatCustody, seatedCustody, serveUdsFront,
  vesselCustodyHomes, type CustodyHolder,
} from "@lararium/node";
import { foundingRoster } from "@lararium/mesh";
import { dispatch } from "../src/bin/lares.js";
import { OfflineCustodyRefused, seatOfflineCustody, TEST_ROUTE_PASSPHRASE, TEST_SCRATCH_MARKER } from "../src/offline-custody.js";
import { sealedActVia } from "../src/sealed-act-door.js";
import { carryOwnName, clearOwnName, makeFleetDeclarationStore, makeFleetPetnameStore, readFleetSelves } from "../src/daemon-persona-store.js";
import { sealedDeclarationStore, sealedPetnameStore } from "../src/sealed-rows.js";

vi.setConfig({ testTimeout: 180_000, hookTimeout: 180_000 });

const ANCHORS = { personaGroupId: "aa11", meshCabalDocIdHex: "bb22" };
const KEY = "ab".repeat(32);
const downs: Array<() => Promise<void>> = [];
let priorRoot: string | undefined;

/** A marked scratch root with custody founded under the published test route and one sealed row; nothing stays seated. */
async function stage(): Promise<string> {
  const root = mkdtempSync(join(tmpdir(), "lar-sealed-act-door-"));
  downs.push(async () => { rmSync(root, { recursive: true, force: true }); });
  process.env["LAR_ROOT"] = root;
  writeFileSync(join(root, TEST_SCRATCH_MARKER), "staged by sealed-act-door.test\n");
  const homes = vesselCustodyHomes();
  mkdirSync(homes.identity, { recursive: true, mode: 0o700 });
  const io = new FsCustodyIo(homes);
  const founded = await foundCustody({ io, homes, slots: [{ t: 1, pins: [{ kind: "passphrase", passphrase: TEST_ROUTE_PASSPHRASE }] }] });
  const holder = makeCustodyHolder({ io, homes });
  await holder.adopt(founded.vk);
  seatCustody(holder);
  await persistIdentityAnchors(ANCHORS);
  await holder.lock();
  seatCustody(null);
  return root;
}

/** A vessel on this root's store: claim, front, custody door. Its acts answer from `table`, or refuse as `table` throws. */
async function standVessel(opts: { unlocked: boolean; table?: (act: string, args: unknown) => Record<string, unknown> }) {
  const frames: unknown[] = [];
  const acts: string[] = [];
  const holder = { isUnlocked: () => opts.unlocked, openedSlot: () => (opts.unlocked ? "slot-1" : null), attemptsLeft: () => 3 } as unknown as CustodyHolder;
  const door = custodyFrameHandler({
    holder, testScratch: true, standing: () => "hearth", recompose: async () => ({ standing: "hearth" }), onLog: () => {},
    runAct: async (act, args) => { acts.push(act); return (opts.table ?? answers)(act, args); },
  });
  mkdirSync(larDataDir(), { recursive: true });
  const claim = await claimStore(larDataDir(), { holder: "vessel" });
  const front = serveUdsFront({ claim, onFrame: (parsed: unknown, sock: Socket) => { frames.push(parsed); return door(parsed, sock); } });
  for (let i = 0; i < 200 && !existsSync(claim.socketPath); i++) await new Promise((r) => setTimeout(r, 10));
  const down = async (): Promise<void> => { front.close(); await claim.release(); };
  downs.push(down);
  return { frames, acts, down };
}

/** What the stand-in vessel answers: one face, named and worn. */
function answers(act: string): Record<string, unknown> {
  if (act === "persona.roots") return { roots: [{ handleIndex: 0, verifyingKey: KEY }], active: 0, orphans: [] };
  if (act === "petname.entries") return { entries: [[0, "the-face-the-vessel-holds"]] };
  if (act === "declaration.entries") return { entries: [] };
  return {};
}

beforeEach(() => { priorRoot = process.env["LAR_ROOT"]; seatCustody(null); });
afterEach(async () => {
  const held = seatedCustody();
  if (held) await held.lock();
  seatCustody(null);
  vi.restoreAllMocks();
  for (const down of downs.splice(0).reverse()) await down().catch(() => {});
  if (priorRoot === undefined) delete process.env["LAR_ROOT"]; else process.env["LAR_ROOT"] = priorRoot;
});

/** Run one command through the dispatcher, capturing what it prints. */
async function run(argv: string[]): Promise<{ code: number; out: string; err: string }> {
  const out: string[] = [], err: string[] = [];
  vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => { out.push(a.map(String).join(" ")); });
  vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => { err.push(a.map(String).join(" ")); });
  vi.spyOn(process.stderr, "write").mockImplementation((chunk: unknown) => { err.push(String(chunk)); return true; });
  vi.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => { out.push(String(chunk)); return true; });
  const code = await dispatch(argv);
  vi.restoreAllMocks();
  return { code, out: out.join("\n"), err: err.join("\n") };
}

describe("a command beside a standing vessel", () => {
  test("D1 — persona list opens no key session of its own: its roster rides act frames", async () => {
    await stage();
    const vessel = await standVessel({ unlocked: true });
    const beside = await run(["persona", "list"]);
    expect(beside.err).not.toContain("opening the vessel key");               // the published test route never fired
    expect(beside.err).not.toContain("TEST SCRATCH ROOT");
    expect(seatedCustody()?.isUnlocked() ?? false, "the command's own seat stays locked").toBe(false);
    expect(beside.code).toBe(0);
    expect(beside.out).toContain("the-face-the-vessel-holds");                // what it printed came from the vessel
    expect(vessel.acts).toEqual(expect.arrayContaining(["persona.roots", "petname.entries", "declaration.entries"]));
    // The command asked for nothing beside acts, and each frame held `op`, `act` and `args` alone.
    for (const frame of vessel.frames) expect(Object.keys(frame as object).sort()).toEqual(["act", "args", "op"]);

    // CONTROL: the vessel leaves, and the same command opens its own session once, by the test route.
    await vessel.down();
    seatCustody(null);
    const alone = await run(["persona", "list"]);
    expect(alone.code).toBe(0);
    expect(alone.err).toContain("TEST SCRATCH ROOT");
    expect(alone.out).not.toContain("the-face-the-vessel-holds");             // it read its own (empty) rows
    expect(seatedCustody()!.isUnlocked()).toBe(true);
  });

  test("D2 — a sealed row read in the command's own process beside a vessel refuses by name and opens nothing", async () => {
    await stage();
    const unlocked = await standVessel({ unlocked: true });
    seatOfflineCustody();
    const beside = await loadIdentityAnchors().catch((e: unknown) => e);
    expect(beside).toBeInstanceOf(OfflineCustodyRefused);
    expect((beside as Error).message).toContain("holds the key session");
    expect(seatedCustody()!.isUnlocked()).toBe(false);
    await unlocked.down();

    seatCustody(null);
    const locked = await standVessel({ unlocked: false });
    seatOfflineCustody();
    const atFloor = await loadIdentityAnchors().catch((e: unknown) => e);
    expect(atFloor).toBeInstanceOf(OfflineCustodyRefused);
    expect((atFloor as Error).message).toContain("lares vault unlock");
    expect(seatedCustody()!.isUnlocked()).toBe(false);
    await locked.down();

    // CONTROL: no vessel stands, and the same read opens by the test route.
    seatCustody(null);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    seatOfflineCustody();
    expect(await loadIdentityAnchors()).toEqual(ANCHORS);
    expect(seatedCustody()!.isUnlocked()).toBe(true);
  });

  test("D3 — a vessel's refusal returns under its own class", async () => {
    await stage();
    const locked = await standVessel({ unlocked: false });
    await expect(sealedActVia("persona.roots")).rejects.toBeInstanceOf(CustodyLocked);
    expect(locked.acts).toEqual([]);                                          // a locked vessel ran nothing
    await locked.down();

    const vessel = await standVessel({ unlocked: true, table: (act) => {
      if (act === "persona.roots") throw new CustodyRowUnavailable("identity", ".persona-roster.json", "torn");
      if (act === "persona.wear") throw new SealedActRefused("act-refused", "this vessel holds no persona root there");
      if (act === "persona.reissue") throw new Error("a plain fault");
      return { ran: act };
    } });
    const torn = await sealedActVia("persona.roots").catch((e: unknown) => e);
    expect(torn).toBeInstanceOf(CustodyRowUnavailable);
    expect(torn).toMatchObject({ home: "identity", file: ".persona-roster.json", reading: "torn" });
    const refused = await sealedActVia("persona.wear", { handleIndex: 4 }).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(SealedActRefused);
    expect(refused).toMatchObject({ reason: "act-refused", message: "this vessel holds no persona root there" });
    await expect(sealedActVia("persona.reissue")).rejects.toThrow("a plain fault");
    expect(await sealedActVia("petname.entries")).toEqual({ result: { ran: "petname.entries" }, via: "vessel" });   // CONTROL
    for (const frame of vessel.frames) expect(Object.keys(frame as object).sort()).toEqual(["act", "args", "op"]);
  });

  test("D4 — a command that holds the store for one act answers no custody door: the act runs here", async () => {
    await stage();
    mkdirSync(larDataDir(), { recursive: true });
    const direct = await claimStore(larDataDir(), { holder: "direct" });
    downs.push(() => direct.release());
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    seatOfflineCustody();
    const ran = await sealedActVia("petname.entries");
    expect(ran).toEqual({ result: { entries: [] }, via: "direct" });
    expect(seatedCustody()!.isUnlocked()).toBe(true);                         // this process opened its own session, once
  });

  test("D5 — a root split never rides a standing vessel", async () => {
    await stage();
    for (const unlocked of [true, false]) {
      const vessel = await standVessel({ unlocked });
      const r = await run(["persona", "new", "0", "--name", "a-synthetic-face", "--split-root"]);
      expect(r.code).not.toBe(0);
      expect(r.out + r.err).toContain("never rides a standing vessel");
      expect(r.out + r.err).not.toMatch(/recorded-code|escrow-carrier/);          // no share printed
      expect(vessel.acts).toEqual([]);                                             // nothing ran inside the vessel
      expect(vessel.frames).toEqual([{ op: "custody" }]);                          // it heard the probe and nothing else: no verb founded a face
      expect(seatedCustody()?.isUnlocked() ?? false).toBe(false);                  // and the command opened no session
      await vessel.down();
      seatCustody(null);
    }
    expect(SEALED_ACT_NAMES.filter((n) => /recover|share|split/i.test(n))).toEqual([]);   // CONTROL: no act could have answered one
  });

  test("D6 — the fleet mirror sends act frames alone, and its carry frames hold no name", async () => {
    await stage();
    const PETNAME = `the-quiet-compartment-${Math.random().toString(36).slice(2)}`;
    const HANDLE = `The Lindwyrm ${Math.random().toString(36).slice(2)}`;
    const vessel = await standVessel({ unlocked: true, table: (act, args) => (
      act === "selves.read" ? { selves: [] } : act.endsWith(".entries") ? { entries: [] }
        : act === "selves.carry" ? { carried: (args as { fill?: boolean }).fill !== true } : act === "selves.clear" ? { cleared: true } : {}) });
    await makeFleetPetnameStore(sealedPetnameStore()).set(0, PETNAME);
    await makeFleetDeclarationStore(sealedDeclarationStore()).set(0, { handle: HANDLE, seat: true, chair: "a private chair" });
    await makeFleetPetnameStore(sealedPetnameStore()).clear(0);
    expect(await readFleetSelves()).toEqual({ reached: true, selves: [], rest: "clear" });
    const frames = vessel.frames as Array<Record<string, unknown>>;
    // RED: nothing rode a verb. Every frame names `op: "act"`, and none carries a verb, a requester or a request id.
    for (const frame of frames) {
      expect(frame["op"]).toBe("act");
      expect(Object.keys(frame).sort()).toEqual(["act", "args", "op"]);
    }
    expect(frames.map((f) => f["act"])).toEqual(["petname.set", "selves.carry", "declaration.set", "selves.carry", "petname.clear", "selves.clear", "selves.read"]);
    const carries = frames.filter((f) => String(f["act"]).startsWith("selves."));
    expect(carries.map((f) => f["args"])).toEqual([{ handleIndex: 0, name: "petname" }, { handleIndex: 0, name: "handle" }, { handleIndex: 0, name: "petname" }, {}]);
    // A MOVE REPORTS WHAT THE PLANE DID: it landed, or the plane kept what it held (a fill over a standing name).
    expect(await carryOwnName(0, "petname")).toEqual({ landed: true });
    expect(await carryOwnName(0, "petname", { fill: true })).toEqual({ landed: false, kept: true });
    expect(await clearOwnName(0, "handle")).toEqual({ landed: true });
    expect((vessel.frames as Array<Record<string, unknown>>).slice(-3).map((f) => f["args"])).toEqual([
      { handleIndex: 0, name: "petname" }, { handleIndex: 0, name: "petname", fill: true }, { handleIndex: 0, name: "handle" },
    ]);
    for (const text of [PETNAME, HANDLE, "a private chair"]) expect(JSON.stringify(carries).includes(text)).toBe(false);
    // CONTROL: the search finds a name where one rides: the sealed write's own frame holds it.
    expect(JSON.stringify(frames.filter((f) => f["act"] === "petname.set")).includes(PETNAME)).toBe(true);
    await vessel.down();

    // No source file of the command line names a verb that takes or answers a face's own name.
    const SRC = new URL("../src/", import.meta.url).pathname;
    const files: string[] = [];
    const walk = (dir: string): void => { for (const e of readdirSync(dir)) { const p = join(dir, e); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".ts")) files.push(p); } };
    walk(SRC);
    expect(files.length).toBeGreaterThan(50);
    const naming = files.filter((f) => /["'`]persona-(?:label|handle|selves)["'`]/.test(readFileSync(f, "utf8")));
    expect(naming.map((f) => f.slice(SRC.length))).toEqual([]);
    expect(/["'`]persona-(?:label|handle|selves)["'`]/.test('runVerb("persona-label", {})')).toBe(true);   // CONTROL: the pattern bites

    // CONTROL: with no vessel standing the carry refuses by name, a mirror reports and never throws, and the sealed row keeps the name.
    seatCustody(null);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    seatOfflineCustody();
    const alone = makeFleetPetnameStore(sealedPetnameStore());
    await alone.set(1, PETNAME);
    expect(await carryOwnName(1, "petname")).toMatchObject({ landed: false, kept: false, why: expect.stringMatching(/no persona plane stands here/) });
    expect(await readFleetSelves()).toMatchObject({ reached: false });
    expect(await alone.get(1)).toBe(PETNAME);
  });

  test("D7 — persona sync fills, and says which names landed and which the fleet kept", async () => {
    await stage();
    const vessel = await standVessel({ unlocked: true, table: (act, args) => {
      if (act === "selves.read") return { selves: [{ handleIndex: 1, petname: "a-fleet-mates-newer-name" }], rest: "sealed" };
      if (act === "petname.entries") return { entries: [[0, "the-work-face"], [1, "an-old-local-name"]] };
      if (act === "declaration.entries") return { entries: [] };
      if (act === "selves.carry") return { carried: (args as { handleIndex: number }).handleIndex === 0 };   // the plane keeps h1's name
      return {};
    } });
    const r = await run(["persona", "sync"]);
    expect(r.code).toBe(0);
    const carries = (vessel.frames as Array<Record<string, unknown>>).filter((f) => f["act"] === "selves.carry").map((f) => f["args"]);
    expect(carries).toEqual([{ handleIndex: 0, name: "petname", fill: true }, { handleIndex: 1, name: "petname", fill: true }]);
    const said = (JSON.parse(r.out) as { data: { carried: Array<{ handleIndex: number; petnameLanded: boolean }> } }).data.carried;
    expect(said.map((c) => [c.handleIndex, c.petnameLanded])).toEqual([[0, true], [1, false]]);   // h1's name stayed the fleet's
    // CONTROL: a rename carries with no `fill`, so it replaces.
    await makeFleetPetnameStore(sealedPetnameStore()).set(1, "a-rename-on-this-device");
    expect((vessel.frames as Array<Record<string, unknown>>).filter((f) => f["act"] === "selves.carry").pop()!["args"]).toEqual({ handleIndex: 1, name: "petname" });
  });

  test("D11 — a plane whose rest stands clear holds no name a read trusts: the sealed row reads first", async () => {
    await stage();
    let rest = "clear";
    const vessel = await standVessel({ unlocked: true, table: (act) => {
      if (act === "selves.read") return { selves: [{ handleIndex: 1, petname: "an-older-vessels-label", handle: "An Older Handle" }], rest };
      if (act === "petname.entries") return { entries: [[1, "the-re-lit-label"]] };
      if (act === "declaration.entries") return { entries: [[1, { handle: "The Re-lit Handle" }]] };
      return {};
    } });
    const petnames = makeFleetPetnameStore(sealedPetnameStore());
    const declarations = makeFleetDeclarationStore(sealedDeclarationStore());
    // RED: a re-light lands on the sealed row; a name an older vessel left on a clear plane never outranks it.
    expect(await readFleetSelves()).toMatchObject({ reached: true, rest: "clear" });
    expect(await petnames.get(1)).toBe("the-re-lit-label");
    expect(await petnames.entries()).toEqual([[1, "the-re-lit-label"]]);
    expect((await declarations.get(1))?.handle).toBe("The Re-lit Handle");
    // CONTROL: over a plane whose rest seals, the fleet's name outranks this device's copy.
    rest = "sealed";
    expect(await petnames.get(1)).toBe("an-older-vessels-label");
    expect((await declarations.get(1))?.handle).toBe("An Older Handle");
    await vessel.down();
  });

  test("D8 — the seat rite arms behind the door: one frame out, public halves back, no key crosses", async () => {
    await stage();
    const { getPublicKeyAsync } = await import("@noble/ed25519");
    const keys = await Promise.all([1, 2, 3].map(async (i) => Buffer.from(await getPublicKeyAsync(new Uint8Array(32).fill(40 + i))).toString("hex")));
    // The stub door signs each seat's inception with that seat's seed, as a vessel's door signs it with the seat row.
    const { createPrivateKey, sign } = await import("node:crypto");
    const seatSign = (seat: string, image: string): string => Buffer.from(sign(null, Buffer.from(image, "hex"), createPrivateKey({
      key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), Buffer.alloc(32, 41 + keys.indexOf(seat))]), format: "der", type: "pkcs8" }))).toString("hex");
    const vessel = await standVessel({ unlocked: true, table: (act, args) => {
      if (act === "seat.arm-genesis") return { kahu: keys.map((verifyingKey, i) => ({ chairLabel: `Chair ${i}`, verifyingKey })), seatedKeys: keys, threshold: 2, superseded: [], minted: keys };
      if (act === "seat.readback-stand-in") return { standIn: true };
      if (act === "seal.incept") { const { seat, image } = args as { seat: string; image: string }; return { signer: seat, sig: seatSign(seat, image) }; }
      return {};
    } });
    const r = await run(["nexus", "seal", "seat", "--json"]);
    expect(r.code).toBe(0);
    expect(seatedCustody()?.isUnlocked() ?? false, "the command's own seat stays locked").toBe(false);
    const frames = vessel.frames as Array<{ act: string; args: Record<string, unknown> }>;
    // The arming, the read-back stand-in, then one inception frame per seat: each carries the seat's public key and
    // the image alone, after the cards read back.
    expect(frames.map((f) => f.act)).toEqual(["seat.arm-genesis", "seat.readback-stand-in", "seal.incept", "seal.incept", "seal.incept"]);
    for (const f of frames.slice(2)) expect(Object.keys(f.args).sort()).toEqual(["image", "seat"]);
    expect(frames.slice(2).map((f) => f.args["seat"]).sort()).toEqual([...keys].sort());
    expect(frames[0]!.args).toEqual({});                                             // the arming takes no key and no commitment
    const printed = (JSON.parse(r.out.trim().split("\n").at(-1)!) as { data: { cards: Array<{ code: string }> } }).data.cards;
    expect(printed).toHaveLength(3);                                                 // one card per chair, printed by the command
    for (const card of printed) expect(JSON.stringify(frames)).not.toContain(card.code.replace(/-/g, "").slice(0, 16));
    // CONTROL: the charter the command wrote seats exactly the public halves the door answered.
    expect(readNexusDoc(larSealHome())!.kahu.map((k) => k.verifyingKey)).toEqual(keys);
    expect(foundingRoster(readNexusDoc(larSealHome())).keys).toEqual([...keys].sort());   // the genesis reads: every seat incepted
  });

  test("D9 — the walk commands send act frames alone, and a carried invite rides no verb", async () => {
    await stage();
    const CARRIED = `lar-invite:a-synthetic-carried-invite-${Math.random().toString(36).slice(2)}`;
    const HANDED = `lar-invite:a-synthetic-wallet-invite-${Math.random().toString(36).slice(2)}`;
    const vessel = await standVessel({ unlocked: true, table: (act) => {
      if (act === "walk.state") return { walks: [{ gatePubKey: KEY, nexusAid: "a-synthetic-nexus", relay: null, redeeming: true, grant: null, wallet: 0 }] };
      if (act === "walk.take") return { gatePubKey: KEY, nexusAid: "a-synthetic-nexus", relay: null, leaf: KEY, dialing: "now" };
      if (act === "walk.invite") return { gatePubKey: KEY, invite: HANDED, left: 0 };
      return {};
    } });
    const state = await run(["walk", "--json"]);
    const take = await run(["walk", "take", CARRIED, "--json"]);
    const invite = await run(["walk", "invite", "--json"]);
    for (const r of [state, take, invite]) expect(r.code, r.out + r.err).toBe(0);
    const frames = vessel.frames as Array<Record<string, unknown>>;
    for (const frame of frames) expect(Object.keys(frame).sort()).toEqual(["act", "args", "op"]);   // no verb, requester or request id
    expect(frames.map((f) => f["act"])).toEqual(["walk.state", "walk.take", "walk.invite"]);
    expect(frames[1]!["args"]).toEqual({ carried: CARRIED });                                       // CONTROL: the take's own frame holds it
    expect(JSON.stringify([frames[0], frames[2]]).includes("lar-invite:")).toBe(false);
    expect(seatedCustody()?.isUnlocked() ?? false, "the command's own seat stays locked").toBe(false);
    expect(JSON.parse(take.out.trim().split("\n").at(-1)!)).toMatchObject({ ok: true, data: { dialing: "now", via: "daemon" } });
    expect(JSON.parse(invite.out.trim().split("\n").at(-1)!)).toMatchObject({ ok: true, data: { invite: HANDED, via: "daemon" } });
    await vessel.down();

    // A vessel's refusal of a take crosses as the walk door's own refusal.
    const refusing = await standVessel({ unlocked: true, table: () => { throw new SealedActRefused("act-refused", "this vessel wears no face — a walker walks as a person"); } });
    const refused = await run(["walk", "take", CARRIED, "--json"]);
    expect(refused.code).not.toBe(0);
    expect(refused.out + refused.err).toContain("wears no face");
    expect(JSON.parse((refused.out + "\n" + refused.err).trim().split("\n").filter((l) => l.startsWith("{")).at(-1)!)).toMatchObject({ ok: false, error: { code: "refused" } });
    await refusing.down();
  });

  test("D10 — the host commands send act frames alone, and a minted invite rides no verb", async () => {
    await stage();
    const MINTED = `lar-invite:a-synthetic-host-invite-${Math.random().toString(36).slice(2)}`;
    const AID = "a-synthetic-nexus";
    const vessel = await standVessel({ unlocked: true, table: (act) => {
      if (act === "host.state") return { nexuses: [{ nexusAid: AID, epoch: "e".repeat(64), previousEpoch: null, cap: 3, redeemed: 2, redeemedPrevious: 0 }] };
      if (act === "host.roll") return { nexusAid: AID, epoch: "f".repeat(64), previous: "e".repeat(64), cap: 5, docUrl: "automerge:a-synthetic-doc", act: {}, unswept: 0 };
      if (act === "host.invite") return { nexusAid: AID, epoch: "f".repeat(64), invite: MINTED };
      return {};
    } });
    const state = await run(["host", "--json"]);
    const roll = await run(["host", "roll", "--nexus", AID, "--cap", "5", "--json"]);
    const invite = await run(["host", "invite", "--relay", "ws://a-synthetic-hearth/ws", "--json"]);
    for (const r of [state, roll, invite]) expect(r.code, r.out + r.err).toBe(0);
    const frames = vessel.frames as Array<Record<string, unknown>>;
    for (const frame of frames) expect(Object.keys(frame).sort()).toEqual(["act", "args", "op"]);   // no verb, requester or request id
    expect(frames.map((f) => f["act"])).toEqual(["host.state", "host.roll", "host.invite"]);
    expect(frames[1]!["args"]).toEqual({ nexusAid: AID, cap: 5 });                                  // CONTROL: the roll's own frame
    expect(frames[2]!["args"]).toEqual({ relay: "ws://a-synthetic-hearth/ws" });
    expect(JSON.stringify(frames).includes("lar-invite:")).toBe(false);
    expect(seatedCustody()?.isUnlocked() ?? false, "the command's own seat stays locked").toBe(false);
    expect(JSON.parse(state.out.trim().split("\n").at(-1)!)).toMatchObject({ ok: true, data: { nexuses: [{ nexusAid: AID, redeemed: 2 }], via: "daemon" } });
    expect(JSON.parse(roll.out.trim().split("\n").at(-1)!)).toMatchObject({ ok: true, data: { epoch: "f".repeat(64), cap: 5, via: "daemon" } });
    expect(JSON.parse(invite.out.trim().split("\n").at(-1)!)).toMatchObject({ ok: true, data: { invite: MINTED, via: "daemon" } });
    await vessel.down();

    // A vessel's refusal of a roll crosses as the hosting door's own refusal.
    const refusing = await standVessel({ unlocked: true, table: () => { throw new SealedActRefused("act-refused", "this vessel wears no face — a hearth hosts as the face it wears") ; } });
    const refused = await run(["host", "roll", "--json"]);
    expect(refused.code).not.toBe(0);
    expect(refused.out + refused.err).toContain("wears no face");
    expect(JSON.parse((refused.out + "\n" + refused.err).trim().split("\n").filter((l) => l.startsWith("{")).at(-1)!)).toMatchObject({ ok: false, error: { code: "refused" } });
    await refusing.down();
  });
});
