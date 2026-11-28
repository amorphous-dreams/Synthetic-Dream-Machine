/**
 * rite-keep — the keep rite's vessel half: the house lays its authored memory, cut as a cleartext house bundle, into one of the
 * operator's bound workspaces, and the cut spends a return of the keep lei the operator strung for that workspace.
 *
 *   K1  with no keep lei standing the rite refuses by the lei's own refusal, cuts nothing and writes nothing;
 *   K2  with one standing it reads the line, cuts beside the dest, hands the bundle's verify in as the receipt, begins the rite
 *       (the return, the tessera's guest half), and only then moves the bundle into place; what else the workspace holds stays;
 *   K3  a begin the vessel refuses leaves the workspace as it stood, the earlier bundle byte for byte;
 *   K4  a second keep over unchanged memory names the standing bundle and spends nothing;
 *   K5  a keep over changed memory replaces the tree whole: a file the new cut no longer holds leaves;
 *   K6  a name no workspace spells, an unbound workspace, one that resolves inside the hearth, an unsafe `--into`, and a
 *       standing directory that holds no bundle each refuse by name before the line reads;
 *   K7  the command line names its workspace, and reads `--into`, `--accept-omissions` and `--face` beside it.
 *   K8  keep-reads-the-keep-face-whoever-wears: a keep that names no face acts as the keep's face, one per house (the face whose
 *       keep lei already stands, else h0), names it on every row but the receipt (the place signs that one for every face) and
 *       in its answer; a named `--face N` rides as named; the lei
 *       hint names the keep's face.
 *   K10 keep-acts-as-the-keep-face-with-none-worn: a pūlama lent h0, h1 and h2 and the vessel wears none of them: the keep
 *       acts as the face whose keep lei stands (else h0), rides it on every row but the receipt and answers it, never asking a
 *       worn face.
 *   K11 keep-names-its-code-once: a row refused under a message that already leads with its code reads that code once.
 */
import { closeScratch, openScratch, type Scratch } from "../../lararium-node/tests/support/scratch-fixture.js";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BUNDLE_SCHEMA, MANIFEST_FILE, REDECLARE_FILE, bundleIdOf, sealRedeclare, sha256Hex, verifyBundle, zeroCounts, type BundleFile, type BundleManifest } from "../src/bundle-manifest.js";
import { KeepRefused, riteKeep, type KeepPorts } from "../src/rite-keep.js";
import type { RiteVerbAnswer } from "../src/rite-kukulu.js";
import { RiteUsage, keepPlan } from "../src/commands/rite.js";
import { parseArgs } from "../src/parse-args.js";

let house: Scratch;
let root: string;
const TESSERA = "e".repeat(64), LEI = "d".repeat(64);

const ROSTER_SEALED = sealRedeclare(new Uint8Array(32).fill(7), { schema: BUNDLE_SCHEMA, faces: [{ face: "f0", handleIndex: 0, petname: "steward", handle: null, seat: false, chair: null }] });

/** A whole, small bundle at `dest`, as an export leaves one: every file hashed, the id over the file list. */
function writeBundle(dest: string, notes: Readonly<Record<string, string>>): BundleManifest {
  const files: BundleFile[] = [];
  const put = (rel: string, text: string | Buffer): void => {
    const abs = join(dest, ...rel.split("/"));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
    files.push({ path: rel, sha256: sha256Hex(text), bytes: Buffer.byteLength(text) });
  };
  for (const [name, text] of Object.entries(notes)) put(`faces/f0/working/${name}.tid`, text);
  // The roster rides sealed to a keep pair; the vessel half proves the bundle whole with no route. One seal for the whole suite,
  // as a house keeps its last seal, so an unmoved cut names the same bundle.
  put(REDECLARE_FILE, ROSTER_SEALED);
  files.sort((a, b) => (a.path < b.path ? -1 : 1));
  const onDisk = { schema: BUNDLE_SCHEMA, bundleId: bundleIdOf(files), faces: [{ key: "f0" }], files, rows: [], counts: zeroCounts(), tempBytes: {}, omissions: [] };
  writeFileSync(join(dest, MANIFEST_FILE), `${JSON.stringify(onDisk, null, 2)}\n`);
  // The cut answers the opened view: each face by its pet-name.
  return { ...onDisk, faces: [{ key: "f0", petname: "steward" }] } as BundleManifest;
}

