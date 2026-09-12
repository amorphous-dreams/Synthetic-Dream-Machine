/**
 * e2e/meme-two-vessel-bag — an author's `bag` field crosses between TWO vessels byte-whole.
 *
 * `bag-is-user-space` proves it in one process over a memory store: an author's `bag` is user space,
 * `$origin-bag` is the host's provenance, residency rides the envelope. This witness stands the pair
 * the law is for — a founder A and a same-operator joiner B, each on its own root, port and key — and
 * carries a meme whose meta holds `bag = "backpack: rope, lantern"` from A's wiki to B's.
 *
 * THE RITE, every step through the built CLI:
 *   ① A founds (a place, a face)                          `vessel clear --force` · `persona new 0`
 *   ② B mints its OWN key first, under its OWN root       `vessel bake` · the vessel-identity mint
 *   ③ A signs the edge over B's key, naming A's dial      `device-admit --joinee-key … --sync-url …`
 *   ④ B founds BY that payload                            `vessel found --admit`
 *   ⑤ A stands; the meme lands on A's wiki                `meme put --recipe lares`
 *   ⑥ B stands dialing A                                  LAR_JOIN_SYNC · LAR_JOIN_GATE · LAR_JOIN_DOC
 *   ⑦ A promotes into the bag both mount; B reads it      `act MOVE --to lar:///ha.ka.ba/bags/lares` · `meme get`
 *   ⑧ B edits, promotes; A reads the edit back            `meme put --base` · `act MOVE` · `meme get`
 *   ⑨ the later grant lands as a RECORD on the PersonaGroup plane; B's kit takes the seat by its own act
 *
 * TWO SEATS THE PAIR RIDES, each measured 2026-09-11:
 *
 *   A JOINER STANDS BY ITS EDGE ALONE. `device-admit` copies no cap events (two-vessel-mesh asserts it as
 *   design), so B's veil holds no seat in the PersonaGroup until a face-join lands; B's first wiki-binding
 *   mint reads `faceSeated` false and stays on B's own key (`resolve-binding.ts`), and B boots. B's key is
 *   minted under B's root (`harness/vessel-key.ts`) — the identity dir resolves from `LAR_ROOT`, never from
 *   a path argument, so an in-process mint would have admitted the operator's home key instead.
 *
 *   THE SHARED-BAG WRITE DOOR. `--recipe lares` writes the recipe's designated bag — the wiki's WORKING
 *   layer (`wikis/lares/working`, `wiki which` says so below), the doc the running wiki island mounts as
 *   its default writable, so the placement SURFACES in that wiki (its working layer projects to
 *   `wikis/lares/` on disk); `--recipe lares` READS the whole stack top-down (working shadows canon, canon
 *   answers when working holds nothing). `--bag lares` refuses a put (the daemon mounts `lares`
 *   read-only). The residency ACTION verbs reach `lares` by access, so a promotion into
 *   `lar:///ha.ka.ba/bags/lares` is the door — on each side, each direction.
 *
 * Nothing here fakes the sync. B's `get` carries the `bag = …` line byte-whole and no `$origin-bag`; B's
 * disk projection sites the carrier under `bags/lares/` — which only a wiki tiddler stamped
 * `$origin-bag = lar:///ha.ka.ba/bags/lares` reaches — and the projected carrier holds no `$origin-bag`.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  openStaged, cliFor, freePort, stageDir, awaitRendezvous, vesselStorageDir, type LarInstance, type CliResult,
} from "../harness/instance.js";
import { mintVesselKey } from "../harness/vessel-key.js";
import { invokeLocal } from "../../packages/lares-cli/src/local-connector.js";

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
  `<<^ code="&#x0001;" from=? -> to=${URI}>>\n\`\`\`toml meta\nuri-path = "${PATH}"\nbag = "${INVENTORY}"\n\`\`\`\n\n` +
  `<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #/${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to=?>>\n`;

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

let A: LarInstance | null = null;
let B: LarInstance | null = null;
let rootB = "";
let admitted: CliResult | null = null;
/** Why B never stood — the daemon's own words; empty when B stands. */
let joinGate = "";
let baseA = "";
let draftA = "";

