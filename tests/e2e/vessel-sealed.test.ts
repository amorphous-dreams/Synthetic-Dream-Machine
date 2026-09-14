/**
 * e2e/vessel-sealed — a SEALED vessel stands end to end, every step through the built CLI.
 *
 * The at-rest seal wraps the secret carriers the founding leaves (the keyhive archive, the veil archive,
 * the device recovery share the face founding mints) in a scrypt/AES-GCM envelope under an operator
 * passphrase. This witness walks the whole lifecycle a sealed
 * hearth lives by, on a staged vessel it owns:
 *
 *   ① stand fresh                     `vault status` reads cleartext, `sealExpected` false
 *   ② seal (daemon-first)             `vault seal --yes` under LARES_ARCHIVE_PASSPHRASE_NEW → sealed (passphrase)
 *   ③ stop · stand WITHOUT the key    CONTROL — the boot names the seal and stands at the WAKING FLOOR
 *   ④ stop · stand WITH the key       the UDS answers `meme get`, the carrier put before the seal reads back
 *   ⑤ rotate old→new (daemon-first)   stop · stand under the NEW key → the UDS answers again
 *   ⑥ export a sealed backup          the file wears the envelope; `vault status --check` reports the split truthfully
 *
 * WHERE THE DAEMON RE-READS THE ARCHIVE: at boot only (`open-node-vessel` → `archiveOpens()` →
 * `loadIdentityArchive`). A running daemon that seals or rotates updates its OWN in-memory policy in the same
 * act (`runVaultVerb`), so no restart is needed for the seal to take; the restart here proves the DISK.
 *
 * The passphrase rides the environment and never argv — `vault seal`/`rotate`/`export` read the NEW
 * passphrase from LARES_ARCHIVE_PASSPHRASE_NEW under `--yes`, the CURRENT one from LARES_ARCHIVE_PASSPHRASE.
 * A witness under `--yes` with only the current var set is the usage CONTROL below.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openStaged, cliFor, type LarInstance, type CliResult } from "../harness/instance.js";
import { isSealedEnvelope } from "../../packages/lararium-mesh/src/archive-envelope.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");

const PASS_1 = "witness-seal-passphrase-one";
const PASS_2 = "witness-seal-passphrase-two";
const BACKUP = "witness-backup-passphrase";

const PATH = "t.witness.seal/carrier";
const URI  = `lar:///${PATH}`;
const WIKI = ["--recipe", "lares"] as const;
const BOOT_MEME = "lar:///ha.ka.ba/lares/api/noosphere-boot";

const meme = (): string =>
  `<<^ code="&#x0001;" from=? -> to=${URI}>>\n\`\`\`toml meta\nuri-path = "${PATH}"\n\`\`\`\n\n` +
  `<<^ code="&#x0002;">>\n\n<<~ ahu #/a>>\n\n! a\n\n<<~/ahu>>\n\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

function missing(): string[] {
  const out: string[] = [];
  if (!existsSync(CLI_BIN))   out.push(`built CLI at ${CLI_BIN} (pnpm --filter @lares/cli build)`);
  if (!existsSync(NODE_MAIN)) out.push(`built node vessel at ${NODE_MAIN} (pnpm --filter @lararium/node build)`);
  if (process.env["LAR_TARGET"] === "live") out.push("a STAGED target — this witness seals, stops and re-stands a vessel, never a live hearth");
  return out;
}

const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;
/** The `data` half of a `--json` emission — every vault reading rides there. */
const dataOf = (r: CliResult): Record<string, unknown> => (r.json?.["data"] ?? {}) as Record<string, unknown>;
const carriersOf = (r: CliResult): Record<string, { state: string; mode?: string; opensUnderProbe?: boolean }> =>
  (dataOf(r)["carriers"] ?? {}) as Record<string, { state: string; mode?: string; opensUnderProbe?: boolean }>;
const gaps = missing();
if (gaps.length > 0) console.error(`vessel-sealed: SKIPPED — missing ${gaps.join("; ")}`);

let lar: LarInstance | null = null;
/** The CLI under this vessel's pair plus an explicit passphrase environment. An EMPTY value blanks any
 *  passphrase the test runner's own shell carries, so "without the key" means without it. */
let cli: (env: Record<string, string>, args: readonly string[]) => Promise<CliResult>;
let carrierHash = "";
/** The sealed archive's bytes as `vault seal` left them — the floor stand below must leave them alone. */
let sealedArchive: Buffer = Buffer.alloc(0);
const ARCHIVE = (): string => join(lar!.root, "data/lares/identity/keyhive-archive.bin");
/** The device share as the seal left it — every stand below must leave it byte-identical (a re-stand never re-mints). */
let sealedShare: Buffer = Buffer.alloc(0);
const SHARE = (): string => join(lar!.root, "data/lares/identity/recovery-device-share-h0.bin");

