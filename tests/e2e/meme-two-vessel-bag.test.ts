/**
 * e2e/meme-two-vessel-bag — two vessels preserve an author's `bag` field in their own live system books.
 *
 * `bag-is-user-space` proves it in one process over a memory store: an author's `bag` is user space,
 * `$origin-bag` is the host's provenance, residency rides the envelope. This witness stands the pair
 * the law is for — a founder A and a same-operator joiner B, each on its own root, port and key — and
 * carries a meme whose meta holds `bag = "backpack: rope, lantern"` through each vessel’s own lares book.
 *
 * THE RITE, every step through the built CLI:
 *   ① A founds (a place, a face)                          `vessel found` on a marked scratch root · `persona new 0`
 *   ② B founds a place under its OWN root                 `vessel found` on B's own marked scratch root
 *   ③ A offers its face's fleet; B requests over it       `fleet join offer` · `fleet join request`
 *   ④ A answers, naming A's dial; B lands the answer      `fleet join answer --sync-url …` · `fleet join land`
 *   ⑤ A stands; the meme lands on A's wiki                `meme put --recipe lares`
 *   ⑥ B stands dialing A                                  the pin `fleet join land` wrote (sync url · gate pin)
 *   ⑦ A promotes in its own lares book; B measures no live record from A (W24/W27 BOOK crossing)
 *   ⑧ B promotes in its own lares book (OWED: a sibling device's reach follows the face's counted admission, `test.fails` until then); A keeps A’s record
 *   ⑨ the later grant lands as a RECORD on the PersonaGroup plane; B's kit takes the seat by its own act
 *
 * TWO SEATS THE PAIR RIDES, each measured 2026-09-11:
 *
 *   A JOINER STANDS BY ITS EDGE ALONE. The join copies no cap events (two-vessel-mesh asserts it as
 *   design), so B's veil holds no seat in the PersonaGroup until a face-join lands; B's first wiki-binding
 *   mint reads `faceSeated` false and stays on B's own key (`resolve-binding.ts`), and B boots. B's key
 *   mints under B's root when B founds as a place, before its fleet-join request names it.
 *
 *   THE SYSTEM-BAG WRITE DOOR. `--recipe lares` writes the recipe's designated bag — the wiki's WORKING
 *   layer (`wikis/lares/working`, `wiki which` says so below), the doc the running wiki island mounts as
 *   its default writable, so the placement SURFACES in that wiki (its working layer projects to
 *   `wikis/lares/` on disk); `--recipe lares` READS the whole stack top-down (working shadows canon, canon
 *   answers when working holds nothing). `--bag lares` refuses a put (the daemon mounts `lares`
 *   read-only). The residency ACTION verbs reach `lares` by access, so a promotion into
 *   `lar:///ha.ka.ba/bags/lares` is the door — on each side, each direction.
 *
 * The crossing admits B to the fleet. W24/W27 owns the same-face BOOK crossing; until that step lands,
 * B reads no record from A’s live lares document. B’s local promotion keeps its author’s `bag` line byte-whole.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { openStagedJoinee, type StagedJoinee, type LarInstance, type CliResult } from "../harness/instance.js";
import { promoteLoadedTitles } from "../harness/promote.js";
import { faceJoinOutcome, requestFaceJoin } from "../harness/face-join-intent.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN   = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const NODE_MAIN = join(REPO_ROOT, "packages/lararium-node/dist/src/main.js");

const INVENTORY = "backpack: rope, lantern";
/** A `w.w.w/` loci root — the disk projection sites only carriers whose URI carries one. */
const PATH = "t.witness.npc/inventory";
const URI  = `lar:///${PATH}`;
const WIKI = ["--recipe", "lares"] as const;
const LARES_BAG = "lar:///ha.ka.ba/bags/lares";
const WORKING_LARES = "lar:///ha.ka.ba/wikis/lares/working";
const BAG  = ["--bag", "lares"] as const;
/** The author's line as the canonical carrier aligns it — the VALUE is what must read back byte-whole. */
const BAG_LINE = new RegExp(`^bag\\s+= "${INVENTORY}"$`, "m");