/** The vessel's rows and the cut, recorded; `lei` names what the keep line reads, `begin` what the begin row answers. */
function rig(over: { lei?: Record<string, unknown>; leiOn?: Record<number, Record<string, unknown>>; begin?: RiteVerbAnswer; notes?: Record<string, string>; mount?: number | null } = {}) {
  const calls: string[] = [], stagedAtBegin: string[] = [];
  const state = { notes: over.notes ?? { heron: "remember the heron\n" }, begin: over.begin, lei: over.lei ?? { standing: true, reach: "wide", returnsLeft: 2, after: LEI } };
  const ports: KeepPorts = {
    row: async (verb, args) => {
      calls.push(`${verb} ${JSON.stringify(args)}`);
      // THE DOOR'S CHORE GATE: a row asked as a face other than the daemon mount refuses, naming both. A vessel that wears
      // no face (`mount: null`) stands no gate (`choreAtDoor` answers null), as a pūlama's lend with none worn leaves it.
      const mount = over.mount === undefined ? 0 : over.mount;
      if (mount !== null && typeof args["face"] === "number" && args["face"] !== mount) return { ok: false, code: "chore-face-not-mounted", message: `chore-face-not-mounted: asked as h${String(args["face"])}, the daemon mount runs h${mount}` };
      if (verb === "swarm-show") return { ok: true, output: { lei: over.leiOn !== undefined ? (over.leiOn[Number(args["face"])] ?? { standing: false, refusal: "absent", after: null }) : state.lei } };
      if (typeof args["staged"] === "string") stagedAtBegin.push(verifyBundle(join(workspace(), ...String(args["staged"]).split("/"))).manifest.bundleId);
      return state.begin ?? { ok: true, output: { tessera: TESSERA, rite: "keep", lei: LEI, n: 1, begun: "b".repeat(64) } };
    },
    cut: async (dest, opts) => { calls.push(`cut ${opts.workspace} accept=${opts.acceptOmissions}`); mkdirSync(dest, { recursive: true }); return writeBundle(dest, state.notes); },
  };
  return { calls, stagedAtBegin, ports, state };
}

const workspace = (): string => join(root, "workspaces", "backup");
const refusal = async (run: Promise<unknown>): Promise<string> => run.then(() => "no refusal", (e: unknown) => (e instanceof KeepRefused ? e.code : `threw ${String(e)}`));

beforeEach(() => {
  house = openScratch();
  root = house.root;
  writeFileSync(join(root, ".lar-test-scratch"), "keep suite\n");
  mkdirSync(join(root, "hearth"), { recursive: true });
  mkdirSync(join(workspace(), ".git"), { recursive: true });
  writeFileSync(join(workspace(), ".git", "HEAD"), "ref: refs/heads/main\n");
  writeFileSync(join(workspace(), "README.md"), "the operator's own backup repo\n");
});
afterEach(() => { closeScratch(house); });

