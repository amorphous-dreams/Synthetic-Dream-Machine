/**
 * LEAD RUNS: this suite stands a staged daemon and speaks MCP over the seat's stdio process.
 * e2e/tiddler-door — THE TIDDLER DOOR walked on a hearth: `lares get|put|delete name=value…` (a filter rides
 * `lares get filter=…`), `lares wiki render|status` and the MCP seat's `tiddler_*` / `wiki_*` tools over ONE staged vessel's daemon wiki
 * (lar:///ha.ka.ba/lares/docs/pono/wiki-surface-scout #/a-lean, lane 1; road `L17`).
 *
 * The walk seeds the worn face's daemon wiki with a dozen memory memes carrying tags and links (through the meme
 * door, as a session would), then reads it the way recall would, by BOTH skins:
 *
 *   filter by tag under a small cap, following the cursor    (CLI and MCP answer the same pages)
 *   get fields only · get one slot                           (the same body from both)
 *   backlinks of a seeded link                               (the link graph through a filter)
 *   render a transcluding span                               (the island's own engine wikifies)
 *   patch a field; the text's hash stays where it stood      (and a stale base lands nothing: the CONTROL)
 *   wiki status                                              (the working layer takes the write)
 *   a malformed filter and a family delete refuse by name    (CONTROLS)
 *   a family delete under the family flag lands whole         (THE JOIN)
 *
 * Then EVERY WIKI ITS ENGINE: the face founds a wiki of its own, and the same door (both skins) puts, filters, gets, renders,
 * reads the status of and deletes a record in THAT wiki's own engine, while the daemon wiki reads none of it; a wiki no
 * recipe names refuses `wiki-unreached`.
 *
 * Then THE CALLER'S FACE DECIDES REACH: the vessel wears a second face, and the same filter reaches none of the
 * first face's daemon wiki.
 *
 * Every answer the walk reads prints as a `[walk]` line, so a reader quotes the door and never a test's summary.
 * SKIPS LOUDLY when the built CLI, vessel or seat stands absent. Staged only.
 */

import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline";
import { openStaged, awaitRendezvous, foundStagedHearth, stageDir, type CliResult, type LarInstance } from "../harness/instance.js";

const REPO_ROOT = new URL("../..", import.meta.url).pathname;
const CLI_BIN = join(REPO_ROOT, "packages/lares-cli/dist/src/bin/lares.js");
const RESOLVER = join(REPO_ROOT, "packages/lares-cli/dist/src/mcp-resolve.js");
const NODE_DIST = join(REPO_ROOT, "packages/lararium-node/dist/src/index.js");
const TEST_DOOR = join(REPO_ROOT, "tools/unlock-test-custody.mjs");

const STAGE = "lar:///ha.ka.ba/kahua/memory/";
const key = (n: number): string => `feedback/note-${String(n).padStart(2, "0")}`;
const uriOf = (n: number): string => `${STAGE}${key(n)}`;
const NOTES = 12;

/** One memory meme: a stage meme at its stage path, tagged, with a rule slot that links note 01 and a why slot. */
const memory = (n: number): string => {
  const uri = uriOf(n);
  return `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\n` +
    `uri-path = "ha.ka.ba/kahua/memory/${key(n)}"\nkind = "memory"\ntags = "memory ${n % 2 ? "feedback" : "project"}"\nstatus = "open"\n\`\`\`\n\n` +
    `<<~ ahu slot=\`#/rule\`>>\n\n! Rule ${n}\n\n${n === 1 ? "The first rule stands alone." : `Rule ${n} builds on [[${uriOf(1)}]].`}\n\n<<~/ahu>>\n\n` +
    `<<~ ahu slot=\`#/why\`>>\n\n! Why ${n}\n\nBecause walk ${n} measured it.\n\n<<~/ahu>>\n\n` +
    `<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;
};

const gaps = [CLI_BIN, RESOLVER, NODE_DIST].filter((p) => !existsSync(p)).map((p) => `built ${p} (pnpm build)`);
if (process.env["LAR_TARGET"] === "live") gaps.push("a STAGED target — this walk writes, and never writes to a live hearth");
if (gaps.length > 0) console.error(`tiddler-door: SKIPPED — missing ${gaps.join("; ")}`);

interface Entry { command: string; args: string[]; env: Record<string, string> }

const say = (label: string, value: unknown): void => { console.log(`[walk] ${label}: ${typeof value === "string" ? value : JSON.stringify(value)}`); };

/** Speak MCP over stdio to one spawned seat as a harness does: initialize, list the tools, then each call in turn; resolves the results. */
async function speak(entry: Entry, calls: Array<{ name: string; arguments: Record<string, unknown> }>): Promise<{ results: unknown[]; stderr: string }> {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env["LAR_ROOT"];
  const child = spawn(entry.command, entry.args, { env: { ...env, ...entry.env }, stdio: ["pipe", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (b) => { stderr += String(b); });
  const pending = new Map<number, (msg: Record<string, unknown>) => void>();
  createInterface({ input: child.stdout }).on("line", (line) => {
    let msg: Record<string, unknown>;
    try { msg = JSON.parse(line) as Record<string, unknown>; } catch { return; }
    const id = msg["id"];
    if (typeof id === "number" && pending.has(id)) { pending.get(id)!(msg); pending.delete(id); }
  });
  const exited = new Promise<number | null>((resolve) => child.on("exit", (code) => resolve(code)));
  let next = 1;
  const request = (method: string, params: Record<string, unknown>): Promise<Record<string, unknown> | null> => {
    const id = next++;
    const answer = new Promise<Record<string, unknown>>((resolve) => pending.set(id, resolve));
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    return Promise.race([answer, exited.then(() => null)]);
  };
  const results: unknown[] = [];
  const init = await request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "tiddler-door-walk", version: "0" } });
  if (init !== null) {
    child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" })}\n`);
    // A harness lists the tools before it calls one, as this walk does: the aho (`lares mcp aho`) holds that list until its
    // child stands, and answers a call that reaches it sooner `hearth-sleeps` at once (iris: nothing waits in the seat).
    await request("tools/list", {});
    for (const c of calls) {
      const r = await request(c.name === "tools/list" ? "tools/list" : "tools/call", c.name === "tools/list" ? {} : c);
      results.push(r?.["error"] ?? r?.["result"] ?? null);
      if (r === null) break;
    }
  }
  child.stdin.end();
  // LIVENESS: the exit event ends the seat process; the bound kills a wedged child and decides nothing else.
  await Promise.race([exited, new Promise<null>((r) => setTimeout(() => { child.kill("SIGKILL"); r(null); }, 15_000))]);
  return { results, stderr };
}