describe.skipIf(gaps.length > 0)("★ an author's `bag` crosses two vessels ★", () => {
  beforeAll(async () => {
    rootB = mkdtempSync(join(stageDir(), "lares-staged-B-"));
    const portA = await freePort();
    const portB = await freePort();
    const admit = join(rootB, "admit.json");
    const cliB  = cliFor({ LAR_ROOT: rootB, LAR_PORT: String(portB) });

    // ①–④ run while NO daemon stands: `device-admit` opens A's store directly, and a store has one owner.
    A = await openStaged({ tag: "A", port: portA, found: async (cliA, rootA) => {
      const clear = await cliA(["vessel", "clear", "--root", rootA, "--force"]);
      if (clear.code !== 0) throw new Error(`A: clear failed (${clear.code})\n${clear.stderr.slice(-800)}`);
      const face = await cliA(["persona", "new", "0", "--name", "alpha"]);
      if (face.code !== 0) throw new Error(`A: face failed (${face.code})\n${face.stderr.slice(-800)}`);

      // THE JOINEE MINTS FIRST, UNDER ITS OWN ROOT. Admission signs a key the joiner already holds; the
      // CLI offers no door that mints a vessel key short of a founding, so the mint rides the same
      // function a founding calls — in a subprocess carrying B's `LAR_ROOT`, since the identity dir
      // resolves from the env alone.
      const bake = await cliB(["vessel", "bake"]);
      if (bake.code !== 0) throw new Error(`B: bake failed (${bake.code})\n${bake.stderr.slice(-800)}`);
      const keyB = await mintVesselKey(rootB);

      const edge = await cliA(["device-admit", "--joinee-key", keyB, "--sync-url", `ws://127.0.0.1:${portA}/ws`, "--out", admit]);
      if (edge.code !== 0) throw new Error(`A: device-admit failed (${edge.code})\n${edge.stderr.slice(-800)}`);
      admitted = await cliB(["vessel", "found", "--admit", admit]);
    } });
    if (!(await awaitRendezvous(A))) throw new Error(`A reached live but bound no rendezvous:\n${A.bootLog().slice(-800)}`);

    // ⑤ the meme lands on A's wiki.
    const f = join(A.root, "npc.mem");
    writeFileSync(f, meme(["a"]));
    const put = await A.cli(["meme", "put", URI, ...WIKI, "--file", f, "--json"]);
    if (put.json?.["ok"] !== true) throw new Error(`A: put refused\n${said(put)}`);
    baseA = String((put.json["data"] as Record<string, unknown>)["canonicalHash"]);

    // ⑥ B stands dialing A: A's gate key off A's own log, A's lares doc off A's registry.
    const gateA = /gate key: ([0-9a-f]{64})/.exec(A.bootLog())?.[1] ?? "";
    const wl = await invokeLocal("list-wikis", {}, `0x${"0".repeat(64)}`, { dataDir: vesselStorageDir(A) }) as
      { results?: { summary?: { output?: { wikis?: Array<{ slug: string; automergeUrl: string | null }> } } } };
    const laresA = wl.results?.summary?.output?.wikis?.find((w) => w.slug === "lares")?.automergeUrl ?? "";
    try {
      B = await openStaged({
        tag: "B", root: rootB, port: portB, found: async () => { /* ④ founded B already */ },
        daemonEnv: { LAR_JOIN_SYNC: `ws://127.0.0.1:${portA}/ws`, LAR_JOIN_GATE: gateA, LAR_JOIN_DOC: laresA },
      });
      if (!(await awaitRendezvous(B))) throw new Error(`B reached live but bound no rendezvous:\n${B.bootLog().slice(-800)}`);
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      const line = text.split("\n").find((l) => /nexus-join|fatal/.test(l)) ?? text.slice(-300);
      joinGate = line.trim();
      console.error(`meme-two-vessel-bag: B never stood — the sync vectors SKIP. The daemon said:\n  ${joinGate}\nFULL:\n${text.split("\n").filter((l) => !/^(TRACE|DEBUG|INFO|WARN) |^\t|^\s+at /.test(l)).join("\n").slice(-12000)}`);
      B = null;
    }
  }, 400_000);

  afterAll(async () => {
    if (B) await B.stop();
    if (A) await A.stop();
    if (rootB && existsSync(rootB)) rmSync(rootB, { recursive: true, force: true });
  });

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
    // MEASURED, not ruled: the anchor `meme put` places through the live `$tw.wiki`, and nothing in the
    // tree carries a live wiki change OUT to `IslandAdaptor.saveTiddler` (only `wiki-sync` sessions and
    // tests call it; `$tw.syncer` does not run) — so the placement stands in the wiki alone and `wiki
    // which` reads no bag for it. The cascade's seat is right; the outbound bridge is owed.
    const anchorUri = "lar:///t.witness.npc/anchor";
    const f = join(A!.root, "anchor.mem");
    writeFileSync(f, meme(["a"]).replaceAll(URI, anchorUri).replace(`uri-path = "${PATH}"`, `uri-path = "t.witness.npc/anchor"`));
    const put = await A!.cli(["meme", "put", anchorUri, "--file", f, "--json"]);
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
    const ld = await A!.cli(["act", "LOAD", "--source-uri", join(A!.root, "npc.mem"), "--to", LARES_BAG, "--yes", "--json"]);
    expect(ld.json?.["ok"], said(ld)).toBe(true);
    const which = await A!.cli(["wiki", "which", URI, "--no-json"]);
    expect(which.stdout).toContain(`  ${LARES_BAG}`);
    // A's own working layer still shadows the recipe read; the bag read names the promoted copy.
    const r = await A!.cli(["meme", "get", URI, ...BAG, "--json"]);
    expect(r.json?.["ok"], said(r)).toBe(true);
    expect(String((r.json?.["data"] as Record<string, unknown>)["text"])).toMatch(BAG_LINE);
  });

  test("★ ⑦ on B: the recipe seat's `get` reads the STACK — canon answers through --recipe while B's working holds nothing ★", async () => {
    const r = await awaitMeme(B!, WIKI, (t) => t.includes("<<~ ahu #/a>>"));
    expect(r.text).toMatch(BAG_LINE);
    expect(r.canonicalHash).toBe(baseA);
  });

  test("⑦ on B: `get` carries the `bag` line byte-whole and no `$origin-bag`", async () => {
    const r = await awaitMeme(B!, BAG, (t) => t.includes("<<~ ahu #/a>>"));
    expect(r.text).toMatch(BAG_LINE);
    expect(r.text).not.toContain("$origin-bag");
    expect(r.canonicalHash).toBe(baseA);
    const which = await B!.cli(["wiki", "which", URI, "--no-json"]);
    expect(/primary:\s+(\S+)/.exec(which.stdout)?.[1]).toBe(LARES_BAG);
  });

  test("⑦ on B: the wiki tiddler wears `$origin-bag` (the projection sites it under bags/lares); the carrier does not", async () => {
    const f = join(B!.root, "bags/lares", `${PATH}.mem`);
    const deadline = Date.now() + 60_000;
    while (!existsSync(f)) {
      if (Date.now() > deadline) throw new Error(`B never projected ${f}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
    const text = readFileSync(f, "utf8");
    expect(text).toContain("<<~ ahu #/a>>");
    expect(text).toMatch(BAG_LINE);
    expect(text).not.toContain("$origin-bag");
  });

  test("⑧ B edits with the base B read, promotes through the same door; A gets the new slot back", async () => {
    const read = await B!.cli(["meme", "get", URI, ...BAG, "--json"]);
    const baseB = String((read.json?.["data"] as Record<string, unknown>)["canonicalHash"]);
    expect(baseB).toBe(baseA);
    const f = join(B!.root, "npc-b.mem");
    writeFileSync(f, meme(["a", "b"]));
    // The base B read names the shared bag's render; the recipe seat gates a put against ITS bag (B's
    // empty working layer), so the base licenses nothing there — measured, not ruled. The shared bag refuses a
    // put outright. The edit rides the same door the promotion rode.
    const put = await B!.cli(["meme", "put", URI, ...WIKI, "--base", baseB, "--file", f, "--json"]);
    console.error(`meme-two-vessel-bag MEASURE B: meme put --recipe lares --base <lares render> → ${said(put).trim().slice(0, 300)}`);
    const bagPut = await B!.cli(["meme", "put", URI, ...BAG, "--base", baseB, "--file", f, "--json"]);
    expect(bagPut.json?.["ok"]).toBe(false);
    const ld = await B!.cli(["act", "LOAD", "--source-uri", f, "--to", LARES_BAG, "--yes", "--json"]);
    expect(ld.json?.["ok"], said(ld)).toBe(true);
    // A's working layer shadows A's recipe read (measured above); the shared bag carries B's slot back to A.
    const back = await awaitMeme(A!, BAG, (t) => t.includes("<<~ ahu #/b>>"));
    expect(back.text).toMatch(BAG_LINE);
    expect(back.text).not.toContain("$origin-bag");
  });

  // THE LATER GRANT (basket-one #/the-later-grant, ruled 2026-09-11). A's `face-join` seats B in the group
  // AND writes the grant as a SIGNED RECORD on the PersonaGroup plane (the doc both sync by membership).
  // B's own kit, on its next present (a `meme put --recipe lares` resolves the binding → `faceSeated`),
  // reads the record, verifies it offline against the persona root it pinned at admit and A's root-signed
  // edge, ingests the cap events by its own act, and the face reads SEATED; `regrantOnSeat` then rewrites
  // B's `vessel-only` binding to `face`. Reading alone re-cuts nothing (the keyhive control witnesses a
  // tampered / other-root record refused). No daemon verb acts on the remote joinee.
  test("⑨ the later grant lands as a record on the PersonaGroup plane; B's kit takes the seat; a put rides the face", async () => {
    const before = B!.bootLog();
    expect(before, "CONTROL: B stood pinned, not seated").toMatch(/pinned, not yet seated/);
    expect(before).not.toMatch(/grant record taken/);
    // B's summons — ITS card (the identity dir sits beside the vessel store) + the edge A signed for it.
    const idDir = join(rootB, "data/lares/identity");
    const cardFile = readdirSync(idDir).find((f) => f.startsWith(".vessel-card"));
    expect(cardFile, `no vessel card under ${idDir}`).toBeDefined();
    const contactCard = readFileSync(join(idDir, cardFile!), "utf8");
    const payload = JSON.parse(readFileSync(join(rootB, "admit.json"), "utf8")) as Record<string, unknown>;
    const deviceEdge = payload["deviceEdge"] ?? (JSON.parse(Buffer.from(String(payload["admit"] ?? ""), "base64url").toString("utf8") || "{}") as Record<string, unknown>)["deviceEdge"];
    expect(deviceEdge, `admit.json carries no deviceEdge: ${Object.keys(payload).join(",")}`).toBeDefined();
    // A seats B — the verb runs where A's booted provider lives; the record lands on the plane.
    const r = await invokeLocal("face-join", { summons: { kind: "face-join/v1", contactCard, deviceEdge } },
      `0x${"0".repeat(64)}`, { dataDir: vesselStorageDir(A!), timeoutMs: 60_000 }) as
      { results?: { summary?: { output?: Record<string, unknown> } } };
    const grant = r.results?.summary?.output ?? {};
    console.error(`meme-two-vessel-bag MEASURE A: face-join → admitted ${String(grant["admitted"])} · reKeyed ${String(grant["reKeyed"])} · regranted ${String(grant["regranted"])} · record ${String(grant["recordTitle"] ?? "(none)")} ${grant["reason"] ? `· reason ${String(grant["reason"])}` : ""}`);
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

/** Poll a vessel's `meme get` until the rendered text satisfies `ready` — the sync, never faked. */
async function awaitMeme(
  v: LarInstance, seat: readonly string[], ready: (text: string) => boolean, timeoutMs = 60_000,
): Promise<{ text: string; canonicalHash: string }> {
  const deadline = Date.now() + timeoutMs;
  let last = "";
  for (;;) {
    const r = await v.cli(["meme", "get", URI, ...seat, "--json"]);
    const data = r.json?.["data"] as Record<string, unknown> | undefined;
    const text = String(data?.["text"] ?? "");
    if (r.json?.["ok"] === true && ready(text)) return { text, canonicalHash: String(data?.["canonicalHash"]) };
    last = said(r);
    if (Date.now() > deadline) throw new Error(`${v.root}: meme never arrived within ${timeoutMs}ms:\n${last.slice(-600)}`);
    await new Promise((res) => setTimeout(res, 1000));
  }
}
