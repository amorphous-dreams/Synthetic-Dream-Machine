/**
 * e2e/vessel-sealed — a vessel whose private rows rest sealed under its VESSEL KEY stands end to end, every step
 * through the built CLI and the custody door.
 *
 * A founding seals the keyhive archive, the face's veil archive and its anchors under the vessel key from their
 * first write. Every boot then rests at the FLOOR (faceless, carrying, every sovereign act waiting) until the key
 * opens on the custody door, and a lock or a restart returns it there. This witness walks that whole life on a
 * staged vessel it owns:
 *
 *   ① stand, locked                    the custody door reads no key held; the rows at rest carry the vessel key's
 *                                      seal; a recipe read answers nothing
 *   ② unlock                           the door opens the key and the vessel composes again as a hearth; a carrier
 *                                      put through the recipe reads back        (the CONTROL for every floor below)
 *   ③ lock                             the vessel drops the key and stands at the floor; the sealed rows keep their
 *                                      bytes; the recipe read answers nothing again
 *   ④ stop · stand                     a restart rests at the floor with every sealed row byte-identical: a floor
 *                                      stand writes no identity
 *   ⑤ unlock                           the same hearth answers: the carrier put in ② reads back by its hash, and
 *                                      the device share never moved
 *   ⑥ one reading of each file         `vault status` reads every hot and cold row sealed, each floor row beside the
 *                                      law it rests bare under, and no private file outside the carrier table
 *   ⑦ a word outside the seven         the vault door answers it as no door, and no byte of the share moves
 *
 * The custody door reads its credential from a terminal alone; this witness opens the staged root through the
 * harness door (`tools/unlock-test-custody.mjs`), which acts only on a root that carries the scratch marker.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openStaged, cliFor, foundStagedHearth, unlockStaged, type LarInstance, type CliResult } from "../harness/instance.js";
import { unlockTestCustody } from "../harness/test-door.js";
import { readVkCarrier } from "../../packages/lararium-mesh/src/vk-envelope.js";
import { readFckCarrier } from "../../packages/lararium-mesh/src/fck-envelope.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");

const PATH = "t.witness.seal/carrier";
const URI  = `lar:///${PATH}`;
const WIKI = ["--recipe", "lares"] as const;

const meme = (): string =>
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "${PATH}"\n\`\`\`\n\n` +
  `<<~ ahu #/a>>\n\n! a\n\n<<~/ahu>>\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

function missing(): string[] {
  const out: string[] = [];
  if (!existsSync(CLI_BIN))   out.push(`built CLI at ${CLI_BIN} (pnpm --filter @lares/cli build)`);
  if (!existsSync(NODE_MAIN)) out.push(`built node vessel at ${NODE_MAIN} (pnpm --filter @lararium/node build)`);
  if (process.env["LAR_TARGET"] === "live") out.push("a STAGED target — this witness locks, stops and re-stands a vessel, never a live hearth");
  return out;
}

const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;
const dataOf = (r: CliResult): Record<string, unknown> => (r.json?.["data"] ?? {}) as Record<string, unknown>;
const gaps = missing();
if (gaps.length > 0) console.error(`vessel-sealed: SKIPPED — missing ${gaps.join("; ")}`);

let lar: LarInstance | null = null;
/** The CLI under this vessel's pair, plus whatever environment a step adds. */
let cli: (env: Record<string, string>, args: readonly string[]) => Promise<CliResult>;
let carrierHash = "";
const PLAIN: Record<string, string> = {};

const identity = (file: string): string => join(lar!.root, "data/lares/identity", file);
/** The rows this witness watches at rest: the vessel-key family the founding seals, and the face rows beside it. */
const SEALED_ROWS = ["keyhive-archive.bin"] as const;
/** A face's row rests in that face's own directory: the file, found in whichever face holds it. */
const faceDirs = (): string[] => { try { return readdirSync(identity("faces")); } catch { return []; } };
const faceRowFile = (file: string): string => {
  const at = faceDirs().map((d) => identity(`faces/${d}/${file}`)).find((p) => { try { readFileSync(p); return true; } catch { return false; } });
  if (!at) throw new Error(`no face holds ${file}`);
  return at;
};
/** The face's veil archive rests under a name that carries its PersonaGroup's digest, so the witness finds it by its family. */
const veilArchiveRows = (): string[] => faceDirs().flatMap((d) => readdirSync(identity(`faces/${d}`)).filter((f) => /^veil-archive-g[0-9a-f]{64}\.bin$/.test(f)));
/** The face's own roster line: its name carries the login hint when the host has one. */
const rosterRow = (): string => {
  const name = faceDirs().flatMap((d) => readdirSync(identity(`faces/${d}`))).find((f) => /^\.persona-roster(?:-[^./]+?)?-h0\.json$/.test(f));
  if (!name) throw new Error("CONTROL: the founded face holds no roster line at rest");
  return name;
};
const rowsAtRest = (): Record<string, Buffer> => {
  const veil = veilArchiveRows();
  if (veil.length === 0) throw new Error("CONTROL: the founded face holds no veil archive at rest");
  return Object.fromEntries([
    ...SEALED_ROWS.map((f) => [f, readFileSync(identity(f))] as const),
    ["anchors-h0.json", readFileSync(faceRowFile("anchors-h0.json"))] as const,
    [rosterRow(), readFileSync(faceRowFile(rosterRow()))] as const,
    ...veil.map((f) => [f, readFileSync(faceRowFile(f))] as const),
  ]);
};
/** Each row reads its own key's seal: the vessel-key rows the VK's, the face rows their face's. */
const sealOf = (file: string, bytes: Buffer): string => ((SEALED_ROWS as readonly string[]).includes(file) ? readVkCarrier(bytes) : readFckCarrier(bytes));
const SHARE = (): string => faceRowFile("recovery-device-share-h0.bin");

