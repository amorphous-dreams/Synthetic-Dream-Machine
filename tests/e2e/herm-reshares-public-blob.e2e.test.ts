/**
 * e2e/herm-reshares-public-blob — THE THREE-VESSEL RE-SHARE (basket-one #/the-fetch-door: "a public blob
 * travels to a Herm before any hearth serves it"), stood against live vessels.
 *
 * The fleet (`openStagedFleet`): a HERM at the crossroads (Socket B relay + the public read-face), a founder A
 * dialing it, a same-operator joiner C dialing A's `/ws` for the CRDT and the Herm for bytes, naming the Herm's
 * read-face as its public shore (`LAR_HERM_SHORE`). Then:
 *
 *   ③ A declares `bags/lares` PUBLIC and LOADs `photo.png` (+ `.meta`) → A's `cid/` holds the bytes, the CRDT the pointer
 *   ④ the POINTER crosses to C (`wiki which`)
 *   ⑤ MEASURE: what the Herm's `/cas/<cid>` answers while A still stands
 *   ⑥ A goes DARK (`stopDaemonOnly` — A's staged root only; the home vessel is never touched)
 *   ★ ⑦ C reads the cid through its fetch door with A dark: the fleet leg misses, the Herm leg (`hermCasTransit`,
 *       0449d1bab's `GET /cas/<cid>`) answers, the sha256 verifies, the bytes land in C's `cid/`
 *
 * MEASURED 2026-09-12, then RE-MEASURED against the realm lane — the vector still stands as `test.fails`,
 * and its seam narrowed. The shore no longer reads the Herm's OWN crossroads alone: `publicCasShore` follows,
 * for each realm the vessel serves, the pointers that realm's PUBLIC-tier registrations name (unit-proven,
 * `packages/lararium-node/tests/herm-follows-realm-public.test.ts`). THIS fleet names no realm — the Herm
 * seats no charter (`openStagedFleet` runs no `nexus rite cabal` and imports none), so it stands in none, the
 * realm lane folds empty, and A's public bag registers nowhere. So the Herm still holds neither the pointer
 * nor the bytes, `/cas/<cid>` draws 404 with A up or dark, and C reads PENDING (`held:false`).
 * WHAT THE FLIP NOW WAITS ON: a FLEET-shaped lane — either this fleet's hearth and its Herm come to stand in
 * ONE realm (a charter seated, exported, imported, and `lares nexus realm-bag lares --tier public` registering
 * the book), or the ruling names how a Herm follows a fleet it relays for without one. The road from C to the Herm
 * stands and is unit-proven (`herm-cas-transit.test.ts`); the road from A's public bag TO the Herm's board
 * belongs to the founding session's dial and gate. CONTROLS: a ghost cid draws the Herm's 404 byte-identical
 * with A dark; the boot CAS still serves at `/bulb/<cid>.bin`; C's fetch of a ghost reads `held:false` and
 * writes nothing.
 *
 * Run ALONE (`LAR_STAGE_DIR` under a tmp dir): three daemons, ~2 min.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { openStagedFleet, vesselStorageDir, type LarInstance, type StagedFleet } from "../harness/instance.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");

/** A 1×1 transparent PNG — small, binary, `image/png` by extension and by declaration. */
const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const CID_RAW    = createHash("sha256").update(PNG_BYTES).digest("hex");
const CID_BASE64 = createHash("sha256").update(Buffer.from(PNG_BYTES.toString("base64"), "utf8")).digest("hex");
const GHOST      = createHash("sha256").update("a likeness nobody ever staged").digest("hex");

const LOCI  = "t.witness.herm";
const TITLE = `lar:///${LOCI}/photo`;
const LARES_BAG = "lar:///ha.ka.ba/bags/lares";

const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;
const casDirOf = (v: LarInstance): string => join(vesselStorageDir(v), "cas");
const listCas = (v: LarInstance): string[] => { try { return readdirSync(casDirOf(v)).filter((n) => /^[0-9a-f]{64}$/.test(n)); } catch { return []; } };
const sha = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex");

async function awaitWhich(v: LarInstance, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  for (;;) {
    const r = await v.cli(["wiki", "which", TITLE, "--no-json"]);
    last = r.stdout;
    if (last.includes(`  ${LARES_BAG}`)) return last;
    if (Date.now() > deadline) return last;
    await new Promise((res) => setTimeout(res, 1000));
  }
}