/** A tool result's payload, or the refusal's words. */
function payload(result: unknown): { ok: true; data: Record<string, unknown> } | { ok: false; said: string } {
  const r = result as { structuredContent?: Record<string, unknown>; content?: Array<{ type: string; text?: string }>; isError?: boolean } | null;
  if (r === null) return { ok: false, said: "the seat answered nothing" };
  if (r.isError) return { ok: false, said: (r.content ?? []).map((c) => c.text ?? "").join(" ") };
  if (r.structuredContent) return { ok: true, data: (r.structuredContent["result"] ?? r.structuredContent) as Record<string, unknown> };
  const text = r.content?.find((c) => c.type === "text")?.text;
  return text ? { ok: true, data: JSON.parse(text) as Record<string, unknown> } : { ok: false, said: JSON.stringify(result) };
}

const dataOf = (r: CliResult): Record<string, unknown> => ((r.json?.["data"] ?? {}) as Record<string, unknown>);
/** An answer without the call's receipt: the CLI rides the daemon's `call` verb, which stamps `carrier` and the has line it
 *  reads into every answer, and the seat's tools reach the reactor verbs directly; the bodies compare beneath the stamp. */
const unstamped = (d: Record<string, unknown>): Record<string, unknown> => { const { carrier: _carrier, has: _has, ...rest } = d; return rest; };
const seatUnstamped = (p: ReturnType<typeof payload> | undefined): ReturnType<typeof payload> | undefined => (p?.ok ? { ok: true, data: unstamped(p.data) } : p);
const D = ["recipe=default", "--json"] as const;
/** The wiki the walk founds to reach a named wiki's own engine. */
const WALK_WIKI = "walkwiki";

let lar: LarInstance;
let entry: Entry;
let scratch = "";
let priorHome: string | undefined;
let priorPython: string | undefined;