/** The custody door's own reading of what stands. Looks are COUNTED while no daemon answers; no clock decides. */
async function custodyReading(): Promise<Record<string, unknown>> {
  for (let look = 0; look < 240; look++) {
    const r = unlockTestCustody(lar!.root, "status");
    if (r.code === 0 && r.answer) return r.answer;
    await new Promise((res) => setTimeout(res, 250));
  }
  throw new Error("the custody door never answered a status frame");
}

/** A recipe read of the witness carrier, as the vessel answers it right now. */
const readCarrier = (): Promise<CliResult> => cli(PLAIN, ["meme", "get", URI, ...WIKI, "--json"]);

/**
 * This suite's rite: the Stable founding act, then persona zero's root split, so a device share rests beside the sealed rows
 * and the passphrase lifecycle has a carrier of its own to seal.
 */
async function foundWithRootSplit(found: (args: readonly string[]) => Promise<CliResult>, root: string): Promise<void> {
  await foundStagedHearth(found, root, "staged");
  const face = await found(["persona", "new", "0", "--name", "staged", "--split-root"]);
  if (face.code !== 0) throw new Error(`staged face-founding with a root split failed (${face.code}):\n${face.stderr.slice(-800)}`);
}

describe.skipIf(gaps.length > 0)("★ a vessel sealed under its vessel key stands end to end ★", () => {
  let afterUnlock: Record<string, Buffer> = {};
  let shareAtFounding: Buffer = Buffer.alloc(0);

  beforeAll(async () => {
    lar = await openStaged({ tag: "sealed", found: foundWithRootSplit, locked: true });
    const base = { LAR_ROOT: lar.root, LAR_PORT: String(lar.port) };
    cli = (env, args) => cliFor({ ...base, ...env })(args);
    shareAtFounding = readFileSync(SHARE());
  }, 240_000);

  afterAll(async () => {
    if (!lar) return;
    // Whatever stood last was spawned DETACHED by `vessel stand`; the port is the handle to it.
    await cli(PLAIN, ["vessel", "stop", "--skip-build"]);
    await lar.stop();
  });

  test("① the vessel stands at the FLOOR: no key held, every founded row sealed under the vessel key", async () => {
    const reading = await custodyReading();
    expect(reading["unlocked"]).toBe(false);
    expect(reading["slot"]).toBeNull();
    for (const [file, bytes] of Object.entries(rowsAtRest())) {
      expect(sealOf(file, bytes), `${file} carries its key's seal`).toBe("sealed");
    }
    // No sovereign act answers on the floor: the recipe seat reads nothing.
    const r = await readCarrier();
    expect(r.json?.["ok"], said(r)).not.toBe(true);
    // The boot says so once, with the one verb that opens it (the line lands just after the vessel reaches live).
    for (let look = 0; look < 80 && !lar!.bootLog().includes("this vessel stands holding no vessel key"); look++) {
      await new Promise((res) => setTimeout(res, 250));
    }
    expect(lar!.bootLog()).toContain("this vessel stands holding no vessel key");
  });

  test("② unlock: the key opens, the vessel stands as a hearth, and a carrier put reads back", async () => {
    const opened = unlockTestCustody(lar!.root);
    expect(opened.code, JSON.stringify(opened.answer) + opened.stderr).toBe(0);
    expect(opened.answer).toMatchObject({ reading: "opens", standing: "hearth", held: true });
    expect((await custodyReading())["unlocked"]).toBe(true);

    const f = join(lar!.root, "seal-carrier.mem");
    writeFileSync(f, meme());
    const put = await cli(PLAIN, ["meme", "put", URI, ...WIKI, "--file", f, "--json"]);
    expect(put.json?.["ok"], said(put)).toBe(true);
    carrierHash = String(dataOf(put)["canonicalHash"]);
    const got = await readCarrier();
    expect(got.json?.["ok"], said(got)).toBe(true);
    expect(String(dataOf(got)["canonicalHash"])).toBe(carrierHash);

    // The hearth's own archive export lands through the sealed writer: still the vessel key's seal, never bare.
    for (const [file, bytes] of Object.entries(rowsAtRest())) expect(sealOf(file, bytes), file).toBe("sealed");
    expect(readFileSync(SHARE()).equals(shareAtFounding), "an unlock re-minted the device share").toBe(true);
  }, 300_000);

  test("③ lock: the vessel drops the key and stands at the floor; the sealed rows keep their bytes", async () => {
    // The rows as the hearth holds them, read after its own verbs answered and before the lock.
    afterUnlock = rowsAtRest();
    const locked = await cli(PLAIN, ["vault", "lock", "--json"]);
    expect(locked.json?.["ok"], said(locked)).toBe(true);
    expect(dataOf(locked)).toMatchObject({ locked: true, was: "unlocked", standing: "herm" });
    expect((await custodyReading())["unlocked"]).toBe(false);
    for (const [file, bytes] of Object.entries(rowsAtRest())) {
      expect(bytes.equals(afterUnlock[file]!), `the lock moved ${file}`).toBe(true);
    }
    const r = await readCarrier();
    expect(r.json?.["ok"], said(r)).not.toBe(true);
  }, 300_000);

  test("④ stop, then stand: a restart rests at the floor and writes no identity", async () => {
    await lar!.stopDaemonOnly();
    const stop = await cli(PLAIN, ["vessel", "stop", "--skip-build", "--json"]);
    expect(stop.code, said(stop)).toBe(0);
    const stand = await cli(PLAIN, ["vessel", "stand", "--skip-build", "--json"]);
    console.error(`vessel-sealed MEASURE ④ stand → exit ${stand.code} node=${JSON.stringify(dataOf(stand)["node"])}`);
    const reading = await custodyReading();
    expect(reading["unlocked"]).toBe(false);
    expect(reading["attemptsLeft"]).toBe(3);
    // THE FLOOR WRITES NO IDENTITY. A floor stand holds no archive; an export from it landing over the sealed
    // rows would replace the vessel's identity with an empty one. Every row stands exactly as the hearth left it.
    for (const [file, bytes] of Object.entries(rowsAtRest())) {
      expect(bytes.equals(afterUnlock[file]!), `the floor stand moved ${file}`).toBe(true);
    }
    const r = await readCarrier();
    expect(r.json?.["ok"], said(r)).not.toBe(true);
  }, 300_000);

  test("⑤ unlock again: the same hearth answers, and the carrier put before the restart reads back", async () => {
    unlockStaged(lar!.root);
    const reading = await custodyReading();
    expect(reading).toMatchObject({ unlocked: true, standing: "hearth" });
    const got = await readCarrier();
    expect(got.json?.["ok"], said(got)).toBe(true);
    expect(String(dataOf(got)["canonicalHash"])).toBe(carrierHash);
    for (const [file, bytes] of Object.entries(rowsAtRest())) expect(sealOf(file, bytes), file).toBe("sealed");
    expect(readFileSync(SHARE()).equals(shareAtFounding), "a stand re-minted the device share").toBe(true);
  }, 300_000);

  test("⑥ `vault status` gives one reading of each file: no row at fault, nothing outside the carrier table", async () => {
    const status = await cli(PLAIN, ["vault", "status", "--json"]);
    expect(status.json?.["ok"], said(status)).toBe(true);
    const custody = dataOf(status)["custody"] as {
      rows: { row: string; home: string; file: string; custody: string; reading: string; bare: string | null; fault: boolean }[];
      outside: { file: string; why: string }[];
    };
    expect(custody.outside, "a private file no row of the carrier table names").toEqual([]);
    expect(custody.rows.filter((r) => r.fault).map((r) => r.file)).toEqual([]);
    expect(new Set(custody.rows.map((r) => `${r.home}/${r.file}`)).size).toBe(custody.rows.length);
    for (const r of custody.rows) {
      if (r.custody === "hot" || r.custody === "cold" || r.custody === "face-hot" || r.custody === "face-cold") expect(r.reading, r.file).toBe("sealed");
      else expect(typeof r.bare === "string" && r.bare.length > 0, `${r.file} names the law it rests bare under`).toBe(true);
    }
    // CONTROL: the reading holds rows of both kinds, so neither loop above ran over nothing.
    expect(custody.rows.some((r) => r.row === "device-share" && r.reading === "sealed")).toBe(true);
    expect(custody.rows.some((r) => r.row === "s-slots" && r.reading === "bare")).toBe(true);
    expect(readFckCarrier(readFileSync(SHARE()))).toBe("sealed");
  }, 120_000);

  test("⑦ a word outside the vault door's seven verbs answers as no door, and the share keeps its bytes", async () => {
    const share = readFileSync(SHARE());
    for (const word of ["seal", "rotate", "repair", "passphrase", "export"]) {
      const r = await cli(PLAIN, ["vault", word, "--json"]);
      expect(r.code, word).not.toBe(0);
      expect(said(r), word).toContain(`unknown sub-verb "${word}"`);
    }
    expect(readFileSync(SHARE()).equals(share)).toBe(true);
    expect(existsSync(join(lar!.root, "backup"))).toBe(false);
  });
});
