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
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
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
    const got = await lar.cli(["meme", "get", URI, "--recipe", "lares", "--json"]);
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
 * Each act names its face by `--face N`, rides a session of that face, and lands in that face's own layer:
 *
 *   W1  a meme put (the lane) as face 1 lands in face 1's working layer; face 1 reads it back; the worn face reads absent
 *   W2  a tiddler put (the sibling's own TW5 engine) as face 1 lands there; face 1 reads it back; the worn face reads absent
 *   W3  the worn face's own write lands in its own layer, and face 1 reads it absent
 *   W4  CONTROL: a face that stands shut refuses `face-not-open`, and nothing writes
 */
describe("e2e/two-face-walk: a lit sibling writes into its own layers while another face stands worn", () => {
  const MEME = "lar:///ha.ka.ba/kahua/memory/walk/sibling-lane";
  const WORN_MEME = "lar:///ha.ka.ba/kahua/memory/walk/worn-lane";
  const TID = "$:/walk/sibling-engine";
  const memeText = (uri: string, word: string): string =>
    `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "${uri.replace("lar:///", "")}"\n\`\`\`\n\n` +
    `<<~ ahu slot=\`#/entry\`>>\n\n! ${word}\n\n${word} stands in its own layer.\n\n<<~/ahu>>\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;
  let walk: LarInstance;
  let scratch = "";
  /** The sibling's own daemon canon: its lane's one bag, by its own relation (`bags/daemon-<relation>`). */
  let siblingBag = "";

  beforeAll(async () => {
    const root = mkdtempSync(join(stageDir(), "lares-two-face-walk-"));
    walk = await openStaged({ root, tag: "two-face-walk", found: async (cli, staged) => {
      await foundStagedHearth(cli, staged, "worn-face");
      const second = await cli(["persona", "new", "1", "--name", "sibling-face", "--json"]);
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
    const wornBag = faceBagOf(await walk.cli(["wiki", "status", "--recipe", "default", "--json"]));
    await door.unlockTestCustody(walk.root, "lock");
    const wearOne = await door.unlockTestCustody(walk.root, "unlock", 1);
    if ((wearOne as { wears?: number } | null)?.wears !== 1) throw new Error(`the test door never wore face 1: ${JSON.stringify(wearOne)}`);
    if (!(await awaitRendezvous(walk))) throw new Error(`the daemon bound no rendezvous after wearing face 1:\n${walk.bootLog().slice(-800)}`);
    for (let look = 0; look < 90 && (siblingBag === "" || siblingBag === wornBag); look++) {
      const status = await walk.cli(["wiki", "status", "--recipe", "default", "--json"]);
      siblingBag = status.code === 0 ? faceBagOf(status) : "";
      if (siblingBag === "" || siblingBag === wornBag) await new Promise((r) => setTimeout(r, 1000));
    }
    if (siblingBag === "" || siblingBag === wornBag) throw new Error(`face 1 stood no daemon canon of its own once worn: ${siblingBag}`);
    await door.unlockTestCustody(walk.root, "lock");
    const wearZero = await door.unlockTestCustody(walk.root, "unlock", 0);
    if ((wearZero as { wears?: number } | null)?.wears !== 0) throw new Error(`the test door never wore face 0 again: ${JSON.stringify(wearZero)}`);
    if (!(await awaitRendezvous(walk))) throw new Error(`the daemon bound no rendezvous after wearing face 0:\n${walk.bootLog().slice(-800)}`);
    for (let look = 0; look < 90; look++) {
      const status = await walk.cli(["wiki", "status", "--recipe", "default", "--json"]);
      if (status.code === 0 && faceBagOf(status) === wornBag) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }, 240_000);
  afterAll(async () => { await walk?.stop(); });

  const data = (r: CliResult): Record<string, unknown> => (r.json?.["data"] ?? {}) as Record<string, unknown>;
  const errCode = (r: CliResult): unknown => (r.json?.["error"] as { code?: unknown } | undefined)?.code;
  const out = (r: CliResult): string => `${r.stdout}\n${r.stderr}`;

  test("W0: the sibling's engine composes over its own daemon wiki: its daemon canon and working layer open and take a write", async () => {
    const s = await walk.cli(["wiki", "status", "--recipe", "default", "--face", "1", "--json"]);
    expect(s.code, out(s)).toBe(0);
    const status = data(s) as { working: string | null; layers: Array<{ bag: string; write: boolean; working?: boolean }> };
    expect(status["face" as never], "the answer names the sibling").toBe(1);
    expect(status.working, `the sibling's working layer never opened: ${JSON.stringify(status.layers)}`).not.toBeNull();
    expect(status.layers.find((l) => l.working), JSON.stringify(status.layers)).toMatchObject({ write: true });
    expect(status.layers.find((l) => l.bag === siblingBag), `the sibling daemon canon never opened: ${JSON.stringify(status.layers)}`).toMatchObject({ write: true });
  }, 120_000);

  test("W1: a meme put as face 1 lands in face 1's working layer, face 1 reads it back, the worn face reads absent", async () => {
    const file = join(scratch, "sibling-lane.mem");
    writeFileSync(file, memeText(MEME, "Sibling"));
    const put = await walk.cli(["meme", "put", MEME, "--bag", siblingBag, "--file", file, "--face", "1", "--json"]);
    expect(put.code, out(put)).toBe(0);
    expect(data(put)["face"], "the answer names the face it landed in").toBe(1);
    const back = await walk.cli(["meme", "get", MEME, "--bag", siblingBag, "--face", "1", "--json"]);
    expect(back.code, out(back)).toBe(0);
    expect(out(back)).toContain("Sibling stands in its own layer");
    const worn = await walk.cli(["meme", "get", MEME, "--recipe", "default", "--json"]);
    expect(out(worn), "the worn face never sees the sibling's working layer").not.toContain("Sibling stands in its own layer");
    expect(worn.code, out(worn)).not.toBe(0);
  }, 180_000);

  test("W2: a tiddler put as face 1 (its engine) lands in face 1's layer, face 1 reads it back, the worn face reads absent", async () => {
    const put = await walk.cli(["tiddler", "put", TID, "--recipe", "default", "--text", "sibling engine word", "--create", "--face", "1", "--json"]);
    expect(put.code, out(put)).toBe(0);
    expect(data(put)["decision"]).toBe("put");
    expect(data(put)["face"]).toBe(1);
    const back = await walk.cli(["tiddler", "get", TID, "--recipe", "default", "--face", "1", "--json"]);
    expect(back.code, out(back)).toBe(0);
    expect(JSON.stringify(back.json)).toContain("sibling engine word");
    const worn = await walk.cli(["tiddler", "get", TID, "--recipe", "default", "--json"]);
    expect(worn.code, out(worn)).not.toBe(0);
    expect(errCode(worn)).toBe("not-found");
    expect(JSON.stringify(worn.json)).not.toContain("sibling engine word");
  }, 180_000);

  test("W3: the worn face's own write still lands in its own layer, and the sibling reads it absent", async () => {
    const file = join(scratch, "worn-lane.mem");
    writeFileSync(file, memeText(WORN_MEME, "Worn"));
    const put = await walk.cli(["meme", "put", WORN_MEME, "--recipe", "default", "--file", file, "--json"]);
    expect(put.code, out(put)).toBe(0);
    const back = await walk.cli(["meme", "get", WORN_MEME, "--recipe", "default", "--json"]);
    expect(back.code, out(back)).toBe(0);
    expect(out(back)).toContain("Worn stands in its own layer");
    const sibling = await walk.cli(["meme", "get", WORN_MEME, "--recipe", "default", "--face", "1", "--json"]);
    expect(out(sibling), "the sibling never sees the worn face's working layer").not.toContain("Worn stands in its own layer");
    expect(sibling.code, out(sibling)).not.toBe(0);
    const tid = await walk.cli(["tiddler", "put", "$:/walk/worn-engine", "--recipe", "default", "--text", "worn engine word", "--create", "--json"]);
    expect(tid.code, out(tid)).toBe(0);
    const seen = await walk.cli(["tiddler", "get", "$:/walk/worn-engine", "--recipe", "default", "--face", "1", "--json"]);
    expect(seen.code, out(seen)).not.toBe(0);
  }, 180_000);

  test("W4 CONTROL: a face that stands shut refuses `face-not-open` on a meme put and a tiddler put, and nothing writes", async () => {
    const file = join(scratch, "shut-lane.mem");
    writeFileSync(file, memeText("lar:///ha.ka.ba/kahua/memory/walk/shut-lane", "Shut"));
    const meme = await walk.cli(["meme", "put", "lar:///ha.ka.ba/kahua/memory/walk/shut-lane", "--recipe", "default", "--file", file, "--face", "7", "--json"]);
    expect(meme.code).not.toBe(0);
    expect(errCode(meme), out(meme)).toBe("face-not-open");
    const tid = await walk.cli(["tiddler", "put", "$:/walk/shut-engine", "--recipe", "default", "--text", "x", "--create", "--face", "7", "--json"]);
    expect(tid.code).not.toBe(0);
    expect(errCode(tid), out(tid)).toBe("face-not-open");
  }, 120_000);
});