describe.skipIf(gaps.length > 0)("★ THE TIDDLER DOOR on a hearth — the CLI and the MCP seat read, filter, render and field-patch the worn face's daemon wiki ★", () => {
  beforeAll(async () => {
    const root = mkdtempSync(join(stageDir(), "lares-tiddler-door-"));
    priorHome = process.env["HOME"];
    priorPython = process.env["LARES_PYTHON"];
    if (priorPython === undefined && priorHome !== undefined) process.env["LARES_PYTHON"] = join(priorHome, ".venv", "bin", "python3");
    process.env["HOME"] = join(root, "home");
    mkdirSync(process.env["HOME"], { recursive: true });
    // TWO FACES STAND ON THIS VESSEL before its daemon does: persona zero (the founding face the harness's unlock wears)
    // and a second face of the same operator, which the last leg wears.
    lar = await openStaged({ root, tag: "tiddler-door", found: async (cli, staged) => {
      await foundStagedHearth(cli, staged, "first-face");
      const second = await cli(["persona", "new", "1", "--name", "second-face", "--json"]);
      if (second.code !== 0) throw new Error(`the second face failed (${second.code})\n${second.stdout.slice(-400)}\n${second.stderr.slice(-800)}`);
      say("persona new 1 (the second face, before the daemon stands)", { handleIndex: (second.json?.["data"] as Record<string, unknown> | undefined)?.["handleIndex"], petname: (second.json?.["data"] as Record<string, unknown> | undefined)?.["petname"] });
    } });
    if (!(await awaitRendezvous(lar))) throw new Error(`the staged daemon reached live but bound no rendezvous:\n${lar.bootLog().slice(-800)}`);
    scratch = join(lar.root, "walk");
    mkdirSync(scratch, { recursive: true });
    const prior = process.env["LAR_ROOT"];
    process.env["LAR_ROOT"] = lar.root;
    try {
      const { memorySensoriumDir } = await import(NODE_DIST) as { memorySensoriumDir: () => string };
      mkdirSync(memorySensoriumDir(), { recursive: true });
      const { resolveLaresMcp } = await import(RESOLVER) as { resolveLaresMcp: (clone: string) => Entry | null };
      const resolved = resolveLaresMcp(REPO_ROOT);
      if (resolved === null) throw new Error("the resolver found no seat (no interpreter holding mempalace?)");
      entry = resolved;
    } finally {
      if (prior === undefined) delete process.env["LAR_ROOT"];
      else process.env["LAR_ROOT"] = prior;
    }
  }, 240_000);

  afterAll(async () => {
    await lar?.stop();
    if (priorHome === undefined) delete process.env["HOME"]; else process.env["HOME"] = priorHome;
    if (priorPython === undefined) delete process.env["LARES_PYTHON"]; else process.env["LARES_PYTHON"] = priorPython;
  });

  test("seed: a dozen memory memes land in the daemon wiki through the meme door", async () => {
    for (let n = 1; n <= NOTES; n++) {
      const file = join(scratch, `note-${n}.mem`);
      writeFileSync(file, memory(n));
      const put = await lar.cli(["put", `title=${uriOf(n)}`, "recipe=default", `file=${file}`, "--json"]);
      expect(put.code, `${put.stdout}\n${put.stderr}`).toBe(0);
      if (n === 1) say("seed CLI put (note 01)", dataOf(put));
    }
  }, 240_000);

  test("wiki status: the session's face reads its layers, and the working layer takes the write", async () => {
    const cli = await lar.cli(["wiki", "status", ...D]);
    say("CLI wiki status", dataOf(cli));
    expect(cli.code, cli.stderr).toBe(0);
    const status = dataOf(cli) as { working: string; layers: Array<{ bag: string; read: boolean; write: boolean; working?: boolean }> };
    expect(status.working).toBe("lar:///ha.ka.ba/wikis/daemon/working");
    expect(status.layers.find((l) => l.working)).toMatchObject({ bag: status.working, read: true, write: true });
    const seat = payload((await speak(entry, [{ name: "wiki_status", arguments: { recipe: "default" } }])).results[0]);
    say("MCP wiki_status", seat);
    expect(seat).toEqual({ ok: true, data: status });
    // CONTROL: the titles that stay home (the temp and state namespaces) answer no filter, by iteration or by name.
    const home = await lar.cli(["get", "filter=[all[tiddlers+shadows]prefix[$:/temp/]] [all[tiddlers+shadows]prefix[$:/state/]] [[$:/temp/lares/switcher]get[text]]", ...D]);
    say("CLI get filter= over the temp and state namespaces", dataOf(home));
    expect(dataOf(home)).toMatchObject({ titles: [], total: 0 });
    // THE HOUSE'S FUNCTIONS ON A BOOTED VESSEL: the canon layer answers the carrier's text, so `[lares.law[]]` lists the law
    // (the boot seed leads, as its pin) and the `law index` door and the pins read the same functions.
    const lawCall = await lar.cli(["get", "filter=[lares.law[]]", ...D]);
    say("CLI get filter=[lares.law[]] on a booted vessel", { total: dataOf(lawCall)["total"], first: (dataOf(lawCall)["titles"] as string[] | undefined)?.[0] });
    expect(lawCall.code, `${lawCall.stdout}\n${lawCall.stderr}`).toBe(0);
    expect(dataOf(lawCall)["titles"]).toContain("lar:///ha.ka.ba/lares/api/noosphere-boot");
    expect(Number(dataOf(lawCall)["total"])).toBeGreaterThan(10);
    const pinsCall = await lar.cli(["get", "filter=[lares.law.pins[]]", ...D]);
    expect((dataOf(pinsCall)["titles"] as string[])[0]).toBe("lar:///ha.ka.ba/lares/api/noosphere-boot");
    const listCall = await lar.cli(["law", "index", "--json"]);
    expect(listCall.code, `${listCall.stdout}\n${listCall.stderr}`).toBe(0);
    expect(Number(dataOf(listCall)["total"])).toBe(Number(dataOf(lawCall)["total"]));
  }, 120_000);

  test("filter by tag under a small cap: the cursor pages through all twelve, and both skins answer the same pages", async () => {
    const filter = `[tag[memory]prefix[${STAGE}]sort[title]]`;
    const cliTitles: string[] = [];
    const cursors: string[] = [];
    for (let after: string | null = null; ;) {
      const r = await lar.cli(["get", `filter=${filter}`, "limit=5", ...(after ? [`after=${after}`] : []), ...D]);
      expect(r.code, `${r.stdout}\n${r.stderr}`).toBe(0);
      const page = dataOf(r) as { titles: string[]; total: number; next: string | null };
      say(`CLI get filter= page ${cursors.length + 1}`, page);
      expect(page.titles.length).toBeLessThanOrEqual(5);
      expect(page.total).toBe(NOTES);
      cliTitles.push(...page.titles);
      if (page.next === null) break;
      cursors.push(page.next);
      after = page.next;
    }
    expect(cliTitles).toEqual(Array.from({ length: NOTES }, (_, i) => uriOf(i + 1)));
    expect(cursors).toHaveLength(2);
    const said = await speak(entry, [
      { name: "wiki_filter", arguments: { filter, recipe: "default", limit: 5 } },
      { name: "wiki_filter", arguments: { filter, recipe: "default", limit: 5, after: cursors[0] } },
      { name: "wiki_filter", arguments: { filter, recipe: "default", limit: 5, after: cursors[1] } },
      { name: "wiki_filter", arguments: { filter: "[tag[project]sort[title]]", recipe: "default", fields: ["status", "tags"], limit: 2 } },
      { name: "wiki_filter", arguments: { filter: "[tag[memory", recipe: "default" } },
    ]);
    const pages = said.results.slice(0, 3).map(payload);
    say("MCP wiki_filter pages", pages);
    expect(pages.flatMap((p) => (p.ok ? (p.data["titles"] as string[]) : []))).toEqual(cliTitles);
    expect(pages.map((p) => (p.ok ? p.data["next"] : "refused"))).toEqual([cursors[0], cursors[1], null]);
    const rows = payload(said.results[3]);
    say("MCP wiki_filter rows with named fields", rows);
    expect(rows.ok && (rows.data["rows"] as Array<{ title: string; fields: Record<string, string> }>)[0]).toEqual({ title: uriOf(2), fields: { status: "open", tags: "memory project" } });
    // CONTROL: a malformed filter refuses by name on both skins.
    const bad = payload(said.results[4]);
    say("MCP wiki_filter malformed", bad);
    expect(bad.ok === false && bad.said).toContain("filter-malformed");
    const cliBad = await lar.cli(["get", "filter=[tag[memory", ...D]);
    say("CLI get filter= malformed", cliBad.json);
    expect(cliBad.code).toBe(4);
    expect(JSON.stringify(cliBad.json)).toContain("filter-malformed");
  }, 240_000);

  test("get fields only and get one slot: the same body from both skins", async () => {
    // The card: `mu=relate` on a meme root reads the meme lens at the skinny grain (its has-stack, every slot's line, no text);
    // `grain` skins the seat alone, so the seat asks the same card as `meme: true, grain: "skinny"`.
    const cliSkinny = await lar.cli(["get", `title=${uriOf(3)}`, "mu=relate", ...D]);
    say("CLI get mu=relate", dataOf(cliSkinny));
    expect(cliSkinny.code, cliSkinny.stderr).toBe(0);
    expect(dataOf(cliSkinny)).toMatchObject({ lens: "meme", grain: { applied: "skinny" } });
    const card = dataOf(cliSkinny)["meme"] as { text?: string; slots: Array<{ slot: string }> };
    expect(card.text).toBeUndefined();
    expect(card.slots.map((s) => s.slot)).toContain("#/why");
    const cliSlot = await lar.cli(["get", `title=${uriOf(3)}`, "slot=#/why", ...D]);
    say("CLI get slot=#/why", dataOf(cliSlot));
    const slot = dataOf(cliSlot)["tiddler"] as { fields: Record<string, string>; position: string; family: string };
    expect(slot.fields["text"]).toContain("Because walk 3 measured it.");
    expect(slot.fields["text"]).not.toContain("Rule 3");
    expect(slot).toMatchObject({ position: "slot", family: uriOf(3) });
    const said = await speak(entry, [
      { name: "tiddler_get", arguments: { title: uriOf(3), recipe: "default", meme: true, grain: "skinny" } },
      { name: "tiddler_get", arguments: { title: uriOf(3), recipe: "default", slot: "#/why" } },
    ]);
    const [seatSkinny, seatSlot] = said.results.map(payload);
    say("MCP tiddler_get meme grain=skinny", seatSkinny);
    say("MCP tiddler_get slot", seatSlot);
    expect(seatUnstamped(seatSkinny)).toEqual({ ok: true, data: unstamped(dataOf(cliSkinny)) });
    expect(seatUnstamped(seatSlot)).toEqual({ ok: true, data: unstamped(dataOf(cliSlot)) });
  }, 180_000);

  test("backlinks of a seeded link: the link graph answers through a filter, on both skins", async () => {
    const filter = `[[${uriOf(1)}]backlinks[]sort[title]]`;
    const cli = await lar.cli(["get", `filter=${filter}`, ...D]);
    say("CLI get filter= backlinks", dataOf(cli));
    expect(cli.code, cli.stderr).toBe(0);
    const titles = dataOf(cli)["titles"] as string[];
    expect(titles).toHaveLength(NOTES - 1);
    expect(titles[0]).toBe(`${uriOf(2)}#/rule`);
    const links = await lar.cli(["get", `filter=[[${uriOf(2)}#/rule]links[]]`, ...D]);
    say("CLI get filter= links", dataOf(links));
    expect(dataOf(links)["titles"]).toEqual([uriOf(1)]);
    const seat = payload((await speak(entry, [{ name: "wiki_filter", arguments: { filter, recipe: "default" } }])).results[0]);
    say("MCP wiki_filter backlinks", seat);
    expect(seatUnstamped(seat)).toEqual({ ok: true, data: unstamped(dataOf(cli)) });
  }, 180_000);

  test("many-relate: a CLI filter answers each row's card; the seat's collapse answers each meme root skinny, bytes and slots the skinny get names; one slot unfolds by its own get", async () => {
    const filter = `[[${uriOf(3)}]] [[${uriOf(3)}#/why]]`;
    const cli = await lar.cli(["get", `filter=${filter}`, "mu=many-relate", ...D]);
    say("CLI get filter= mu=many-relate", dataOf(cli));
    expect(cli.code, cli.stderr).toBe(0);
    // `mu=many-relate` reads the card depth: each row carries the has line a get answers, never the collapse lens's bytes and slots.
    const rows = dataOf(cli)["rows"] as Array<{ title: string; has: string; bytes?: number; slots?: unknown }>;
    expect(rows.map((r) => r.title)).toEqual([uriOf(3), `${uriOf(3)}#/why`]);
    for (const row of rows) {
      expect(row.has).toMatch(/^<<~ has name=`/);
      expect(row.has).toContain(row.title);
      expect(row.bytes, "a card row carries no collapse bytes").toBeUndefined();
      expect(row.slots, "a card row carries no collapse slots").toBeUndefined();
    }
    expect(rows[0]!.has).toContain("position/root");
    expect(rows[1]!.has).toContain("position/slot");
    const meme = await lar.cli(["get", `title=${uriOf(3)}`, "mu=relate", ...D]);
    const skinny = dataOf(meme)["meme"] as { bytes: number; slots: Array<{ slot: string; bytes: number; first: string | null }> };
    expect(skinny.slots.map((x) => x.slot)).toContain("#/why");
    const unfolded = await lar.cli(["get", `title=${uriOf(3)}`, "slot=#/why", "mu=assert", ...D]);
    expect(String((dataOf(unfolded)["meme"] as { slotText?: string }).slotText)).toContain("Because walk 3 measured it.");
    // THE SEAT'S COLLAPSE (unchanged until the MCP tools fold into the call): each meme root skinny, the bytes and slots the
    // skinny get names; a slot row carries its bytes and no slots.
    const seat = payload((await speak(entry, [{ name: "wiki_filter", arguments: { filter, recipe: "default", collapse: true } }])).results[0]);
    say("MCP wiki_filter collapse=true", seat);
    expect(seat.ok, seat.ok ? "" : seat.said).toBe(true);
    const seatRows = (seat.ok ? seat.data["rows"] : []) as Array<{ title: string; bytes: number; slots?: Array<{ slot: string; bytes: number; first: string | null }> }>;
    expect(seatRows.map((r) => r.title)).toEqual([uriOf(3), `${uriOf(3)}#/why`]);
    expect(seatRows[0]).toMatchObject({ bytes: skinny.bytes, slots: skinny.slots });
    expect(seatRows[1]!.bytes).toBeGreaterThan(0);
    expect(seatRows[1]!.slots, "a slot row is no meme root").toBeUndefined();
    const plain = await lar.cli(["get", `filter=${filter}`, ...D]);
    expect(dataOf(plain)["titles"]).toEqual([uriOf(3), `${uriOf(3)}#/why`]);
  }, 180_000);

  test("render: the island's own engine wikifies a transcluding span and a slot's title, on both skins", async () => {
    const span = `Why: {{${uriOf(4)}#/why}} (<$count filter="[tag[memory]prefix[${STAGE}]]"/> memories)`;
    const cli = await lar.cli(["wiki", "render", "--text", span, ...D]);
    say("CLI wiki render --text", dataOf(cli));
    expect(cli.code, cli.stderr).toBe(0);
    expect(String(dataOf(cli)["text"]).replace(/\s+/g, " ")).toContain("Because walk 4 measured it.");
    expect(String(dataOf(cli)["text"])).toContain(`(${NOTES} memories)`);
    const title = await lar.cli(["wiki", "render", `${uriOf(4)}#/rule`, "--form", "html", ...D]);
    say("CLI wiki render <slot> --form html", dataOf(title));
    expect(String(dataOf(title)["text"])).toMatch(/<h1[^>]*>Rule 4<\/h1>/);
    expect(String(dataOf(title)["text"])).toContain("Rule 4 builds on");
    const seat = payload((await speak(entry, [{ name: "wiki_render", arguments: { text: span, recipe: "default" } }])).results[0]);
    say("MCP wiki_render text", seat);
    expect(seat).toEqual({ ok: true, data: dataOf(cli) });
  }, 180_000);

  test("patch a field: the field lands, the text's hash stays where it stood, and a stale base lands nothing", async () => {
    const before = dataOf(await lar.cli(["get", `title=${uriOf(5)}`, ...D]))["tiddler"] as { hash: string; textHash: string; fields: Record<string, string> };
    say("CLI get before the patch", { hash: before.hash, textHash: before.textHash, status: before.fields["status"] });
    const put = await lar.cli(["put", `title=${uriOf(5)}`, `fields=${JSON.stringify({ status: "done" })}`, "tag-add=reviewed", `base=${before.hash}`, ...D]);
    say("CLI put (field + tag patch)", dataOf(put));
    expect(put.code, `${put.stdout}\n${put.stderr}`).toBe(0);
    expect(dataOf(put)).toMatchObject({ decision: "put", bag: "lar:///ha.ka.ba/wikis/daemon/working", textHash: before.textHash, position: "root" });
    const after = dataOf(await lar.cli(["get", `title=${uriOf(5)}`, ...D]))["tiddler"] as { hash: string; textHash: string; fields: Record<string, string> };
    say("CLI get after the patch", { hash: after.hash, textHash: after.textHash, status: after.fields["status"], tags: after.fields["tags"] });
    expect(after.fields).toMatchObject({ status: "done", tags: "memory feedback reviewed" });
    expect(after.textHash).toBe(before.textHash);
    expect(after.hash).toBe(dataOf(put)["hash"]);
    // The meme lens still reads the family whole after a field patch on its root.
    const meme = await lar.cli(["get", `title=${uriOf(5)}`, "mu=assert", ...D]);
    say("CLI get mu=assert after the patch (the family still recomposes)", { code: meme.code, hasWhy: String((dataOf(meme)["meme"] as Record<string, unknown> | undefined)?.["text"]).includes("Because walk 5 measured it.") });
    expect(meme.code, meme.stderr).toBe(0);
    // CONTROL: the base the patch moved past lands nothing, on both skins.
    const stale = await lar.cli(["put", `title=${uriOf(5)}`, `fields=${JSON.stringify({ status: "stale" })}`, `base=${before.hash}`, ...D]);
    say("CLI put with the stale base", stale.json);
    expect(stale.code).toBe(4);
    expect(dataOf(stale)).toMatchObject({ decision: "conflict", hash: after.hash });
    const said = await speak(entry, [
      { name: "tiddler_put", arguments: { title: uriOf(5), recipe: "default", fields: { status: "stale" }, base: before.hash } },
      { name: "tiddler_put", arguments: { title: uriOf(6), recipe: "default", fields: { status: "done" } } },
      { name: "tiddler_get", arguments: { title: uriOf(6), recipe: "default", fields: ["status"] } },
      { name: "tiddler_delete", arguments: { title: uriOf(6), recipe: "default" } },
      { name: "tiddler_put", arguments: { title: "Walk scratch note", recipe: "default", create: true, text: "a plain note", fields: { tags: "scratch" } } },
      { name: "tiddler_delete", arguments: { title: "Walk scratch note", recipe: "default" } },
    ]);
    const [seatStale, seatPut, seatGet, seatFamily, seatPlain, seatGone] = said.results.map(payload);
    say("MCP tiddler_put with the stale base", seatStale);
    expect(seatStale!.ok === false && seatStale!.said).toContain("tiddler-put conflict");
    say("MCP tiddler_put (field patch)", seatPut);
    say("MCP tiddler_get fields=[status]", seatGet);
    expect(seatPut!.ok && seatPut!.data["decision"]).toBe("put");
    expect(seatGet!.ok && (seatGet!.data["tiddler"] as { fields: Record<string, string> }).fields).toEqual({ title: uriOf(6), status: "done" });
    // CONTROL: a meme root refuses the tiddler door's delete toward the meme door; a plain tiddler leaves plainly, no tombstone raised.
    say("MCP tiddler_delete of a meme root", seatFamily);
    expect(seatFamily!.ok === false && seatFamily!.said).toContain("tiddler-delete-in-a-family");
    say("MCP tiddler_put create (a plain note)", seatPlain);
    say("MCP tiddler_delete of the plain note", seatGone);
    expect(seatGone!.ok && seatGone!.data).toMatchObject({ decision: "removed", mode: "plain", tombstoned: [], retracted: ["Walk scratch note"], consequence: { position: "plain" } });
    expect((await lar.cli(["get", "title=Walk scratch note", ...D])).code).toBe(3);
    expect((await lar.cli(["get", `title=${uriOf(6)}`, ...D])).code).toBe(0);
  }, 300_000);

  test("every tool states its annotations over the real seat", async () => {
    const listed = (await speak(entry, [{ name: "tools/list", arguments: {} }])).results[0] as { tools: Array<{ name: string; annotations?: Record<string, unknown> }> };
    const mine = Object.fromEntries(listed.tools.filter((t) => /^(tiddler_|wiki_)/.test(t.name)).map((t) => [t.name, t.annotations]));
    say("MCP tools/list annotations", mine);
    expect(Object.keys(mine).sort()).toEqual(["tiddler_delete", "tiddler_get", "tiddler_put", "wiki_filter", "wiki_render", "wiki_status"]);
    for (const a of Object.values(mine)) expect(Object.keys(a ?? {}).sort()).toEqual(["destructiveHint", "idempotentHint", "openWorldHint", "readOnlyHint"]);
    expect(mine["tiddler_delete"]).toMatchObject({ destructiveHint: true, readOnlyHint: false, openWorldHint: false });
    expect(mine["wiki_filter"]).toMatchObject({ destructiveHint: false, readOnlyHint: true, idempotentHint: true, openWorldHint: false });
  }, 60_000);

  test("a family delete through the tiddler door: the consequence and a refusal without the family flag, ONE act with it, on both skins", async () => {
    const extra = NOTES + 1;
    const file = join(scratch, `note-${extra}.mem`);
    writeFileSync(file, memory(extra));
    expect((await lar.cli(["put", `title=${uriOf(extra)}`, "recipe=default", `file=${file}`, "--json"])).code).toBe(0);
    const family = [uriOf(extra), `${uriOf(extra)}#/rule`, `${uriOf(extra)}#/why`];
    // WITHOUT THE FLAG: nothing moves, and the answer names every record the delete would move.
    const refused = await lar.cli(["delete", `title=${uriOf(extra)}`, ...D]);
    say("CLI delete of a meme root, no family=true", refused.json);
    expect(refused.code).toBe(4);
    expect(dataOf(refused)).toMatchObject({ decision: "refused", refusal: "tiddler-delete-in-a-family", tombstoned: [], consequence: { position: "root", family: uriOf(extra), refusals: [] } });
    const acts = (dataOf(refused)["consequence"] as { acts: Array<{ title: string; act: string }> }).acts;
    expect(acts.filter((row) => row.act === "retract").map((row) => row.title)).toEqual(family);
    const slotRefused = await lar.cli(["delete", `title=${uriOf(extra)}#/why`, "family=true", ...D]);
    say("CLI delete of a called slot, family=true", slotRefused.json);
    expect(dataOf(slotRefused)).toMatchObject({ decision: "refused", refusal: "tiddler-delete-in-a-family" });
    const said = await speak(entry, [
      { name: "tiddler_delete", arguments: { title: uriOf(extra), recipe: "default" } },
      { name: "tiddler_get", arguments: { title: uriOf(extra), recipe: "default", fields: ["status"] } },
      { name: "tiddler_delete", arguments: { title: uriOf(extra), recipe: "default", family: true } },
    ]);
    const [seatRefused, seatStill, seatRemoved] = said.results.map(payload);
    say("MCP tiddler_delete of a meme root, no family", seatRefused);
    expect(seatRefused!.ok === false && seatRefused!.said).toContain("tiddler-delete-in-a-family");
    expect(seatRefused!.ok === false && seatRefused!.said).toContain(`${uriOf(extra)}#/why`);
    expect(seatStill!.ok && seatStill!.data["tiddler"]).not.toBeNull();
    say("MCP tiddler_delete family=true", seatRemoved);
    expect(seatRemoved!.ok && seatRemoved!.data).toMatchObject({ decision: "removed", mode: "plain", tombstoned: [], retracted: family, consequence: { position: "root", family: uriOf(extra) } });
    // LIVENESS: the shore lands the store's one change in the wiki; the walk COUNTS looks and never compares a clock.
    let left: unknown = null;
    for (let look = 0; look < 30; look++) {
      const after = await lar.cli(["get", `filter=[prefix[${uriOf(extra)}]]`, ...D]);
      left = dataOf(after)["titles"];
      if (after.code === 0 && Array.isArray(left) && left.length === 0) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    say("CLI get filter= over the family's address after the delete", left);
    expect(left).toEqual([]);
    expect((await lar.cli(["get", `title=${uriOf(extra)}`, ...D])).code).toBe(3);
    expect((await lar.cli(["get", `title=${uriOf(extra)}`, "recipe=default", "mu=assert", "--json"])).code).not.toBe(0);
  }, 300_000);

  test("EVERY WIKI ITS ENGINE: a wiki the face founds answers the tiddler door in its own engine, on both skins; the daemon wiki reads none of it", async () => {
    const init = await lar.cli(["wiki", "init", WALK_WIKI, "--json"]);
    say(`CLI wiki init ${WALK_WIKI}`, dataOf(init));
    expect(init.code, `${init.stdout}\n${init.stderr}`).toBe(0);
    const W = [`recipe=${WALK_WIKI}`, "--json"] as const;
    const put = await lar.cli(["put", "title=Walk wiki note", ...W, "create=true", "text=a note in the named wiki", "fields={\"tags\":\"walk\"}"]);
    say(`CLI put recipe=${WALK_WIKI}`, dataOf(put));
    expect(put.code, `${put.stdout}\n${put.stderr}`).toBe(0);
    expect(dataOf(put)).toMatchObject({ recipe: WALK_WIKI, decision: "put", bag: `lar:///ha.ka.ba/wikis/${WALK_WIKI}/working` });
    const filter = "[tag[walk]]";
    // LIVENESS: the put lands through the wiki's own engine and its working document; the walk COUNTS looks.
    let seen: CliResult | null = null;
    for (let look = 0; look < 30; look++) {
      seen = await lar.cli(["get", `filter=${filter}`, ...W]);
      if (seen.code === 0 && (dataOf(seen)["titles"] as string[] | undefined)?.includes("Walk wiki note")) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    say(`CLI get filter= recipe=${WALK_WIKI}`, dataOf(seen!));
    expect(dataOf(seen!)).toMatchObject({ recipe: WALK_WIKI, titles: ["Walk wiki note"] });
    const got = await lar.cli(["get", "title=Walk wiki note", ...W]);
    expect(got.code, got.stderr).toBe(0);
    expect((dataOf(got)["tiddler"] as { bag: string }).bag).toBe(`lar:///ha.ka.ba/wikis/${WALK_WIKI}/working`);
    const layoutTitle = "$:/themes/tiddlywiki/vanilla/options/sidebarlayout";
    const layoutSeed = await lar.cli(["put", `title=${layoutTitle}`, ...W, "create=true", "text=fixed-fluid"]);
    expect(layoutSeed.code, layoutSeed.stderr).toBe(0);
    const changedLayout = await lar.cli(["wiki", "act", "sidebar-layout", ...W, "--expected", "fixed-fluid", "--resulting", "fluid-fixed"]);
    expect(changedLayout.code, changedLayout.stderr).toBe(0);
    expect(dataOf(changedLayout)).toMatchObject({ decision: "put", title: layoutTitle, resulting: "fluid-fixed" });
    const layoutRead = await lar.cli(["get", `title=${layoutTitle}`, ...W]);
    expect((dataOf(layoutRead)["tiddler"] as { fields: { text: string } }).fields.text).toBe("fluid-fixed");
    const actedBySeat = await speak(entry, [{ name: "wiki", arguments: { verb: "act", name: "sidebar-layout", recipe: WALK_WIKI, expected: "fluid-fixed", resulting: "fixed-fluid" } }]);
    say("MCP wiki act", payload(actedBySeat.results[0]));
    expect(payload(actedBySeat.results[0])).toMatchObject({ ok: true, data: { decision: "put", title: layoutTitle, resulting: "fixed-fluid" } });
    expect((dataOf(await lar.cli(["get", `title=${layoutTitle}`, ...W]))["tiddler"] as { fields: { text: string } }).fields.text).toBe("fixed-fluid");
    const status = await lar.cli(["wiki", "status", ...W]);
    say(`CLI wiki status --recipe ${WALK_WIKI}`, dataOf(status));
    expect(dataOf(status)).toMatchObject({ recipe: WALK_WIKI, working: `lar:///ha.ka.ba/wikis/${WALK_WIKI}/working` });
    const rendered = await lar.cli(["wiki", "render", "--text", "{{Walk wiki note}}", ...W]);
    expect(dataOf(rendered)).toMatchObject({ recipe: WALK_WIKI, text: "a note in the named wiki" });
    const seat = await speak(entry, [
      { name: "wiki_filter", arguments: { filter, recipe: WALK_WIKI } },
      { name: "tiddler_get", arguments: { title: "Walk wiki note", recipe: WALK_WIKI, fields: ["tags"] } },
      { name: "wiki_filter", arguments: { filter: "[all[]]", recipe: "nowhere-at-all" } },
    ]);
    say(`MCP wiki_filter recipe=${WALK_WIKI}`, payload(seat.results[0]));
    expect(seatUnstamped(payload(seat.results[0]))).toEqual({ ok: true, data: unstamped(dataOf(seen!)) });
    expect(payload(seat.results[1])).toMatchObject({ ok: true, data: { recipe: WALK_WIKI, tiddler: { fields: { title: "Walk wiki note", tags: "walk" } } } });
    const unreached = payload(seat.results[2]);
    say("MCP wiki_filter on a wiki no recipe names", unreached);
    expect(unreached.ok === false && unreached.said.includes("wiki-unreached")).toBe(true);
    // CONTROL: the daemon wiki answers none of the named wiki's records.
    expect(dataOf(await lar.cli(["get", `filter=${filter}`, ...D]))).toMatchObject({ titles: [], total: 0 });
    const removed = await lar.cli(["delete", "title=Walk wiki note", ...W]);
    say(`CLI delete recipe=${WALK_WIKI}`, dataOf(removed));
    expect(dataOf(removed)).toMatchObject({ recipe: WALK_WIKI, decision: "removed" });
  }, 300_000);

  test("THE FIRST LOOK AFTER A COLD BOOT: a named wiki's working document rests in the vessel's own store, and the very first filter after a fresh boot answers", async () => {
    const W = [`recipe=${WALK_WIKI}`, "--json"] as const;
    const put = await lar.cli(["put", "title=Cold boot note", ...W, "create=true", "text=rests in the store", "fields={\"tags\":\"coldboot\"}"]);
    expect(put.code, `${put.stdout}\n${put.stderr}`).toBe(0);
    // The daemon stands down and a second stands over the same root: the working document now loads from the store alone.
    await lar.stopDaemonOnly();
    lar = await openStaged({ root: lar.root, port: lar.port, found: async () => {} });
    if (!(await awaitRendezvous(lar))) throw new Error(`the re-stood daemon bound no rendezvous:\n${lar.bootLog().slice(-800)}`);
    // ONE look, never a loop: the first filter after the boot answers or the wiki's slot refuses by the store's own name.
    const first = await lar.cli(["get", "filter=[tag[coldboot]]", ...W]);
    say(`CLI first get filter= recipe=${WALK_WIKI} after a cold boot`, dataOf(first));
    expect(first.code, `${first.stdout}\n${first.stderr}`).toBe(0);
    expect(first.stdout).not.toContain("document-unavailable");
    expect(dataOf(first)).toMatchObject({ recipe: WALK_WIKI, titles: ["Cold boot note"] });
    const removed = await lar.cli(["delete", "title=Cold boot note", ...W]);
    expect(dataOf(removed)).toMatchObject({ recipe: WALK_WIKI, decision: "removed" });
  }, 600_000);

  test("THE CALLER'S FACE DECIDES REACH: a second face, worn, reaches none of the first face's daemon wiki", async () => {
    const filter = `[prefix[${STAGE}]]`;
    const first = await lar.cli(["get", `filter=${filter}`, "limit=3", ...D]);
    say("face h0: CLI get filter= over the memory stage", { total: dataOf(first)["total"], titles: dataOf(first)["titles"] });
    expect(Number(dataOf(first)["total"])).toBeGreaterThanOrEqual(NOTES);
    const faceBagOf = (r: CliResult): string => ((dataOf(r)["layers"] ?? []) as Array<{ bag: string }>).map((l) => l.bag).find((b) => /\/bags\/daemon-/.test(b)) ?? "";
    const firstFaceBag = faceBagOf(await lar.cli(["wiki", "status", ...D]));
    say("face h0: its own canon layer in the daemon wiki", firstFaceBag);
    // THE VESSEL WEARS THE SECOND FACE. A product unlock gathers its credential from a terminal alone, and this walk holds
    // none, so the staged test door performs the same two acts: the vessel locks, then unlocks naming face h1.
    const door = await import(TEST_DOOR) as { unlockTestCustody: (root: string, act?: string, face?: number) => Promise<Record<string, unknown> | null> };
    say("the test door locks", await door.unlockTestCustody(lar.root, "lock"));
    const worn = await door.unlockTestCustody(lar.root, "unlock", 1);
    say("the test door unlocks naming face h1", worn);
    expect(worn).toMatchObject({ wears: 1 });
    expect(await awaitRendezvous(lar)).toBe(true);
    let second: CliResult | null = null;
    let secondFaceBag = "";
    // LIVENESS: the vessel recomposes around the new face; the walk COUNTS looks and never compares a clock.
    for (let look = 0; look < 90; look++) {
      const status = await lar.cli(["wiki", "status", ...D]);
      secondFaceBag = status.code === 0 ? faceBagOf(status) : "";
      if (secondFaceBag !== "" && secondFaceBag !== firstFaceBag) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    say("face h1: its own canon layer in the daemon wiki", secondFaceBag);
    expect(secondFaceBag, "the vessel never came to wear the second face").not.toBe("");
    expect(secondFaceBag).not.toBe(firstFaceBag);
    second = await lar.cli(["get", `filter=${filter}`, ...D]);
    say("face h1: CLI get filter= over the memory stage", second!.json);
    expect(second!.code, `${second!.stdout}\n${second!.stderr}`).toBe(0);
    expect(dataOf(second!)).toMatchObject({ titles: [], total: 0 });
    const got = await lar.cli(["get", `title=${uriOf(1)}`, ...D]);
    say("face h1: CLI get of the first face's note 01", got.json);
    expect(got.code).toBe(3);
    const status = await lar.cli(["wiki", "status", ...D]);
    say("face h1: CLI wiki status", dataOf(status));
    const seat = await speak(entry, [{ name: "wiki_filter", arguments: { filter: "[tag[memory]]", recipe: "default" } }]);
    say("face h1: MCP wiki_filter [tag[memory]]", payload(seat.results[0]));
    expect(payload(seat.results[0])).toMatchObject({ ok: true, data: { titles: [], total: 0 } });
  }, 420_000);
});