/** The NPC meme: the author's `bag` rides the meta, the named slots ride the body. */
const meme = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n<<^ code="&#x0002;">>\n\n\`\`\`toml meta\nuri-path = "${PATH}"\nbag = "${INVENTORY}"\n\`\`\`\n\n` +
  slots.map((s) => `<<~ ahu #/${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

function missing(): string[] {
  const out: string[] = [];
  if (!existsSync(CLI_BIN))   out.push(`built CLI at ${CLI_BIN} (pnpm --filter @lares/cli build)`);
  if (!existsSync(NODE_MAIN)) out.push(`built node vessel at ${NODE_MAIN} (pnpm --filter @lararium/node build)`);
  if (process.env["LAR_TARGET"] === "live") out.push("a STAGED target — this witness founds two vessels, and never writes to a live hearth");
  return out;
}

const said = (r: { stdout: string; stderr: string }): string => `${r.stdout}\n${r.stderr}`;

const gaps = missing();
if (gaps.length > 0) console.error(`meme-two-vessel-bag: SKIPPED — missing ${gaps.join("; ")}`);

let pair: StagedJoinee | null = null;
let A: LarInstance | null = null;
let B: LarInstance | null = null;
let rootB = "";
let admitted: CliResult | null = null;
/** Why B never stood — the daemon's own words; empty when B stands. */
let joinGate = "";
let draftA = "";

describe.skipIf(gaps.length > 0)("★ each vessel keeps its own lares book and author bag field ★", () => {
  beforeAll(async () => {
    // The joinee rite — one door in the harness (A founds · B mints under its own root · A signs · B founds
    // by the payload · B dials A by its pin). ⑤ lands the meme on A before B stands.
    pair = await openStagedJoinee({ tag: "bag", beforeB: async (a) => {
      const f = join(a.root, "npc.mem");
      writeFileSync(f, meme(["a"]));
      const put = await a.cli(["meme", "put", URI, ...WIKI, "--file", f, "--json"]);
      if (put.json?.["ok"] !== true) throw new Error(`A: put refused\n${said(put)}`);
    } });
    A = pair.A; B = pair.B; rootB = pair.rootB; admitted = pair.admitted; joinGate = pair.joinGate ?? "";
    if (!B) console.error(`meme-two-vessel-bag: B never stood — the sync vectors SKIP. The daemon said:\n  ${joinGate}`);
  }, 400_000);

  afterAll(async () => { await pair?.stop(); });

  test("④ the admit ceremony crosses: B founds by A's signed edge, holding its own key", () => {
    expect(admitted?.code, said(admitted ?? { stdout: "", stderr: "no founding ran" })).toBe(0);
    expect(admitted?.stdout).toContain("joined the PersonaGroup");
    expect(existsSync(join(rootB, "data/lares/vessel/social-bootstrap.json"))).toBe(true);
  });

  test("⑤ on A: `get` hands the author's `bag` line back byte-whole", async () => {
    const r = await A!.cli(["meme", "get", URI, ...WIKI, "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    const text = String((r.json?.["data"] as Record<string, unknown>)["text"]);
    expect(text).toMatch(BAG_LINE);
    expect(text).not.toContain("$origin-bag");
  });

  test("⑤ on A: the recipe seat lands the meme in the wiki's WORKING layer — the live write layer its island mounts", async () => {
    const r = await A!.cli(["wiki", "which", URI, "--no-json"]);
    expect(r.code, said(r)).toBe(0);
    draftA = /primary:\s+(\S+)/.exec(r.stdout)?.[1] ?? "";
    expect(draftA).toBe(WORKING_LARES);
  });

  test("★ ⑤ on A: the placement SURFACES in A's running wiki — the working layer projects it to wikis/lares/ ★", async () => {
    // The wiki island mounts the SAME working doc the recipe seat wrote (the ONE slot-doc resolver), and
    // its disk mirror sites the working layer under wikis/{slug}/ — a file here is the running wiki's own
    // projection of the placement, never the daemon's.
    const f = join(A!.root, "wikis/lares", `${PATH}.mem`);
    const deadline = Date.now() + 60_000;
    while (!existsSync(f)) {
      if (Date.now() > deadline) throw new Error(`A's running wiki never surfaced the placement at ${f}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
    const text = readFileSync(f, "utf8");
    expect(text).toContain("<<~ ahu #/a>>");
    expect(text).toMatch(BAG_LINE);
  });

  test("★ ⑤ on A: the daemon wiki holds its own WORKING layer above its bag ★ — and MEASURE where the anchor lands", async () => {
    // Operator ruling: working layers for ALL wikis — the daemon reads as a wiki. Its working doc
    // resolves through the same resolver under the same binding law, late-attached above the daemon
    // bag as the default writable, and the cascade's `current-wiki-bag` re-seeds to it.
    expect(A!.bootLog()).toContain("[daemon] working layer attached: lar:///ha.ka.ba/wikis/daemon/working");
    // MEASURED: the explicit `--recipe default` places through the live `$tw.wiki`, and the same
    // `change` listener every other wiki edit rides (`outbound-bridge.ts`, wired in `sovereign-kernel.ts`)
    // carries it OUT to `IslandAdaptor.saveTiddler`. `wiki which` below reads where it landed.
    const anchorUri = "lar:///t.witness.npc/anchor";
    const f = join(A!.root, "anchor.mem");
    writeFileSync(f, meme(["a"]).replaceAll(URI, anchorUri).replace(`uri-path = "${PATH}"`, `uri-path = "t.witness.npc/anchor"`));
    const put = await A!.cli(["meme", "put", anchorUri, "--recipe", "default", "--file", f, "--json"]);
    expect(put.json?.["ok"], said(put)).toBe(true);
    await new Promise((r) => setTimeout(r, 1500));
    const which = await A!.cli(["wiki", "which", anchorUri, "--no-json"]);
    console.error(`meme-two-vessel-bag MEASURE A: anchor meme put → wiki which ${anchorUri}\n${which.stdout.trim()}`);
  });

  test("⑥ B stands, dialing A — the founder's persona doc resolved over the crossing", () => {
    expect(B, joinGate).not.toBeNull();
    expect(B!.bootLog()).toContain("[lar-leaf] verdict OK — crossing open, syncing");
    expect(B!.bootLog()).toContain("pinned, not yet seated");
  });

  test("⑥ MEASURE: what each vessel mounts writable, and where the recipe seat writes", async () => {
    // Laid flat for the operator, never ruled here: the recipe record designates `wikis/lares/working`
    // (genesis-doc.ts `systemRecipe`); `wiki which` reads the working doc the ONE resolver names; the
    // daemon's `bag stats` names what each vessel holds resident.
    for (const [tag, v] of [["A", A!], ["B", B!]] as const) {
      const stats = await v.cli(["bag", "stats", "--no-json"]);
      const which = await v.cli(["wiki", "which", URI, "--no-json"]);
      console.error(`meme-two-vessel-bag MEASURE ${tag}: bag stats\n${stats.stdout.trim()}\nwiki which ${URI}\n${which.stdout.trim()}`);
    }
    // CONTROL for the projection witness below: nothing sits on B's disk before the promotion.
    expect(existsSync(join(B!.root, "bags/lares", `${PATH}.mem`))).toBe(false);
    const refused = await A!.cli(["meme", "put", URI, "--bag", "lares", "--file", join(A!.root, "npc.mem"), "--json"]);
    console.error(`meme-two-vessel-bag MEASURE A: meme put --bag lares → ${said(refused).trim().slice(0, 300)}`);
    expect(refused.json?.["ok"]).toBe(false);
  });

  test("⑦ MEASURE: `act MOVE` out of the working layer — the promotion door, laid flat", async () => {
    // Dry-run: the MOVE's verdict is measured, never taken here — ⑦ below promotes through `act LOAD`
    // so the working copy still shadows the recipe read on A.
    const mv = await A!.cli(["act", "MOVE", "--title", URI, "--from", draftA, "--to", LARES_BAG, "--dry-run", "--json"]);
    console.error(`meme-two-vessel-bag MEASURE A: act MOVE --dry-run ${draftA} → lares → ${said(mv).trim().slice(0, 400)}`);
  });

  test("⑦ A promotes through the one door: `act LOAD` the carrier into lar:///ha.ka.ba/bags/lares", async () => {
    const ld = await A!.cli(["act", "LOAD", "--source-uri", join(A!.root, "npc.mem"), "--to", WORKING_LARES, "--yes", "--json"]);
    expect(ld.json?.["ok"], said(ld)).toBe(true);
    await promoteLoadedTitles(A!, ((ld.json?.["data"] as { titles?: string[] } | undefined)?.titles ?? []), "lares");
    const which = await A!.cli(["wiki", "which", URI, "--no-json"]);
    expect(which.stdout).toContain(`  ${LARES_BAG}`);
    // A's own working layer still shadows the recipe read; the bag read names the promoted copy.
    const r = await A!.cli(["meme", "get", URI, ...BAG, "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    expect(String((r.json?.["data"] as Record<string, unknown>)["text"])).toMatch(BAG_LINE);
  });

  test("★ ⑦ MEASURE on B: A's live lares record stays in A's own book ★", async () => {
    // W24/W27 owns the same-face BOOK crossing. B's lares book does not carry A's live system record.
    const bag = await B!.cli(["meme", "get", URI, ...BAG, "--json"]);
    const wiki = await B!.cli(["meme", "get", URI, ...WIKI, "--json"]);
    const which = await B!.cli(["wiki", "which", URI, "--no-json"]);
    console.error(`meme-two-vessel-bag MEASURE B: bag → ${said(bag).trim().slice(0, 240)}; wiki → ${said(wiki).trim().slice(0, 240)}`);
    expect(String((bag.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? "")).not.toContain("<<~ ahu #/a>>");
    expect(String((wiki.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? "")).not.toContain("<<~ ahu #/a>>");
    expect(which.stdout).not.toContain(`  ${LARES_BAG}`);
    expect(existsSync(join(B!.root, "bags/lares", `${PATH}.mem`))).toBe(false);
  });

  test("⑧ A's lares record stays whole while B, holding no board source yet, draws kahu-reach on lares", async () => {
    const f = join(B!.root, "npc-b-gate.mem");
    writeFileSync(f, meme(["a", "b"]));
    const ld = await B!.cli(["act", "LOAD", "--source-uri", f, "--to", WORKING_LARES, "--yes", "--json"]);
    expect(ld.json?.["ok"], said(ld)).toBe(true);
    const titles = ((ld.json?.["data"] as { titles?: string[] } | undefined)?.titles ?? []);
    const root = titles.find((t) => !titles.some((c) => c !== t && (t.startsWith(`${c}#`) || t.startsWith(`${c}/`)))) ?? titles[0]!;
    const mv = await B!.cli(["act", "MOVE", "--title", root, "--from", WORKING_LARES, "--to", LARES_BAG, "--yes", "--json"]);
    expect(JSON.stringify(mv.json), "a missing source refuses closed, by name").toContain("kahu-reach");
    const a = await A!.cli(["meme", "get", URI, ...BAG, "--json"]);
    const aText = String((a.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? "");
    expect(aText).toContain("<<~ ahu #/a>>");
    expect(aText).not.toContain("<<~ ahu #/b>>");
  });

  // OWED ROW (`w26-floor-lane` #/owed, "a sibling device of a seat-holding face"): B is a joined sibling device of the
  // Kahu's own face, so by law its reach follows the face's counted admission once the charter's board reads on B. Today B
  // composes no board source and reads as a stranger, so the gate draws `kahu-reach` and this expectation fails. It turns
  // RED the day the row lands: whoever lands it flips `test.fails` to `test`.
  test.fails("⑧ OWED sibling-device row: B promotes its own local edit into lares; A's lares book keeps A's record", async () => {
    // W24/W27 owns the same-face BOOK crossing. A and B each promote within their own live system document.
    const f = join(B!.root, "npc-b.mem");
    writeFileSync(f, meme(["a", "b"]));
    const ld = await B!.cli(["act", "LOAD", "--source-uri", f, "--to", WORKING_LARES, "--yes", "--json"]);
    expect(ld.json?.["ok"], said(ld)).toBe(true);
    await promoteLoadedTitles(B!, ((ld.json?.["data"] as { titles?: string[] } | undefined)?.titles ?? []), "lares");
    const local = await B!.cli(["meme", "get", URI, ...BAG, "--json"]);
    const localText = String((local.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? "");
    expect(localText).toContain("<<~ ahu #/b>>");
    expect(localText).toMatch(BAG_LINE);
    expect(localText).not.toContain("$origin-bag");
    const a = await A!.cli(["meme", "get", URI, ...BAG, "--json"]);
    const aText = String((a.json?.["data"] as Record<string, unknown> | undefined)?.["text"] ?? "");
    expect(aText).toContain("<<~ ahu #/a>>");
    expect(aText).not.toContain("<<~ ahu #/b>>");
  });

  // THE LATER GRANT (basket-one #/the-later-grant, ruled 2026-09-11). A's door answers B's `face-join` intent and seats B in the group
  // AND writes the grant as a SIGNED RECORD on the PersonaGroup plane (the doc both sync by membership).
  // B's own kit, on its next present (a `meme put --recipe lares` resolves the binding → `faceSeated`),
  // reads the record, verifies it offline against the persona root it pinned at admit and A's root-signed
  // edge, ingests the cap events by its own act, and the face reads SEATED; `regrantOnSeat` then rewrites
  // B's `vessel-only` binding to `face`. Reading alone re-cuts nothing (the keyhive control witnesses a
  // tampered / other-root record refused). No daemon verb acts on the remote joinee.
  test("⑨ the later grant lands as a record on the PersonaGroup plane; B's kit takes the seat; a put rides the face", async () => {
    const before = B!.bootLog();
    expect(before, "CONTROL: B stood pinned, not seated").toMatch(/pinned, not yet seated/);
    // JOIN = INTENT (the Founding Walk, W4, 2026-10-29): B's own daemon island issues the one face-join summons the moment it
    // stands joined and unseated, pinned to the founding hearth (`face-seat-summons`); the hand step below REPLAYS it and
    // answers the standing intent's id, so the plane holds one summons of B however many times a hand asks.
    const summonsDeadline = Date.now() + 90_000;
    while (!/the seat summons issued/.test(B!.bootLog()) && Date.now() < summonsDeadline) await new Promise((res) => setTimeout(res, 1000));
    // B's boot log is the only witness of which bind holds a summons back: a summons that never issues names it here.
    const summonsLines = B!.bootLog().split("\n").filter((l) => /summons|face intent door|face-join|nexus-join|\[realm\]|lar-leaf/.test(l)).slice(-16).join("\n  ");
    expect(B!.bootLog(), `B's own island summoned its seat:\n  ${summonsLines}`).toMatch(/the seat summons issued/);
    const requested = await requestFaceJoin(B!);
    const grant = await faceJoinOutcome(B!, requested);
    console.error(`meme-two-vessel-bag MEASURE A: face-join → admitted ${String(grant["admitted"])} · reKeyed ${String(grant["reKeyed"])} · reSealed ${String(grant["reSealedCount"] ?? "(none)")} · record ${String(grant["recordTitle"] ?? "(none)")} ${grant["reason"] ? `· reason ${String(grant["reason"])}` : ""}`);
    expect(grant["admitted"], JSON.stringify(grant).slice(0, 400)).toBe(true);
    expect(typeof grant["recordTitle"], "the grant landed on no plane — A's log names why").toBe("string");
    // B's next present: the binding resolves, the kit reads the record and takes the seat by its own act.
    const f = join(B!.root, "npc-seated.mem");
    writeFileSync(f, meme(["a", "b", "c"]));
    const deadline = Date.now() + 90_000;
    let taken = false;
    while (Date.now() < deadline) {
      const put = await B!.cli(["meme", "put", URI, ...WIKI, "--file", f, "--json"]);
      console.error(`meme-two-vessel-bag MEASURE B: meme put --recipe lares (after the grant) → ${said(put).trim().slice(0, 200)}`);
      if (/grant record taken .* SEATED/.test(B!.bootLog())) { taken = true; break; }
      await new Promise((res) => setTimeout(res, 3000));
    }
    const log = B!.bootLog();
    const tail = log.split("\n").filter((l) => /face-join|pinned|grant record|face-reach|re-grant|regrant/.test(l)).slice(-8).join("\n  ");
    console.error(`meme-two-vessel-bag MEASURE B: seat lines\n  ${tail}`);
    expect(taken, `B's kit never took the seat from the record:\n  ${tail}`).toBe(true);
    // The pinned posture stops naming itself once the seat stands: the LAST pinned line precedes the take.
    expect(log.lastIndexOf("pinned, not yet seated")).toBeLessThan(log.lastIndexOf("grant record taken"));
  }, 240_000);
});
