/**
 * e2e/session-wears-the-lit-face — the operator's CLI session over the 0600 rendezvous wears the face the island
 * mounts, and nothing else.
 *
 * The CLI names the PLACE as `requestedBy` (it holds no atom: the atom's seed rests sealed under the vessel key). A
 * founded hearth mints every bag on its face, so a verb that presents as the place reaches nothing the face owns.
 * Authority on the presence channel therefore comes from the CHANNEL: with a face lit, a local verb that names the
 * place presents as the mounted face's atom. The claim never decides:
 *
 *   S1 RED  the place's own CLI reads its face's wiki (cap-denied on the cut's parent)
 *   S2      CONTROL: a claim naming a stranger's DID stays that stranger, and the verifier refuses it
 */
import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { targetInstance, awaitRendezvous, vesselStorageDir, openStaged, foundStagedHearth, stageDir, type CliResult, type LarInstance } from "../harness/instance.js";
import { invokeLocal } from "../../packages/lares-cli/src/local-connector.js";

const URI = "lar:///ha.ka.ba/t/session/absent";
const TEST_DOOR = join(new URL("../..", import.meta.url).pathname, "tools/unlock-test-custody.mjs");
let lar: LarInstance;

// LIVENESS: the bound names a stalled staging only; the rendezvous event ends the wait. The staged boot measured ~149s alone and ~240s beside
// another e2e file under parallel load, so the bound stands at 360s (1.5x the loaded measure): a hang trips it, a loaded boot never does.
beforeAll(async () => {
  lar = await targetInstance();
  if (!(await awaitRendezvous(lar))) throw new Error(`the staged daemon bound no rendezvous:\n${lar.bootLog().slice(-800)}`);
}, 360_000);
afterAll(async () => { await lar?.stop(); });

describe("e2e/session-wears-the-lit-face", () => {
  test("S1 RED: the CLI, naming the place, reads its lit face's wiki as the face", async () => {
    const got = await lar.cli(["get", `title=${URI}`, "recipe=lares", "mu=assert", "--json"]);
    expect(JSON.stringify(got.json), "the wiki answers not-found, never cap-denied").toContain("not-found");
    expect(JSON.stringify(got.json)).not.toContain("cap-denied");
  });

  test("S2 CONTROL: a claim naming a stranger's DID presents as that stranger and the content fence refuses it", async () => {
    const stranger = `0x${"11".repeat(32)}`;
    const r = await invokeLocal("meme-get", { uri: URI, recipe: "lares" }, stranger,
      { dataDir: vesselStorageDir(lar), timeoutMs: 60_000 }).catch((e: unknown) => ({ thrown: String(e) }));
    // The fence refuses before any cap check reads: the stranger is not the mounted face.
    expect(JSON.stringify(r)).toContain("content-mounted-only");
  }, 90_000);
});

/**
 * THE TWO-FACE WALK — a lit sibling's lane write and its engine's tiddler write land in the SIBLING's own daemon wiki
 * while another face stands worn (#384's owed proof; the 2026-11-14 measurement read a sibling's daemon canon and
 * working layer never opening under a worn face).
 *
 * Two faces stand lit on one vessel: persona zero (worn: the default reach) and a second face of the same operator.
 * Each act names its face by `face=N` (`--face N` on the `wiki` and `intent` verbs), rides a session of that face, and lands in that face's own layer:
 *
 *   W1  a meme put (the lane) as face 1 lands in face 1's working layer; face 1 reads it back; the worn face reads absent
 *   W2  a record put (the sibling's own TW5 engine) as face 1 lands there; face 1 reads it back; the worn face reads absent
 *   W3  the worn face's own write lands in its own layer, and face 1 reads it absent
 *   W4  CONTROL: a face that stands shut refuses `face-not-open`, and nothing writes
 *   W1b EVERY LIT FACE PROJECTS ITS OWN WRITES (course item sibling-writes-wait-unprojected): face 1's lane write reaches
 *       plaintext under face 1's own root while face 0 stands worn, with no wear of face 1, and nothing of it reaches the worn root
 *   W5  a read of every face's names (`persona list`, the custody door's `selves.read`) leaves no save held in memory: the
 *       census reads no `held-save`, since the lit sibling's selves record seals under that sibling's own hive
 *   W6  EACH FACE LIVES ONE LIFE: a lock of the lit sibling closes it through its actor before its key locks; it then
 *       refuses work by name while the worn face keeps writing, and a fresh light serves it again
 *   W7  EACH ARCHIVE NAMES ITS FACE (the 2026-11-20 custody incident): wear face 1 with face 0 lit beside it, stop the
 *       daemon, boot it again on the same root and wear face 1 again: face 1 stands (no `ArchiveIdentityMismatch`), and
 *       neither boot's log names a veil archive the seal refused, so no hive's Archive ever reached another face's row; a
 *       write the lit sibling (face 0) made before the stop reads back after the boot, so the stop dropped none of its saves
 *
 * THE READ-ACROSS LEG — A LIT FACE RECEIVES VISITS (operator ruling 2026-11-20, the cross-face reach): the worn face reads the
 * lit sibling standing, with no lei, by `target=`, and keeps the face it wears; the sibling's personal layer never answers.
 *
 *   RA1 RED: the worn face reads face 1's working record and its daemon canon by `target=` (ordinal and pet name), and every
 *       answer names the face it read and the face worn
 *   RA2 RED: a title only in face 1's personal layer reads absent to a visit's get, meme read and filter, and naming the
 *       personal bag refuses `cross-face-private`; face 1 itself still reads it. The other way round too (Sol H1): face 1's
 *       session visiting the worn face reads its working layer, and the worn face's personal layer never answers it
 *   RA3 RED: a shut target refuses `face-not-open`, and a write naming another face refuses `cross-face-write-refused`
 */