function missing(): string[] {
  const out: string[] = [];
  if (!existsSync(CLI_BIN))   out.push(`built CLI at ${CLI_BIN}`);
  if (!existsSync(NODE_MAIN)) out.push(`built node vessel at ${NODE_MAIN}`);
  if (process.env["LAR_TARGET"] === "live") out.push("a STAGED target — this witness founds three vessels, and never writes to a live hearth");
  return out;
}
const gaps = missing();
if (gaps.length > 0) console.error(`herm-reshares-public-blob: SKIPPED — missing ${gaps.join("; ")}`);

let fleet: StagedFleet | null = null;
let standGate = "";
let cid = "";

describe.skipIf(gaps.length > 0)("★ a fleet peer stages a PUBLIC blob and goes dark — does the Herm re-share it to C? ★", () => {
  beforeAll(async () => {
    try { fleet = await openStagedFleet({ tag: "herm-reshare" }); }
    catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      standGate = (text.split("\n").find((l) => /nexus-join|fatal|failed/.test(l)) ?? text.slice(-400)).trim();
      console.error(`herm-reshares-public-blob: the fleet never stood — every vector SKIPS. It said:\n  ${standGate}`);
    }
  }, 500_000);

  afterAll(async () => { if (fleet) await fleet.stop(); });

  test("①② the fleet stands: the Herm at the crossroads, A founded, C by A's signed edge — the crossing opens", () => {
    expect(fleet, standGate).not.toBeNull();
    expect(fleet!.admitted.code, said(fleet!.admitted)).toBe(0);
    expect(fleet!.herm.bootLog()).toContain("crossroads relay standing");
    expect(fleet!.C.bootLog()).toContain("[lar-leaf] verdict OK — crossing open, syncing");
  });

  test("③ A LOADs the png and declares bags/lares PUBLIC: the bytes rest in A's cid/, the CRDT holds a pointer", async () => {
    const { A } = fleet!;
    const srcDir = join(A.root, "blob-stage/bags/lares", LOCI);
    mkdirSync(srcDir, { recursive: true });
    writeFileSync(join(srcDir, "photo.png"), PNG_BYTES);
    writeFileSync(join(srcDir, "photo.png.meta"), "type: image/png\n");
    const ld = await A.cli(["act", "LOAD", "--source-uri", srcDir, "--to", LARES_BAG, "--yes", "--json"]);
    expect(ld.json?.["ok"], said(ld)).toBe(true);
    const casA = listCas(A);
    cid = casA.includes(CID_RAW) ? CID_RAW : casA.includes(CID_BASE64) ? CID_BASE64 : "";
    expect(cid, `A's cid/ holds neither sha256(raw) nor sha256(base64); it holds ${casA.map((c) => c.slice(0, 12)).join(",")}`).not.toBe("");
    expect(await awaitWhich(A, 30_000)).toContain(`  ${LARES_BAG}`);
    // The declaration wants the hearth bag dir, which the projector lays down as the record lands — so it
    // follows the LOAD. A declaration moves no bytes; the tier reader re-reads the manifest within 30s.
    const deadline = Date.now() + 30_000;
    while (!existsSync(join(A.root, "bags/lares")) && Date.now() < deadline) await new Promise((r) => setTimeout(r, 500));
    const decl = await A.cli(["bag", "declare", "lares", "--tier", "public", "--json"]);
    const show = await A.cli(["bag", "show", "lares", "--json"]);
    console.error(`herm-reshares MEASURE A: bag declare lares --tier public → ${said(decl).trim().slice(0, 200)}\n  bag show lares → ${said(show).trim().slice(0, 300)}`);
    expect(decl.json?.["ok"], said(decl)).toBe(true);
  }, 90_000);

  test("④ the POINTER crosses to C", async () => {
    const which = await awaitWhich(fleet!.C, 90_000);
    console.error(`herm-reshares MEASURE C: wiki which ${TITLE}\n${which.trim()}`);
    expect(which, "the record did not cross — C's bag never answered the title").toContain(`  ${LARES_BAG}`);
  }, 120_000);

  test("⑤ MEASURE: the Herm's /cas/<cid> while A still stands", async () => {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(`${fleet!.hermShore}/cas/${cid}`);
    const hermCas = listCas(fleet!.herm);
    console.error(`herm-reshares MEASURE herm: GET /cas/${cid.slice(0, 12)}… → ${res.status} (A up) · herm cid/ holds the cid: ${hermCas.includes(cid)} (${hermCas.length} blobs)`);
    expect([200, 404]).toContain(res.status);
  }, 30_000);

  test("⑥ A goes DARK — its staged daemon alone", async () => {
    await fleet!.A.stopDaemonOnly();
    const alive = await fetch(`http://127.0.0.1:${fleet!.A.port}/oracle/pointer`).then(() => true).catch(() => false);
    expect(alive, "A's read-face still answers — A never went dark").toBe(false);
  }, 30_000);

  // THE VECTOR THE LAW OWES. Red today, for the seam the file header names: the Herm holds no pointer and no bytes.
  test.fails("★ ⑦ with A dark, C reads the cid through the Herm: `bag cas --fetch` held:true, bytes verify in C's cid/ ★", async () => {
    const { C, hermShore } = fleet!;
    // The island's own read may have pulled the bytes while A stood (fetch-on-read, measured in blob-follows-
    // pointer); the vector wants a MISS on C, so the staged copy leaves before the read — A is dark, the Herm is
    // the only road left.
    const held = join(casDirOf(C), cid);
    const heldBefore = existsSync(held);
    if (heldBefore) rmSync(held, { force: true });
    const direct = await fetch(`${hermShore}/cas/${cid}`);
    const r = await C.cli(["bag", "cas", "--fetch", cid, "--json"]);
    console.error([
      `herm-reshares MEASURE C (A dark): C held the bytes before the read: ${heldBefore} (removed to force the miss)`,
      `  GET ${hermShore}/cas/${cid.slice(0, 12)}… → ${direct.status} ${direct.status === 404 ? JSON.stringify(await direct.text()) : ""}`,
      `  bag cas --fetch → ${said(r).trim().slice(0, 300)}`,
      `  C carriage (last 6): ${C.bootLog().split("\n").filter((l) => /\[carriage\]|fetch door/.test(l)).slice(-6).join(" | ")}`,
    ].join("\n"));
    expect(direct.status).toBe(200);
    expect(sha(new Uint8Array(await direct.arrayBuffer()))).toBe(cid);
    expect(r.json?.["ok"], said(r)).toBe(true);
    expect((r.json?.["data"] as Record<string, unknown> | undefined)?.["held"]).toBe(true);
    expect(existsSync(held)).toBe(true);
    expect(sha(readFileSync(held))).toBe(cid);
  }, 90_000);

  test("CONTROL: a ghost cid draws the Herm's 404 byte-identical with A dark", async () => {
    const res = await fetch(`${fleet!.hermShore}/cas/${GHOST}`);
    expect(res.status).toBe(404);
    expect(await res.text()).toBe("unknown or stale bulb cid");
  }, 30_000);

  test("CONTROL: the Herm's boot CAS still serves at /bulb/<cid>.bin, and refuses the staged cid there", async () => {
    const manifest = await fetch(`${fleet!.hermShore}/bulb/manifest`).then((r) => r.json()) as { blobs?: Array<{ cid: string }> } & Record<string, unknown>;
    const bootCid = manifest.blobs?.[0]?.cid ?? (JSON.stringify(manifest).match(/[0-9a-f]{64}/) ?? [])[0] ?? "";
    expect(bootCid, `no cid in the bulb manifest: ${JSON.stringify(manifest).slice(0, 200)}`).not.toBe("");
    const boot = await fetch(`${fleet!.hermShore}/bulb/${bootCid}.bin`);
    expect(boot.status).toBe(200);
    expect(sha(new Uint8Array(await boot.arrayBuffer()))).toBe(bootCid);
    expect((await fetch(`${fleet!.hermShore}/bulb/${cid}.bin`)).status).toBe(404);
  }, 30_000);

  test("CONTROL: C's fetch of a ghost reads held:false with A dark — no fault, nothing written", async () => {
    const r = await fleet!.C.cli(["bag", "cas", "--fetch", GHOST, "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    expect((r.json?.["data"] as Record<string, unknown> | undefined)?.["held"]).toBe(false);
    expect(existsSync(join(casDirOf(fleet!.C), GHOST))).toBe(false);
  }, 60_000);
});