describe("the keep rite, vessel half", () => {
  test("K0 RED: the bundle the keep cuts names its format `lar-house-bundle`; CONTROL: a manifest under any other schema refuses `bundle-schema`", () => {
    expect(BUNDLE_SCHEMA).toBe("lar-house-bundle");
    const dest = join(root, "other-schema");
    mkdirSync(dest, { recursive: true });
    const manifest = writeBundle(dest, { heron: "remember the heron\n" });
    expect(verifyBundle(dest).manifest.schema).toBe("lar-house-bundle");
    writeFileSync(join(dest, MANIFEST_FILE), `${JSON.stringify({ ...manifest, schema: "someone-elses" }, null, 2)}\n`);
    expect(() => verifyBundle(dest)).toThrow(/bundle-schema/);
  });

  test("K1 RED: with no keep lei standing the rite refuses by the lei's own refusal, cuts nothing and writes nothing; CONTROL: the line it read names the keep rite at this workspace", async () => {
    const r = rig({ lei: { standing: false, refusal: "absent", after: null } });
    expect(await refusal(riteKeep(r.ports, { workspace: "backup" }))).toBe("swarm-lei-absent");
    expect(r.calls).toEqual([`swarm-show ${JSON.stringify({ rite: "keep", branch: "backup", face: 0 })}`]);
    expect(readdirSync(workspace()).sort()).toEqual([".git", "README.md"]);
    const spent = rig({ lei: { standing: false, refusal: "returns-spent", after: LEI, returns: 6 } });
    // THE PLAIN REMEDY: the spent lei's own returns and its face, and no cid (a kui follows the tip itself).
    const said = await riteKeep(spent.ports, { workspace: "backup" }).then(() => "", (e: Error) => e.message);
    expect(said).toContain("`lares lei kui rite=keep branch=backup returns=6 face=0`");
    expect(said).not.toMatch(/[0-9a-f]{64}/);
    expect(spent.calls.length).toBe(1);
    expect(await refusal(riteKeep(spent.ports, { workspace: "backup" }))).toBe("swarm-lei-returns-spent");
  });

  test("K2 RED: with a lei standing the keep cuts, begins the rite and then moves the bundle into place; CONTROL: the bundle verifies whole and the workspace keeps what else it held", async () => {
    const r = rig();
    const out = await riteKeep(r.ports, { workspace: "backup" });
    const dest = join(workspace(), "house");
    const verified = verifyBundle(dest);
    const id = verified.manifest.bundleId;
    expect(out).toMatchObject({ kept: true, workspace: "backup", into: "house", dest, bundleId: id, tessera: TESSERA, lei: LEI, n: 1 });
    expect(r.calls).toEqual([
      `swarm-show ${JSON.stringify({ rite: "keep", branch: "backup", face: 0 })}`,
      `cut ${workspace()} accept=false`,
      expect.stringMatching(new RegExp(`^rite-begin \\{"rite":"keep","branch":"backup","head":"${id}","staged":"\\.house\\.keep-[0-9a-f]{12}","face":0\\}$`)),
    ]);
    // The begin names the staged tree by its place inside the workspace, and the tree stands whole there when the vessel reads it.
    expect(r.stagedAtBegin).toEqual([id]);
    expect(readFileSync(join(dest, "faces/f0/working/heron.tid"), "utf8")).toBe("remember the heron\n");
    expect(readdirSync(workspace()).sort()).toEqual([".git", "README.md", "house"]);
    expect(readFileSync(join(workspace(), "README.md"), "utf8")).toBe("the operator's own backup repo\n");
    // `--into` names another place inside the workspace, and a face rides each row.
    const deep = rig({ mount: 1 });
    const there = await riteKeep(deep.ports, { workspace: "backup", into: "devices/one/house", face: 1, acceptOmissions: true });
    expect(there.dest).toBe(join(workspace(), "devices", "one", "house"));
    expect(deep.calls[0]).toBe(`swarm-show ${JSON.stringify({ rite: "keep", branch: "backup", face: 1 })}`);
    expect(deep.calls[1]).toBe(`cut ${workspace()} accept=true`);
    expect(deep.calls[2]).toMatch(new RegExp(`^rite-begin \\{"rite":"keep","branch":"backup","head":"${there.bundleId}","staged":"devices/one/\\.house\\.keep-[0-9a-f]{12}","face":1\\}$`));
  });

  test("K2b RED: a cut that left a face's standing heads behind names that face by handle index in the keep's answer to the terminal; CONTROL: a whole cut names none", async () => {
    const r = rig();
    const cut = r.ports.cut;
    const named: KeepPorts = { ...r.ports, cut: async (dest, opts) => ({ ...(await cut(dest, opts)), unreadFaces: [2] }) };
    const out = await riteKeep(named, { workspace: "backup" });
    expect(out).toMatchObject({ kept: true, unreadFaces: [2] });
    const whole = await riteKeep(rig({ notes: { pond: "the pond\n" } }).ports, { workspace: "backup" });
    expect(whole).not.toHaveProperty("unreadFaces");
  });

  test("K3 RED: a begin the vessel refuses leaves the workspace as it stood; CONTROL: the earlier bundle still verifies, byte for byte", async () => {
    const first = rig();
    const kept = await riteKeep(first.ports, { workspace: "backup" });
    const second = rig({ notes: { heron: "remember the heron\n", pond: "the pond at dusk\n" }, begin: { ok: false, code: "swarm-lei-returns-spent", message: "swarm-lei-returns-spent: this lei's returns ran out" } });
    expect(await refusal(riteKeep(second.ports, { workspace: "backup" }))).toBe("swarm-lei-returns-spent");
    expect(verifyBundle(kept.dest).manifest.bundleId).toBe(kept.bundleId);
    expect(existsSync(join(kept.dest, "faces/f0/working/pond.tid"))).toBe(false);
    expect(readdirSync(workspace()).sort()).toEqual([".git", "README.md", "house"]);
  });

  test("K4 RED: a second keep over unchanged memory names the standing bundle and spends nothing; CONTROL: it still read the line and cut", async () => {
    const first = rig();
    const kept = await riteKeep(first.ports, { workspace: "backup" });
    const again = rig();
    const out = await riteKeep(again.ports, { workspace: "backup" });
    expect(out).toEqual({ kept: false, standing: true, workspace: "backup", into: "house", dest: kept.dest, bundleId: kept.bundleId, face: 0, faceBy: "keep" });
    expect(again.calls.map((c) => c.split(" ")[0])).toEqual(["swarm-show", "cut"]);
    expect(readdirSync(workspace()).sort()).toEqual([".git", "README.md", "house"]);
  });

  test("K5 RED: a keep over changed memory replaces the tree whole, so a file the new cut no longer holds leaves; CONTROL: the new bundle verifies and names another id", async () => {
    const first = rig({ notes: { heron: "remember the heron\n", pond: "the pond at dusk\n" } });
    const kept = await riteKeep(first.ports, { workspace: "backup" });
    const next = rig({ notes: { heron: "remember the heron at dawn\n" } });
    const out = await riteKeep(next.ports, { workspace: "backup" });
    expect(out.kept).toBe(true);
    expect(out.bundleId).not.toBe(kept.bundleId);
    expect(verifyBundle(out.dest).manifest.bundleId).toBe(out.bundleId);
    expect(existsSync(join(out.dest, "faces/f0/working/pond.tid"))).toBe(false);
    expect(readdirSync(workspace()).sort()).toEqual([".git", "README.md", "house"]);
  });

  test("K6 RED: a malformed name, an unbound workspace, one inside the hearth, an unsafe --into and a standing directory that holds no bundle each refuse before the line reads; CONTROL: nothing moved", async () => {
    const r = rig();
    expect(await refusal(riteKeep(r.ports, { workspace: "../backup" }))).toBe("keep-workspace-malformed");
    expect(await refusal(riteKeep(r.ports, { workspace: "Backup" }))).toBe("keep-workspace-malformed");
    expect(await refusal(riteKeep(r.ports, { workspace: "absent" }))).toBe("keep-workspace-unbound");
    mkdirSync(join(root, "hearth", "inner"), { recursive: true });
    symlinkSync(join(root, "hearth", "inner"), join(root, "workspaces", "sly"));
    expect(await refusal(riteKeep(r.ports, { workspace: "sly" }))).toBe("keep-workspace-refused");
    for (const into of ["../house", "/abs/house", "a//b", ".", ".git/x", "house/.git"]) expect(await refusal(riteKeep(r.ports, { workspace: "backup", into })), into).toBe("keep-into-unsafe");
    mkdirSync(join(workspace(), "notes"));
    writeFileSync(join(workspace(), "notes", "mine.txt"), "the operator's own file\n");
    expect(await refusal(riteKeep(r.ports, { workspace: "backup", into: "notes" }))).toBe("keep-dest-foreign");
    expect(await refusal(riteKeep(r.ports, { workspace: "backup", into: "README.md" }))).toBe("keep-dest-foreign");
    expect(r.calls).toEqual([]);
    expect(readFileSync(join(workspace(), "notes", "mine.txt"), "utf8")).toBe("the operator's own file\n");
    expect(readdirSync(workspace()).sort()).toEqual([".git", "README.md", "notes"]);
  });

  test("K6b keep-dest-foreign-reads-every-other-manifest: a place holding any manifest but the keep's own `lar-house-bundle` refuses as foreign and names another place, whatever schema the manifest names; nothing moved", async () => {
    const r = rig();
    const standing = join(workspace(), "house");
    mkdirSync(standing, { recursive: true });
    const manifest = writeBundle(standing, { heron: "remember the heron\n" });
    writeFileSync(join(standing, MANIFEST_FILE), `${JSON.stringify({ ...manifest, schema: "another-bundle" }, null, 2)}\n`);
    const whole = await riteKeep(r.ports, { workspace: "backup" }).catch((e: unknown) => e as KeepRefused);
    expect(whole).toBeInstanceOf(KeepRefused);
    expect((whole as KeepRefused).code).toBe("keep-dest-foreign");
    expect((whole as KeepRefused).message).toMatch(/name another place with into=/);
    expect((whole as KeepRefused).message).not.toMatch(/git -C/);
    mkdirSync(join(workspace(), "elsewhere"));
    writeFileSync(join(workspace(), "elsewhere", MANIFEST_FILE), `${JSON.stringify({ schema: "someone-elses/1" })}\n`);
    const foreign = await riteKeep(r.ports, { workspace: "backup", into: "elsewhere" }).catch((e: unknown) => e as KeepRefused);
    expect((foreign as KeepRefused).code).toBe("keep-dest-foreign");
    expect((foreign as KeepRefused).message).toMatch(/name another place with into=/);
    expect(r.calls).toEqual([]);
    expect(JSON.parse(readFileSync(join(standing, MANIFEST_FILE), "utf8")).schema).toBe("another-bundle");
  });

  test("K7 RED: a keep line that names no workspace refuses with usage; CONTROL: the line's workspace, place, partial flag and face each read", () => {
    const plan = (...argv: string[]) => keepPlan(parseArgs(["rite", "keep", ...argv]));
    expect(() => plan()).toThrow(RiteUsage);
    expect(() => plan("workspace=backup", "face=x")).toThrow(RiteUsage);
    expect(plan("workspace=backup")).toEqual({ workspace: "backup", acceptOmissions: false });
    expect(plan("workspace=backup", "into=devices/one/house", "accept-omissions=true", "face=1")).toEqual({ workspace: "backup", into: "devices/one/house", acceptOmissions: true, face: 1 });
  });

  test("K8 keep-reads-the-keep-face: the face whose keep line stands acts on every row, else h0; a face the door will not read names itself", async () => {
    const STANDING = { standing: true, reach: "wide", returnsLeft: 3, tip: LEI };
    // The lei stands on h1 and h1 wears: h0's line refuses at the door's gate, h1's stands, and the keep acts as h1.
    const r = rig({ leiOn: { 1: STANDING }, mount: 1 });
    const out = await riteKeep({ ...r.ports, houseFaces: async () => ({ open: [0, 1], shut: [] }) }, { workspace: "backup" });
    expect(out).toMatchObject({ kept: true, face: 1, faceBy: "keep" });
    const rows = r.calls.filter((c) => !c.startsWith("cut"));
    expect(rows[0]).toBe(`swarm-show ${JSON.stringify({ rite: "keep", branch: "backup", face: 0 })}`);
    expect(rows.slice(1).map((c) => c.split(" ")[0])).toEqual(["swarm-show", "rite-begin"]);
    // Every row after the first names the keep's face.
    expect(rows.slice(1).every((c) => c.includes('"face":1'))).toBe(true);
    // The lei stands on h0: the keep acts as h0 and reads no other face.
    const zero = rig({ leiOn: { 0: STANDING } });
    expect(await riteKeep({ ...zero.ports, houseFaces: async () => ({ open: [1, 0], shut: [] }) }, { workspace: "backup" })).toMatchObject({ face: 0, faceBy: "keep" });
    expect(zero.calls.filter((c) => c.startsWith("swarm-show"))).toHaveLength(1);
    // A named face rides as named.
    const named = rig({ mount: 2 });
    const two = await riteKeep({ ...named.ports, houseFaces: async () => ({ open: [0, 1, 2], shut: [] }) }, { workspace: "backup", into: "elsewhere", face: 2 });
    expect(two).toMatchObject({ face: 2, faceBy: "named" });
    expect(named.calls[0]).toBe(`swarm-show ${JSON.stringify({ rite: "keep", branch: "backup", face: 2 })}`);
  });

  test("K10 keep-acts-as-the-keep-face-with-none-worn: faces lent h0, h1, h2 and none worn: the face whose lei stands acts on every row, else h0, and the answer says which", async () => {
    const STANDING = { standing: true, reach: "wide", returnsLeft: 3, tip: LEI };
    const lent = async () => ({ open: [0, 1, 2], shut: [] });
    // The lei stands on h2, and the vessel wears no face: the keep acts as h2.
    const r = rig({ leiOn: { 2: STANDING }, mount: null });
    const out = await riteKeep({ ...r.ports, houseFaces: lent }, { workspace: "backup" });
    expect(out).toMatchObject({ kept: true, face: 2, faceBy: "keep" });
    const rows = r.calls.filter((c) => !c.startsWith("cut"));
    expect(rows.slice(0, 3)).toEqual([0, 1, 2].map((f) => `swarm-show ${JSON.stringify({ rite: "keep", branch: "backup", face: f })}`));
    expect(rows.slice(3).map((c) => c.split(" ")[0])).toEqual(["rite-begin"]);
    expect(rows.slice(3).every((c) => c.includes('"face":2'))).toBe(true);
    // The lei stands on h0: h0, and no other face read (the bundle the first keep laid stands, so this one spends nothing).
    const zero = rig({ leiOn: { 0: STANDING }, mount: null });
    expect(await riteKeep({ ...zero.ports, houseFaces: lent }, { workspace: "backup" })).toMatchObject({ face: 0, faceBy: "keep" });
    expect(zero.calls.filter((c) => c.startsWith("swarm-show"))).toHaveLength(1);
    // No lei stands on any lent face: the keep's face reads h0, and the cure strings the lei there.
    const none = rig({ leiOn: {}, mount: null });
    await expect(riteKeep({ ...none.ports, houseFaces: lent }, { workspace: "backup" })).rejects.toThrow(/lares lei kui rite=keep branch=backup returns=<n> face=0/);
  });

  test("K11 keep-names-its-code-once: a refused row whose message already leads with its code reads the code once", async () => {
    const seat = rig({ mount: 0 });
    const c = await riteKeep({ ...seat.ports, houseFaces: async () => ({ open: [0, 1], shut: [] }) }, { workspace: "backup", face: 1 }).catch((e: unknown) => e as KeepRefused);
    expect(c).toBeInstanceOf(KeepRefused);
    expect((c as KeepRefused).message).toMatch(/^chore-face-not-mounted: asked as h1/);
    expect((c as KeepRefused).message).not.toMatch(/chore-face-not-mounted: chore-face-not-mounted/);
    // CONTROL: a message that does not lead with its code takes the prefix once.
    expect(new KeepRefused("keep-into-unsafe", "--into names a dotted segment").message).toBe("keep-into-unsafe: --into names a dotted segment");
    expect(new KeepRefused("vessel-locked", "vessel-locked: run `lares vault unlock`").message).toBe("vessel-locked: run `lares vault unlock`");
  });

  test("K9 keep-names-a-lei-it-cannot-see: none read standing while a face stands shut, or its line refused, names `lares rite keep face=N`; a row refused at the chore gate says the keep belongs to the operator's hand", async () => {
    // h2 stands shut: a lei may stand there, so the refusal names it and the line that keeps as it.
    const shut = rig({ leiOn: {} });
    const a = await riteKeep({ ...shut.ports, houseFaces: async () => ({ open: [0], shut: [2] }) }, { workspace: "backup" }).catch((e: unknown) => e as Error);
    expect((a as Error).message).toMatch(/a keep lei may stand on a face not open \(h2\)/);
    expect((a as Error).message).toMatch(/lares rite keep face=N/);
    // h1 stands open, and its line refused at the gate (h0 wears): the same naming.
    const gated = rig({ leiOn: {} });
    const b = await riteKeep({ ...gated.ports, houseFaces: async () => ({ open: [0, 1], shut: [] }) }, { workspace: "backup" }).catch((e: unknown) => e as Error);
    expect((b as Error).message).toMatch(/a keep lei may stand on a face not read \(h1\)/);
    // A named face the mount does not wear refuses at the chore gate, and the refusal says whose act the keep is.
    const seat = rig({ mount: 0 });
    const c = await riteKeep({ ...seat.ports, houseFaces: async () => ({ open: [0, 1], shut: [] }) }, { workspace: "backup", face: 1 }).catch((e: unknown) => e as { code: string; message: string });
    expect(c).toMatchObject({ code: "chore-face-not-mounted" });
    expect((c as { message: string }).message).toMatch(/the keep belongs to the operator's hand/);
    // CONTROL: every face open and read, none standing: the plain absent refusal names h0's kui.
    const none = rig({ leiOn: {} });
    await expect(riteKeep({ ...none.ports, houseFaces: async () => ({ open: [0], shut: [] }) }, { workspace: "backup" })).rejects.toThrow(/lares lei kui rite=keep branch=backup returns=<n> face=0/);
  });
});