describe("e2e/two-face-walk: a lit sibling writes into its own layers while another face stands worn", () => {
  const MEME = "lar:///ha.ka.ba/kahua/memory/walk/sibling-lane";
  const WORN_MEME = "lar:///ha.ka.ba/kahua/memory/walk/worn-lane";
  const TID = "$:/walk/sibling-engine";
  const memeText = (uri: string, word: string): string =>
    `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "${uri.replace("lar:///", "")}"\n\`\`\`\n\n` +
    `<<~ ahu slot=\`#/entry\`>>\n\n! ${word}\n\n${word} stands in its own layer.\n\n<<~/ahu>>\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;
  let walk: LarInstance;
  /** W7's second daemon over the walk's own root, after the stop. */
  let restand: LarInstance | null = null;
  /** Face 0's own daemon canon, the walk's first worn face. */
  let faceZeroBag = "";
  let scratch = "";
  /** The sibling's own daemon canon: its lane's one bag, by its own relation (`bags/daemon-<relation>`). */
  let siblingBag = "";

  beforeAll(async () => {
    const root = mkdtempSync(join(stageDir(), "lares-two-face-walk-"));
    walk = await openStaged({ root, tag: "two-face-walk", found: async (cli, staged) => {
      await foundStagedHearth(cli, staged, "worn-face");
      const second = await cli(["persona", "new", "1", "name=sibling-face", "--json"]);
      if (second.code !== 0) throw new Error(`the second face failed (${second.code})\n${second.stdout.slice(-400)}\n${second.stderr.slice(-800)}`);
    } });
    if (!(await awaitRendezvous(walk))) throw new Error(`the staged daemon bound no rendezvous:\n${walk.bootLog().slice(-800)}`);
    scratch = join(walk.root, "walk");
    mkdirSync(scratch, { recursive: true });
    // THE SIBLING'S OWN WEAR comes first: a face's daemon canon, relation and device slots stand where that face was worn
    // (lit-face-target: nothing mints a sibling's slot ahead of its wear). A product unlock gathers its credential from a
    // terminal alone, so the staged test door performs the acts: wear face 1, then wear face 0 again with face 1 lit beside it.
    const door = await import(TEST_DOOR) as { unlockTestCustody: (root: string, act?: string, face?: number) => Promise<Record<string, unknown> | null> };
    const faceBagOf = (r: CliResult): string => ((data(r)["layers"] ?? []) as Array<{ bag: string }>).map((l) => l.bag).find((b) => /\/bags\/daemon-/.test(b)) ?? "";
    const wornBag = faceBagOf(await walk.cli(["wiki", "status", "recipe=default", "--json"]));
    faceZeroBag = wornBag;
    await door.unlockTestCustody(walk.root, "lock");
    const wearOne = await door.unlockTestCustody(walk.root, "unlock", 1);
    if ((wearOne as { wears?: number } | null)?.wears !== 1) throw new Error(`the test door never wore face 1: ${JSON.stringify(wearOne)}`);
    if (!(await awaitRendezvous(walk))) throw new Error(`the daemon bound no rendezvous after wearing face 1:\n${walk.bootLog().slice(-800)}`);
    for (let look = 0; look < 90 && (siblingBag === "" || siblingBag === wornBag); look++) {
      const status = await walk.cli(["wiki", "status", "recipe=default", "--json"]);
      siblingBag = status.code === 0 ? faceBagOf(status) : "";
      if (siblingBag === "" || siblingBag === wornBag) await new Promise((r) => setTimeout(r, 1000));
    }
    if (siblingBag === "" || siblingBag === wornBag) throw new Error(`face 1 stood no daemon canon of its own once worn: ${siblingBag}`);
    await door.unlockTestCustody(walk.root, "lock");
    const wearZero = await door.unlockTestCustody(walk.root, "unlock", 0);
    if ((wearZero as { wears?: number } | null)?.wears !== 0) throw new Error(`the test door never wore face 0 again: ${JSON.stringify(wearZero)}`);
    if (!(await awaitRendezvous(walk))) throw new Error(`the daemon bound no rendezvous after wearing face 0:\n${walk.bootLog().slice(-800)}`);
    for (let look = 0; look < 90; look++) {
      const status = await walk.cli(["wiki", "status", "recipe=default", "--json"]);
      if (status.code === 0 && faceBagOf(status) === wornBag) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }, 240_000);
  afterAll(async () => { await restand?.stopDaemonOnly(); await walk?.stop(); });

  const data = (r: CliResult): Record<string, unknown> => (r.json?.["data"] ?? {}) as Record<string, unknown>;
  const errCode = (r: CliResult): unknown => (r.json?.["error"] as { code?: unknown } | undefined)?.code;
  const out = (r: CliResult): string => `${r.stdout}\n${r.stderr}`;

  test("W0: the sibling's engine composes over its own daemon wiki: its daemon canon opens for reading (promotion-only) and its working layer takes a write", async () => {
    const s = await walk.cli(["wiki", "status", "recipe=default", "face=1", "--json"]);
    expect(s.code, out(s)).toBe(0);
    const status = data(s) as { working: string | null; layers: Array<{ bag: string; read?: boolean; write: boolean; mounted?: string; working?: boolean }> };
    expect(status["face" as never], "the answer names the sibling").toBe(1);
    expect(status.working, `the sibling's working layer never opened: ${JSON.stringify(status.layers)}`).not.toBeNull();
    expect(status.layers.find((l) => l.working), JSON.stringify(status.layers)).toMatchObject({ write: true });
    // A mounted canon layer reads `promotion-only`: writes reach canon by action verb alone, so the walk asks presence and a read.
    expect(status.layers.find((l) => l.bag === siblingBag), `the sibling daemon canon never opened: ${JSON.stringify(status.layers)}`).toMatchObject({ read: true, mounted: "promotion-only" });
  }, 120_000);

  test("W1: a meme put as face 1 lands in face 1's working layer, face 1 reads it back, the worn face reads absent", async () => {
    const file = join(scratch, "sibling-lane.mem");
    writeFileSync(file, memeText(MEME, "Sibling"));
    const put = await walk.cli(["put", `title=${MEME}`, `bag=${siblingBag}`, `file=${file}`, "face=1", "--json"]);
    expect(put.code, out(put)).toBe(0);
    expect(data(put)["face"], "the answer names the face it landed in").toBe(1);
    const back = await walk.cli(["get", `title=${MEME}`, `bag=${siblingBag}`, "face=1", "mu=assert", "--json"]);
    expect(back.code, out(back)).toBe(0);
    expect(out(back)).toContain("Sibling stands in its own layer");
    const worn = await walk.cli(["get", `title=${MEME}`, "recipe=default", "mu=assert", "--json"]);
    expect(out(worn), "the worn face never sees the sibling's working layer").not.toContain("Sibling stands in its own layer");
    expect(worn.code, out(worn)).not.toBe(0);
  }, 180_000);

  test("W1b RED: face 1's write reaches plaintext under its own face root while face 0 stands worn, and never the worn root", async () => {
    const projections = join(walk.root, "projections");
    const faces = join(projections, "faces");
    /** Each face's root by handle index, read off the face labels (`face-labels/<relation>.json`, beside `faces/`). */
    const rootOf = (handleIndex: number): string => {
      const dir = join(projections, "face-labels");
      for (const name of readdirSync(dir)) {
        if (!name.endsWith(".json") || name.endsWith(".bases.json")) continue;
        const label = JSON.parse(readFileSync(join(dir, name), "utf8")) as { petname?: unknown; handleIndex?: unknown };
        if (label.handleIndex === handleIndex && typeof label.petname === "string") return join(faces, label.petname);
      }
      throw new Error(`no face label names h${handleIndex}`);
    };
    /** The face roots under `faces/` whose files hold `word`. */
    const holding = (word: string): string[] => {
      if (!existsSync(faces)) return [];
      const holds = (dir: string): boolean => readdirSync(dir).some((name) => {
        if (name === ".git") return false;
        const p = join(dir, name);
        return statSync(p).isDirectory() ? holds(p) : readFileSync(p, "utf8").includes(word);
      });
      return readdirSync(faces).map((name) => join(faces, name)).filter((dir) => statSync(dir).isDirectory() && holds(dir));
    };
    let roots: string[] = [];
    for (let look = 0; look < 60 && roots.length === 0; look++) {
      roots = holding("Sibling stands in its own layer");
      if (roots.length === 0) await new Promise((r) => setTimeout(r, 1000));
    }
    expect(roots, "face 1's write reached plaintext under face 1's own root alone, while face 0 stood worn").toEqual([rootOf(1)]);
    expect(rootOf(1)).not.toBe(rootOf(0));
  }, 120_000);

  test("W2: a record put as face 1 (its engine) lands in face 1's layer, face 1 reads it back, the worn face reads absent", async () => {
    const put = await walk.cli(["put", `title=${TID}`, "recipe=default", "text=sibling engine word", "create=true", "face=1", "--json"]);
    expect(put.code, out(put)).toBe(0);
    expect(data(put)["decision"]).toBe("put");
    expect(data(put)["face"]).toBe(1);
    const back = await walk.cli(["get", `title=${TID}`, "recipe=default", "face=1", "--json"]);
    expect(back.code, out(back)).toBe(0);
    expect(JSON.stringify(back.json)).toContain("sibling engine word");
    const worn = await walk.cli(["get", `title=${TID}`, "recipe=default", "--json"]);
    expect(worn.code, out(worn)).not.toBe(0);
    expect(errCode(worn)).toBe("not-found");
    expect(JSON.stringify(worn.json)).not.toContain("sibling engine word");
  }, 180_000);

  test("W3: the worn face's own write still lands in its own layer, and the sibling reads it absent", async () => {
    const file = join(scratch, "worn-lane.mem");
    writeFileSync(file, memeText(WORN_MEME, "Worn"));
    const put = await walk.cli(["put", `title=${WORN_MEME}`, "recipe=default", `file=${file}`, "--json"]);
    expect(put.code, out(put)).toBe(0);
    const back = await walk.cli(["get", `title=${WORN_MEME}`, "recipe=default", "mu=assert", "--json"]);
    expect(back.code, out(back)).toBe(0);
    expect(out(back)).toContain("Worn stands in its own layer");
    const sibling = await walk.cli(["get", `title=${WORN_MEME}`, "recipe=default", "face=1", "mu=assert", "--json"]);
    expect(out(sibling), "the sibling never sees the worn face's working layer").not.toContain("Worn stands in its own layer");
    expect(sibling.code, out(sibling)).not.toBe(0);
    const tid = await walk.cli(["put", "title=$:/walk/worn-engine", "recipe=default", "text=worn engine word", "create=true", "--json"]);
    expect(tid.code, out(tid)).toBe(0);
    const seen = await walk.cli(["get", "title=$:/walk/worn-engine", "recipe=default", "face=1", "--json"]);
    expect(seen.code, out(seen)).not.toBe(0);
  }, 180_000);

  test("W5 RED: reading every face's names leaves the census clean of held saves: no selves record waits in memory", async () => {
    const list = await walk.cli(["persona", "list", "--json"]);
    expect(list.code, out(list)).toBe(0);
    // A held save names itself at its refusal; give the sealed rest a beat to try the seal and refuse.
    await new Promise((r) => setTimeout(r, 3000));
    const census = await walk.cli(["vessel", "census", "--json"]);
    const items = ((data(census)["census"] as { items?: Array<{ kind: string; bagId?: string | null }> } | undefined)?.items ?? []);
    expect(items.filter((i) => i.kind === "held-save"), `the census holds saves in memory: ${out(census)}`).toEqual([]);
  }, 120_000);

  test("W4 CONTROL: a face that stands shut refuses `face-not-open` on a meme put and a record put, and nothing writes", async () => {
    const file = join(scratch, "shut-lane.mem");
    writeFileSync(file, memeText("lar:///ha.ka.ba/kahua/memory/walk/shut-lane", "Shut"));
    const meme = await walk.cli(["put", "title=lar:///ha.ka.ba/kahua/memory/walk/shut-lane", "recipe=default", `file=${file}`, "face=7", "--json"]);
    expect(meme.code).not.toBe(0);
    expect(errCode(meme), out(meme)).toBe("face-not-open");
    const tid = await walk.cli(["put", "title=$:/walk/shut-engine", "recipe=default", "text=x", "create=true", "face=7", "--json"]);
    expect(tid.code).not.toBe(0);
    expect(errCode(tid), out(tid)).toBe("face-not-open");
  }, 120_000);

  test("RA1 RED: the worn face reads face 1's working record and daemon canon by target=, and each answer names both faces", async () => {
    for (const target of ["1", "h1", "sibling-face"]) {
      const got = await walk.cli(["get", `title=${TID}`, "recipe=default", `target=${target}`, "--json"]);
      expect(got.code, `${target}: ${out(got)}`).toBe(0);
      expect(JSON.stringify(got.json), target).toContain("sibling engine word");
      expect(data(got), target).toMatchObject({ face: 1, worn: 0 });
    }
    const meme = await walk.cli(["get", `title=${MEME}`, "recipe=default", "target=1", "mu=assert", "--json"]);
    expect(meme.code, out(meme)).toBe(0);
    expect(out(meme), "the sibling's daemon canon reads through its view").toContain("Sibling stands in its own layer");
    const filter = await walk.cli(["get", `filter=[[${TID}]is[tiddler]]`, "recipe=default", "target=1", "--json"]);
    expect(filter.code, out(filter)).toBe(0);
    expect(data(filter)).toMatchObject({ titles: [TID], face: 1, worn: 0 });
    // A sibling's own session visits the worn face the same way (Sol H1): the worn face's working record answers, named both ways.
    const back = await walk.cli(["get", "title=$:/walk/worn-engine", "recipe=default", "face=1", "target=0", "--json"]);
    expect(back.code, out(back)).toBe(0);
    expect(JSON.stringify(back.json)).toContain("worn engine word");
    expect(data(back)).toMatchObject({ face: 0, worn: 1, visit: true });
    // The worn face still reads its own wiki where it names no target.
    const own = await walk.cli(["get", `title=${TID}`, "recipe=default", "--json"]);
    expect(errCode(own), out(own)).toBe("not-found");
  }, 180_000);

  test("RA2 RED: a title only in face 1's personal layer never answers a visit, and its personal bag refuses cross-face-private", async () => {
    const PRIVATE = "lar:///ha.ka.ba/kahua/memory/walk/sibling-private";
    const PERSONAL = "lar:///ha.ka.ba/wikis/daemon/personal";
    const file = join(scratch, "sibling-private.mem");
    writeFileSync(file, memeText(PRIVATE, "Private"));
    const put = await walk.cli(["put", `title=${PRIVATE}`, `bag=${PERSONAL}`, `file=${file}`, "face=1", "--json"]);
    expect(put.code, out(put)).toBe(0);
    expect(data(put)["face"]).toBe(1);
    const own = await walk.cli(["get", `title=${PRIVATE}`, `bag=${PERSONAL}`, "face=1", "mu=assert", "--json"]);
    expect(own.code, `face 1 reads its own personal layer: ${out(own)}`).toBe(0);
    expect(out(own)).toContain("Private stands in its own layer");
    const visit = await walk.cli(["get", `title=${PRIVATE}`, "recipe=default", "target=1", "mu=assert", "--json"]);
    expect(out(visit), "a visit never reads the sibling's personal layer").not.toContain("Private stands in its own layer");
    expect(visit.code, out(visit)).not.toBe(0);
    const tid = await walk.cli(["get", `title=${PRIVATE}`, "recipe=default", "target=1", "--json"]);
    expect(errCode(tid), out(tid)).toBe("not-found");
    const filter = await walk.cli(["get", `filter=[[${PRIVATE}]is[tiddler]] [search:text:literal[Private stands in its own layer]]`, "recipe=default", "target=1", "--json"]);
    expect(filter.code, out(filter)).toBe(0);
    expect(data(filter)["titles"], "the filter finds no private record").toEqual([]);
    const named = await walk.cli(["get", `title=${PRIVATE}`, `bag=${PERSONAL}`, "target=1", "mu=assert", "--json"]);
    expect(named.code).not.toBe(0);
    expect(out(named), "naming the personal bag refuses before any read").toContain("cross-face-private");
    // The worn face's own personal layer never answers face 1's visit either (Sol H1: the mount's view, never its own engine).
    const WORN_PRIVATE = "lar:///ha.ka.ba/kahua/memory/walk/worn-private";
    const wornFile = join(scratch, "worn-private.mem");
    writeFileSync(wornFile, memeText(WORN_PRIVATE, "WornPrivate"));
    const wornPut = await walk.cli(["put", `title=${WORN_PRIVATE}`, `bag=${PERSONAL}`, `file=${wornFile}`, "--json"]);
    expect(wornPut.code, out(wornPut)).toBe(0);
    const wornOwn = await walk.cli(["get", `title=${WORN_PRIVATE}`, `bag=${PERSONAL}`, "mu=assert", "--json"]);
    expect(out(wornOwn), "the worn face reads its own personal layer").toContain("WornPrivate stands in its own layer");
    const siblingVisit = await walk.cli(["get", `title=${WORN_PRIVATE}`, "recipe=default", "face=1", "target=0", "mu=assert", "--json"]);
    expect(out(siblingVisit), "face 1's visit never reads the worn face's personal layer").not.toContain("WornPrivate stands in its own layer");
    expect(siblingVisit.code, out(siblingVisit)).not.toBe(0);
  }, 180_000);

  test("RA3 RED: a shut target refuses face-not-open, and a write naming another face refuses cross-face-write-refused", async () => {
    const shut = await walk.cli(["get", `title=${TID}`, "recipe=default", "target=7", "--json"]);
    expect(shut.code).not.toBe(0);
    expect(errCode(shut), out(shut)).toBe("face-not-open");
    const write = await walk.cli(["put", "title=$:/walk/visitor-write", "recipe=default", "text=visitor word", "create=true", "target=1", "--json"]);
    expect(write.code).not.toBe(0);
    expect(out(write)).toContain("cross-face-write-refused");
    for (const face of [[], ["face=1"]]) {
      const seen = await walk.cli(["get", "title=$:/walk/visitor-write", "recipe=default", ...face, "--json"]);
      expect(errCode(seen), `nothing landed (${face.join(" ") || "worn"}): ${out(seen)}`).toBe("not-found");
    }
  }, 180_000);

  test("W8 VOTA ON THE SIBLING'S OWN TURN: a ddate votum on the lit sibling's plane is answered by its own door, under its own atom, while face 0 stands worn; the same word again names the same votum and lands no second outcome", async () => {
    const word = ["intent", "issue", "ddate", "face=1", "every=true", `args=${JSON.stringify({ today: { year: 2026, month: 11, day: 21 } })}`];
    const doorLines = (): string => walk.bootLog().split('\n').filter((l) => /intent door|lit-set|planes mount|face-intent/.test(l)).slice(-16).join('\n');
    const issued = await walk.cli(word);
    expect(issued.code, `${out(issued)}\n${doorLines()}`).toBe(0);
    const id = issued.stdout.trim().split("\n").at(-1)!.trim();
    expect(id, out(issued)).toMatch(/^[0-9a-f]{64}$/);
    type Shown = { outcomes?: Array<{ cause: string; signer: string; winner: boolean; result: Record<string, unknown> }> };
    let shown: Shown = {};
    for (let look = 0; look < 90; look++) {
      const show = await walk.cli(["intent", "show", "face=1", "--json"]);
      shown = show.code === 0 ? JSON.parse(show.stdout.trim().split("\n").at(-1)!) as Shown : {};
      if ((shown.outcomes ?? []).some((o) => o.cause === id)) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    const answered = (shown.outcomes ?? []).filter((o) => o.cause === id);
    expect(answered, `the sibling's door never answered: ${JSON.stringify(shown)}\n${doorLines()}`).toHaveLength(1);
    expect(answered[0]!.result).toMatchObject({ status: "done" });
    expect(typeof answered[0]!.result["text"], JSON.stringify(answered[0])).toBe("string");
    // The worn face's plane carries no word of it.
    const worn = await walk.cli(["intent", "show", "face=0", "--json"]);
    expect(worn.code, out(worn)).toBe(0);
    expect(worn.stdout, "the sibling's votum never reaches the worn face's plane").not.toContain(id);
    // IDEMPOTENT BY INTENT: the same word names the same votum, and a later pass lands no second outcome.
    const again = await walk.cli(word);
    expect(again.code, out(again)).toBe(0);
    expect(again.stdout.trim().split("\n").at(-1)!.trim()).toBe(id);
    await new Promise((r) => setTimeout(r, 3000));
    const after = await walk.cli(["intent", "show", "face=1", "--json"]);
    const outcomes = (JSON.parse(after.stdout.trim().split("\n").at(-1)!) as Shown).outcomes ?? [];
    expect(outcomes.filter((o) => o.cause === id)).toHaveLength(1);
  }, 180_000);

  test("W6 EACH FACE LIVES ONE LIFE: a lock of the lit sibling closes it through its actor before its key locks; it then refuses work by name while the worn face keeps writing, and a fresh light serves it again", async () => {
    const door = await import(TEST_DOOR) as { unlockTestCustody: (root: string, act?: string, face?: number) => Promise<Record<string, unknown> | null> };
    const locked = await door.unlockTestCustody(walk.root, "lock", 1);
    expect(locked, JSON.stringify(locked)).toMatchObject({ locked: true, face: 1 });
    const file = join(scratch, "closed-lane.mem");
    writeFileSync(file, memeText("lar:///ha.ka.ba/kahua/memory/walk/closed-lane", "Closed"));
    const shut = await walk.cli(["put", "title=lar:///ha.ka.ba/kahua/memory/walk/closed-lane", `bag=${siblingBag}`, `file=${file}`, "face=1", "--json"]);
    expect(shut.code, out(shut)).not.toBe(0);
    expect(["face-not-open", "face-closing"], out(shut)).toContain(errCode(shut));
    const wornFile = join(scratch, "worn-after-close.mem");
    writeFileSync(wornFile, memeText("lar:///ha.ka.ba/kahua/memory/walk/worn-after-close", "Worn"));
    const worn = await walk.cli(["put", "title=lar:///ha.ka.ba/kahua/memory/walk/worn-after-close", "recipe=default", `file=${wornFile}`, "--json"]);
    expect(worn.code, out(worn)).toBe(0);
    // The light again: the unlock lights the sibling under a fresh opening, and its lane takes a write.
    await door.unlockTestCustody(walk.root, "unlock", 0);
    let relit: CliResult | null = null;
    for (let look = 0; look < 60; look++) {
      relit = await walk.cli(["get", `title=${MEME}`, `bag=${siblingBag}`, "face=1", "mu=assert", "--json"]);
      if (relit.code === 0) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    expect(relit?.code, relit ? out(relit) : "never asked").toBe(0);
  }, 240_000);

  test("W7 RED: wear face 1 with face 0 lit, stop, boot, wear face 1 again: it stands, and no Archive reached another face's row", async () => {
    const door = await import(TEST_DOOR) as { unlockTestCustody: (root: string, act?: string, face?: number) => Promise<Record<string, unknown> | null> };
    const faceBagOf = (r: CliResult): string => ((data(r)["layers"] ?? []) as Array<{ bag: string }>).map((l) => l.bag).find((b) => /\/bags\/daemon-/.test(b)) ?? "";
    const wornBagOf = async (instance: LarInstance): Promise<string> => {
      for (let look = 0; look < 90; look++) {
        const status = await instance.cli(["wiki", "status", "recipe=default", "--json"]);
        if (status.code === 0 && faceBagOf(status) === siblingBag) return siblingBag;
        await new Promise((r) => setTimeout(r, 1000));
      }
      return "";
    };
    const refusedSeal = /veil archive for face [0-9a-f]{8}… refused/;
    // THE WEAR: face 1 worn, face 0 lit beside it (the walk's beforeAll left face 0 worn with face 1 lit).
    await door.unlockTestCustody(walk.root, "lock");
    const wearOne = await door.unlockTestCustody(walk.root, "unlock", 1);
    expect((wearOne as { wears?: number } | null)?.wears, JSON.stringify(wearOne)).toBe(1);
    expect(await awaitRendezvous(walk), walk.bootLog().slice(-800)).toBe(true);
    expect(await wornBagOf(walk), "face 1 never stood worn before the stop").toBe(siblingBag);
    // THE LIT SIBLING WRITES BEFORE THE STOP: face 0, lit beside the worn face 1, lands a meme in its own layer.
    const SIB_MEME = "lar:///ha.ka.ba/kahua/memory/walk/sibling-before-stop";
    const sibFile = join(scratch, "sibling-before-stop.mem");
    writeFileSync(sibFile, memeText(SIB_MEME, "Before-stop"));
    const sibPut = await walk.cli(["put", `title=${SIB_MEME}`, `bag=${faceZeroBag}`, `file=${sibFile}`, "face=0", "--json"]);
    expect(sibPut.code, out(sibPut)).toBe(0);
    // Before the stop the sibling's save rests sealed: the census names no save held in memory. A sibling's push this island
    // never asked for may wait for a name (`save-unnamed`); it reads under `unasked`, never as an item, since the pushing
    // face keeps its copy, and the read-back after the boot below proves that copy survived.
    const preStop = await walk.cli(["vessel", "census", "--json"]);
    const heldBefore = ((data(preStop)["census"] as { items?: Array<{ kind: string; bagId?: string | null }> } | undefined)?.items ?? []).filter((i) => i.kind === "held-save");
    expect(heldBefore, `a save waits in memory before the stop: ${out(preStop)}`).toEqual([]);
    // THE STOP: every seat that rolls at the stand-down rests its Archive in its own face's row, or nowhere.
    await walk.stopDaemonOnly();
    expect(walk.bootLog(), "the stop sealed no Archive into another face's row").not.toMatch(refusedSeal);
    const stopLines = walk.bootLog().split("\n").filter((l) => /held|waits|unsealed|teardown|shutdown/.test(l)).slice(-30).join("\n");
    // THE BOOT over the same root (the harness unlocks face 0), then face 1 worn again.
    restand = await openStaged({ root: walk.root, port: walk.port, tag: "two-face-walk-restand", found: async () => {} });
    if (!(await awaitRendezvous(restand))) throw new Error(`the restood daemon bound no rendezvous:\n${restand.bootLog().slice(-800)}`);
    await door.unlockTestCustody(walk.root, "lock");
    const wearAgain = await door.unlockTestCustody(walk.root, "unlock", 1);
    expect((wearAgain as { wears?: number; held?: boolean } | null)?.wears, `face 1 refused to stand again: ${JSON.stringify(wearAgain)}\n${restand.bootLog().slice(-1600)}`).toBe(1);
    expect((wearAgain as { held?: boolean } | null)?.held, JSON.stringify(wearAgain)).not.toBe(false);
    expect(await awaitRendezvous(restand), restand.bootLog().slice(-800)).toBe(true);
    expect(await wornBagOf(restand), `face 1 never stood worn after the boot:\n${restand.bootLog().slice(-1600)}`).toBe(siblingBag);
    expect(restand.bootLog(), "face 1's row restores its own identity").not.toContain("ArchiveIdentityMismatch");
    expect(restand.bootLog()).not.toMatch(/archive restores identity .* and the seed derives/);
    expect(restand.bootLog()).not.toMatch(refusedSeal);
    // THE SIBLING'S WRITE SURVIVED THE STOP: face 0, lit again beside face 1, reads it back from its own layer.
    let back: CliResult | null = null;
    for (let look = 0; look < 30; look++) {
      back = await restand.cli(["get", `title=${SIB_MEME}`, `bag=${faceZeroBag}`, "face=0", "mu=assert", "--json"]);
      if (back.code === 0 && out(back).includes("Before-stop stands in its own layer")) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    expect(out(back!), `the sibling's write before the stop did not survive the boot; the stop said:\n${stopLines}`).toContain("Before-stop stands in its own layer");
  }, 480_000);
});
