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
 * MEASURED 2026-09-12, RE-MEASURED against the realm lane, and RE-MEASURED again with the fleet standing
 * in ONE REALM. ⑦ still stands as `test.fails`, and its seam has narrowed to a single line of product law.
 *
 * The fleet now performs the whole carriage crossing (`openStagedFleet`): A seats a founding quorum and
 * `nexus rite cabal`; A exports the charter and the Herm imports it; the Herm signs `nexus carry-for` with
 * its OWN vessel key (a place holds no face — `personaSlotCeiling("herm") === 0`); A seats that seal with
 * `nexus carry <key> --carrier <hex>`; the Herm RE-STANDS carrying `LAR_JOIN_SYNC`/`LAR_JOIN_GATE` for A
 * (the dial is a boot reading, and no running verb seats one); A registers the book with
 * `nexus realm-bag lares --tier public`. Every door answers 0, and the Herm's own log reads
 * `[lar-leaf] verdict OK — crossing open, syncing`.
 *
 * ★ WHAT THE MEASUREMENT THEN SAID. A and the Herm name the SAME realm and the SAME realm doc
 * (`realm epoch0-8117…`, `realmDoc automerge:483v…`). A's `nexus realm-bags` carries the registration;
 * the HERM's reads `bags: []`. The Herm stands in the realm, holds the charter, and folds no registration
 * from it — so `publicCasShore`'s realm lane is empty, `/cas/<cid>` draws 404 with A up or dark, and C
 * reads PENDING (`held:false`).
 *
 * ★ THE SEAM, QUOTED — A CIRCLE IN THE LAW. `RealmBagGate.mayFederate` (`realm-bag.ts:507-509`):
 *
 *     if (!isRealmDoc && this.#charter?.carrierPeer?.(peerId)) {
 *       if (this.#byDocId.get(documentId)?.readTier === "public") return true;
 *
 * and the comment above it says so plainly — //the realm doc itself (which carries the registrations) never
 * crosses to one//. A carrier may read a book its registration DECLARES public; the declaration lives on the
 * realm doc; the realm doc withholds from a carrier. So a Herm can never learn WHICH books it may carry, and
 * the realm lane it gained is unreachable by any carrier, in this fleet or any other.
 *
 * ★ THE 2026-09-13 RULING, LANDED — shape (ii): "the @crossroads ANNOUNCE carries the doc url for PUBLIC-tier
 * books only; the realm doc never emits a public face; the Herm follows announces." `crossroadsAnnounceOf`
 * now carries `docUrl` for a PUBLIC-tier registration and withholds it at every tighter tier (byte-identical
 * to the announce that stood before the field existed), `publicRealmBooksFromDoc` folds the board back, and
 * the Herm's shore reads that fold (`announcedRealmBooks`) beside the realm lane it could never reach.
 *
 * ★ AND THE MEASUREMENT NAMED A SECOND CIRCLE, one no ruling anticipated. ⑤b plants the body by hand in the
 * Herm's own `cid/` to separate the INDEX half from the BYTE half, and the index STILL withholds:
 *
 *     herm-reshares MEASURE the INDEX half: body planted in the Herm's cid/ → GET /cas/4977… → 404
 *     herm announce lane: [herm] announce lane: 0 PUBLIC book(s) on the board   (× 4 asks)
 *
 * THE BOARDS NEVER MEET. A crossroads board keys on the VESSEL's OWN verifying key — A's realm plane announces
 * to `crossroadsDocUrl(A.vesselKey)` (`open-node-vessel.ts:1136`) and the Herm's shore reads
 * `crossroadsDocUrl(herm.vesselKey)` (`:2134`). Both vessels name ONE realm and ONE realm doc, and TWO
 * disjoint public boards. So the announce lands where its author alone reads it, and the carrier's fold —
 * correct, and required under every one of the three shapes — folds an empty board.
 *
 * THE FORK THE OPERATOR OWNS, and the only thing between here and ⑦: WHICH public plane carries a realm's
 * announces? (a) the KEEPING hearth's own board, which makes a carrier need that hearth's vessel key (it holds
 * the peer id and the contract nym, and neither is that key); or (b) a board the REALM ID derives, which both
 * already compute (the Herm's own `nexus realm-bags` names `realm epoch0-8496…`) at the cost of a second
 * realm-addressed plane beside the realm doc. Shape (iii) — the publisher PUSHES to the places it carries with
 * — dissolves the question instead of answering it.
 *
 * THE THIRD GAP still stands behind both: `publicCasShore.read` is local bytes only, and a Herm holds no
 * carriage CLIENT (it IS the relay), so nothing ever makes it fetch. ⑤b plants the body precisely because
 * nothing in the product does.
 *
 * THE THREE SHAPES, as first surfaced — they differ in what a place gets to see:
 *   (i) the realm doc crosses to a carrier at a REDUCED PROJECTION — the PUBLIC-tier registrations alone,
 *       so a place reads the public index and never the CONTRACT rows beside it;
 *   (ii) the public registrations announce on @crossroads (already the public plane by construction) and a
 *       carrier folds its shore off that board, the realm doc staying whole and withheld;
 *   (iii) no fold at all — the PUBLISHING hearth pushes the pointer to the places it carries with, and a
 *       Herm serves what it was handed rather than what it discovered.
 *
 * A SECOND GAP STANDS BEHIND IT, and no ruling is owed on it: `publicCasShore.read` is
 * `readCasBlobFromFs(cid, casDir)` — local bytes only. Even with the index, the Herm holds no bytes until
 * something makes it FETCH them, and with A dark at ⑦ the fetch must already have happened. ⑤ is the natural
 * seat for it (the Herm's own `/cas/<cid>` while A still stands, fetching on a public-and-missing read
 * through the Socket-B door and writing through into `cid/`).
 *
 * CONTROLS: a ghost cid draws the Herm's 404 byte-identical with A dark; the boot CAS still serves at
 * `/bulb/<cid>.bin`; C's fetch of a ghost reads `held:false` and writes nothing.
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
    console.error(`herm-reshares MEASURE the carriage crossing:\n  ${fleet!.crossing}`);
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
    const hermBags = await fleet!.herm.cli(["nexus", "realm-bags", "--json"]);
    const aBags    = await fleet!.A.cli(["nexus", "realm-bags", "--json"]);
    console.error([
      `herm-reshares MEASURE herm: GET /cas/${cid.slice(0, 12)}… → ${res.status} (A up) · herm cid/ holds the cid: ${hermCas.includes(cid)} (${hermCas.length} blobs)`,
      `  A   nexus realm-bags → ${said(aBags).trim().slice(0, 300)}`,
      `  herm nexus realm-bags → ${said(hermBags).trim().slice(0, 300)}`,
      `  herm dial (last 4): ${fleet!.herm.bootLog().split("\n").filter((l) => /nexus-join|lar-leaf|realm|dial-out/.test(l)).slice(-4).join(" | ")}`,
    ].join("\n"));
    expect([200, 404]).toContain(res.status);
  }, 30_000);

  // ⑤b ISOLATES THE TWO HALVES OF ⑦. The 2026-09-13 ruling closed the INDEX half: the @crossroads announce
  // carries the doc url for a PUBLIC-tier book, and the Herm folds its shore off the announces it already
  // replicates (`announcedRealmBooks`) rather than off a realm doc that withholds from a carrier. The BYTE half
  // stands open — the Herm holds no carriage CLIENT (it IS the relay), so nothing ever makes it fetch A's body.
  // Plant the body by hand in the Herm's own `cid/` and the two halves separate: a 200 here says the index
  // stands and the byte lane alone is owed; a 404 says the index still withholds.
  test("⑤b MEASURE: with the body planted in the Herm's cid/, does the index alone open /cas/<cid>?", async () => {
    const hermCas = casDirOf(fleet!.herm);
    mkdirSync(hermCas, { recursive: true });
    writeFileSync(join(hermCas, cid), PNG_BYTES);
    const res = await fetch(`${fleet!.hermShore}/cas/${cid}`);
    const ghost = await fetch(`${fleet!.hermShore}/cas/${GHOST}`);
    console.error([
      `herm-reshares MEASURE the INDEX half: body planted in the Herm's cid/ → GET /cas/${cid.slice(0, 12)}… → ${res.status}`,
      `  CONTROL a ghost cid (planted by nobody) → ${ghost.status}`,
      `  herm announce lane: ${fleet!.herm.bootLog().split("\n").filter((l) => /announce lane/.test(l)).slice(-6).join(" | ") || "(silent — the shore never asked)"}`,
    ].join("\n"));
    expect(ghost.status).toBe(404);                 // CONTROL: the index grants nothing a pointer never named
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