/** Poll the CLI until the UDS answers a read, or the deadline passes. */
async function awaitAnswer(env: Record<string, string>, timeoutMs = 120_000): Promise<CliResult> {
  const deadline = Date.now() + timeoutMs;
  let last: CliResult | null = null;
  for (;;) {
    last = await cli(env, ["meme", "get", URI, ...WIKI, "--json"]);
    if (last.json?.["ok"] === true) return last;
    if (Date.now() > deadline) return last;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const NO_KEY = { LARES_ARCHIVE_PASSPHRASE: "", LARES_ARCHIVE_PASSPHRASE_NEW: "" };
const KEY_1  = { ...NO_KEY, LARES_ARCHIVE_PASSPHRASE: PASS_1 };
const KEY_2  = { ...NO_KEY, LARES_ARCHIVE_PASSPHRASE: PASS_2 };

describe.skipIf(gaps.length > 0)("★ a sealed vessel stands end to end ★", () => {
  beforeAll(async () => {
    lar = await openStaged({ tag: "sealed" });
    const base = { LAR_ROOT: lar.root, LAR_PORT: String(lar.port) };
    cli = (env, args) => cliFor({ ...base, ...env })(args);
    const f = join(lar.root, "seal-carrier.mem");
    writeFileSync(f, meme());
    const put = await cli(NO_KEY, ["meme", "put", URI, ...WIKI, "--file", f, "--json"]);
    if (put.json?.["ok"] !== true) throw new Error(`put refused before the seal\n${said(put)}`);
    carrierHash = String((put.json["data"] as Record<string, unknown>)["canonicalHash"]);
  }, 240_000);

  afterAll(async () => {
    if (!lar) return;
    // Whatever stood last was spawned DETACHED by `vessel stand`; the port is the handle to it.
    await cli(NO_KEY, ["vessel", "stop", "--skip-build"]);
    await lar.stop();
  });

  test("① a fresh vessel reads CLEARTEXT and expects no seal", async () => {
    const r = await cli(NO_KEY, ["vault", "status", "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    const carriers = carriersOf(r);
    expect(carriers["archive"]?.state).toBe("cleartext");
    // The face founding ARMS recovery: the device share stands from day one (absent by omission and absent
    // by choice read identical from outside — only the mint tells them apart). The reserve share belongs
    // to the seal rite and stays absent here (CONTROL: one leg, not two).
    expect(carriers["device-share-h0"]?.state).toBe("cleartext");
    expect(carriers["reserve-share"]?.state).toBe("absent");
    expect(dataOf(r)["sealExpected"]).toBe(false);
    expect(dataOf(r)["via"]).toBe("daemon");
  });

  test("② CONTROL: `vault seal --yes` with only the CURRENT var set refuses by usage, naming the NEW var", async () => {
    const r = await cli(KEY_1, ["vault", "seal", "--yes", "--json"]);
    expect(r.json?.["ok"]).toBe(false);
    expect(said(r)).toContain("LARES_ARCHIVE_PASSPHRASE_NEW");
    const s = await cli(NO_KEY, ["vault", "status", "--json"]);
    expect(carriersOf(s)["archive"]?.state).toBe("cleartext");
  });

  test("② `vault seal --yes` under LARES_ARCHIVE_PASSPHRASE_NEW seals every present carrier through the daemon", async () => {
    const r = await cli({ ...NO_KEY, LARES_ARCHIVE_PASSPHRASE_NEW: PASS_1 }, ["vault", "seal", "--yes", "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    expect(dataOf(r)["via"]).toBe("daemon");
    // The vessel archive, the veil archive AND the device share — one policy, one act.
    expect(dataOf(r)["sealed"]).toEqual(expect.arrayContaining(["archive", "veil", "device-share-h0"]));
    const s = await cli(NO_KEY, ["vault", "status", "--json"]);
    const carriers = carriersOf(s);
    expect(carriers["archive"]).toMatchObject({ state: "sealed", mode: "passphrase" });
    expect(carriers["veil"]).toMatchObject({ state: "sealed", mode: "passphrase" });
    expect(carriers["device-share-h0"]).toMatchObject({ state: "sealed", mode: "passphrase" });
    expect(carriers["reserve-share"]).toMatchObject({ state: "absent" });
    expect(dataOf(s)["sealExpected"]).toBe(true);
    // The archive on disk wears the envelope — bare bytes would be the seal faked.
    sealedArchive = readFileSync(ARCHIVE());
    expect(isSealedEnvelope(sealedArchive)).toBe(true);
    sealedShare = readFileSync(SHARE());
    expect(isSealedEnvelope(sealedShare)).toBe(true);
  });

  test("③ CONTROL: stop, then stand WITHOUT the passphrase — the boot names the seal and stands at the WAKING FLOOR", async () => {
    await lar!.stopDaemonOnly();
    const stop = await cli(NO_KEY, ["vessel", "stop", "--skip-build", "--json"]);
    expect(stop.code, said(stop)).toBe(0);
    const stand = await cli(NO_KEY, ["vessel", "stand", "--skip-build", "--json"]);
    console.error(`vessel-sealed MEASURE ③ stand without the key → exit ${stand.code} node=${JSON.stringify(dataOf(stand)["node"])}`);
    const log = readFileSync(join(lar!.root, "data/lares/vessel/stand.log"), "utf8");
    // The boot's own words: the archive holds shut, and the cure is the env var.
    expect(log).toMatch(/archive holds shut|archive-seal: found a sealed archive|LARES_ARCHIVE_PASSPHRASE/);
    // No sovereign act answers on the floor: the recipe seat reads nothing.
    const r = await cli(NO_KEY, ["meme", "get", URI, ...WIKI, "--json"]);
    console.error(`vessel-sealed MEASURE ③ meme get on the floor → ${said(r).trim().slice(0, 400)}`);
    expect(r.json?.["ok"]).not.toBe(true);
    // THE FLOOR WRITES NO IDENTITY. The M3 re-seal exports the booted keyhive every boot, and a floor stand
    // boots WITHOUT the archive — so a fresh, empty, cleartext archive over the sealed one is the defect
    // this guards against. The bytes must stand exactly as the seal left them.
    const after = readFileSync(ARCHIVE());
    expect(isSealedEnvelope(after), "the sealed archive survives a floor stand").toBe(true);
    expect(after.equals(sealedArchive), "the floor stand rewrote the sealed archive").toBe(true);
    expect(readFileSync(SHARE()).equals(sealedShare), "the floor stand re-minted the device share").toBe(true);
    const s = await cli(NO_KEY, ["vault", "status", "--json"]);
    expect(carriersOf(s)["archive"]).toMatchObject({ state: "sealed", mode: "passphrase" });
  }, 300_000);

  test("④ stop, then stand WITH the passphrase — the UDS answers and the carrier put before the seal reads back", async () => {
    const stop = await cli(NO_KEY, ["vessel", "stop", "--skip-build", "--json"]);
    expect(stop.code, said(stop)).toBe(0);
    const stand = await cli(KEY_1, ["vessel", "stand", "--skip-build", "--json"]);
    console.error(`vessel-sealed MEASURE ④ stand with the key → exit ${stand.code} node=${JSON.stringify(dataOf(stand)["node"])}`);
    const r = await awaitAnswer(KEY_1);
    expect(r.json?.["ok"], said(r)).toBe(true);
    expect(String((r.json?.["data"] as Record<string, unknown>)["canonicalHash"])).toBe(carrierHash);
    // The boot meme, if the staged root seeds it — measured, never required.
    const boot = await cli(KEY_1, ["meme", "get", BOOT_MEME, "--bag", "lares", "--json"]);
    console.error(`vessel-sealed MEASURE ④ meme get ${BOOT_MEME} --bag lares → ok=${boot.json?.["ok"]}`);
    const s = await cli(KEY_1, ["vault", "status", "--json"]);
    expect(dataOf(s)["via"]).toBe("daemon");
    expect(dataOf(s)["passphraseEnvSet"]).toBe(true);
    // CONTROL: a lit stand re-seals the archive (M3) and never touches the device share — same bytes.
    expect(readFileSync(SHARE()).equals(sealedShare), "a lit stand re-minted the device share").toBe(true);
  }, 300_000);

  test("⑤ `vault rotate` old→new through the daemon; a restart under the NEW passphrase answers", async () => {
    const wrong = await cli({ ...KEY_2, LARES_ARCHIVE_PASSPHRASE_NEW: PASS_2 }, ["vault", "rotate", "--yes", "--json"]);
    expect(wrong.json?.["ok"], "CONTROL: a wrong old passphrase rotates nothing").toBe(false);
    const r = await cli({ ...KEY_1, LARES_ARCHIVE_PASSPHRASE_NEW: PASS_2 }, ["vault", "rotate", "--yes", "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    expect(dataOf(r)["via"]).toBe("daemon");
    // Every present carrier moves in one act: a veil left under the old passphrase faults the next boot at
    // its GCM tag while the archive opens — a split the rotate itself would have made.
    expect(dataOf(r)["rotated"]).toEqual(["archive", "veil", "device-share-h0"]);   // the reserve share stands absent — one leg
    // The share re-sealed under the NEW passphrase: fresh envelope bytes, opened by PASS_2 alone.
    const rotatedShare = readFileSync(SHARE());
    expect(rotatedShare.equals(sealedShare), "rotate left the device share under the old passphrase").toBe(false);
    sealedShare = rotatedShare;

    const stop = await cli(NO_KEY, ["vessel", "stop", "--skip-build", "--json"]);
    expect(stop.code, said(stop)).toBe(0);
    const stale = await cli(KEY_1, ["vessel", "stand", "--skip-build", "--json"]);
    console.error(`vessel-sealed MEASURE ⑤ stand under the OLD key → exit ${stale.code} node=${JSON.stringify(dataOf(stale)["node"])}`);
    const staleRead = await cli(KEY_1, ["meme", "get", URI, ...WIKI, "--json"]);
    console.error(`vessel-sealed MEASURE ⑤ meme get under the OLD key → ${said(staleRead).trim().slice(0, 400)}`);
    expect(staleRead.json?.["ok"], "CONTROL: the old passphrase opens nothing").not.toBe(true);

    await cli(NO_KEY, ["vessel", "stop", "--skip-build", "--json"]);
    const stand = await cli(KEY_2, ["vessel", "stand", "--skip-build", "--json"]);
    console.error(`vessel-sealed MEASURE ⑤ stand under the NEW key → exit ${stand.code} node=${JSON.stringify(dataOf(stand)["node"])}`);
    const read = await awaitAnswer(KEY_2);
    expect(read.json?.["ok"], said(read)).toBe(true);
    expect(String((read.json?.["data"] as Record<string, unknown>)["canonicalHash"])).toBe(carrierHash);
    expect(readFileSync(SHARE()).equals(sealedShare), "the stand after rotate re-minted the device share").toBe(true);
  }, 600_000);

  test("⑥ `vault export` writes a sealed backup; `vault status --check` reports the split truthfully", async () => {
    const dest = join(lar!.root, "backup", "archive.sealed");
    const r = await cli({ ...KEY_2, LARES_ARCHIVE_PASSPHRASE_NEW: BACKUP }, ["vault", "export", dest, "--yes", "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    expect(dataOf(r)["via"]).toBe("daemon");
    expect(existsSync(dest)).toBe(true);
    const live = readFileSync(join(lar!.root, "data/lares/identity/keyhive-archive.bin"));
    const backup = readFileSync(dest);
    expect(isSealedEnvelope(backup)).toBe(true);
    // A backup sealed under ITS OWN passphrase and a fresh salt never repeats the live envelope's bytes.
    expect(backup.equals(live)).toBe(false);
    const clobber = await cli({ ...KEY_2, LARES_ARCHIVE_PASSPHRASE_NEW: BACKUP }, ["vault", "export", dest, "--yes", "--json"]);
    expect(clobber.json?.["ok"], "CONTROL: a silent overwrite refuses without --force").toBe(false);

    // The probe: the live passphrase opens BOTH carriers; a wrong one opens NEITHER; no split either way.
    const right = await cli(KEY_2, ["vault", "status", "--check", "--json"]);
    const rc = carriersOf(right);
    expect(rc["archive"]?.opensUnderProbe).toBe(true);
    expect(rc["veil"]?.opensUnderProbe).toBe(true);
    expect(rc["device-share-h0"]?.opensUnderProbe).toBe(true);
    expect(rc["reserve-share"]?.opensUnderProbe, "an absent carrier answers no probe").toBeUndefined();
    expect(dataOf(right)["split"]).toBe(false);
    const wrong = await cli(KEY_1, ["vault", "status", "--check", "--json"]);
    const wc = carriersOf(wrong);
    expect(wc["archive"]?.opensUnderProbe).toBe(false);
    expect(wc["veil"]?.opensUnderProbe).toBe(false);
    expect(wc["device-share-h0"]?.opensUnderProbe).toBe(false);
    expect(wc["reserve-share"]?.opensUnderProbe).toBeUndefined();
    expect(dataOf(wrong)["split"]).toBe(false);
  }, 120_000);
});
