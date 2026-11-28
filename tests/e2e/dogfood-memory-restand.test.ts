/**
 * LEAD RUNS: this proof founds and boots two staged vessels and exercises the daemon's projection journal.
 * The stage path keeps the same memory title across a state-home re-stand; a changed path makes a new title.
 * Road L9: a stage meme's title carries its stage path (`lar:///ha.ka.ba/kahua/memory/<stage-path>`), the
 * Confluence gate refuses a path that reads no one or two lowercase segments (`stage-path-shape`), and `lares put`
 * re-pours an exported projection byte for byte. The projection aligns its meta, so the fields read by name, never by spacing.
 */
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { daemonWikiDir, openStaged, stageDir, type LarInstance } from "../harness/instance.js";
import { expectEntry } from "../harness/journal-expect.js";

const ROW = { stagePath: "dogfood-memory-row-76f4a2ff", text: "The memory crosses a re-stand by its stage path." };
// An independent spelling of the house derivation (`stageMemeTitle`), so a drift in either reads red here.
const titleFor = (stagePath: string): string => `lar:///ha.ka.ba/kahua/memory/${stagePath}`;
/** One meta field by name, whatever column the canonical render aligns its `=` at. */
const field = (text: string, name: string): string | undefined =>
  new RegExp(`^${name}\\s*=\\s*"([^"]*)"$`, "m").exec(text)?.[1];
const pathFor = (uri: string): string => uri.slice("lar:///".length);
const carrier = (uri: string): string => {
  const path = pathFor(uri);
  return `<<^ code=\`&#x0001;\` from=\`?\` to=\`${uri}\`>>\n<<^ code=\`&#x0002;\`>>\n\n\`\`\`toml meta\nuri-path = "${path}"\nkind = "memory"\nsteward = "dogfood"\n\`\`\`\n\n! Dogfood memory\n\n${ROW.text}\n\n<<^ code=\`&#x0003;\`>>\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;
};

let original: LarInstance | undefined;
let restored: LarInstance | undefined;
let originalRoot = "";
let asideRoot = "";
let freshRoot = "";
let priorHome: string | undefined;

describe("dogfood memory survives a content-keyed re-stand", () => {
  beforeAll(async () => {
    originalRoot = mkdtempSync(join(stageDir(), "lares-dogfood-memory-old-"));
    priorHome = process.env["HOME"];
    process.env["HOME"] = join(originalRoot, "home");
    mkdirSync(process.env["HOME"], { recursive: true });
    original = await openStaged({ root: originalRoot, tag: "dogfood-memory-old" });
  }, 600_000); // LIVENESS: bound a stalled founding/boot; harness phase and process events decide success.

  afterAll(async () => {
    await restored?.stop();
    await original?.stop();
    if (asideRoot) rmSync(asideRoot, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    if (freshRoot) rmSync(freshRoot, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
    if (priorHome === undefined) delete process.env["HOME"];
    else process.env["HOME"] = priorHome;
  });

  test("RED: rename the old state home, re-found, and re-pour the old projection with the same title, fields, and text", async () => {
    const uri = titleFor(ROW.stagePath);
    const path = pathFor(uri);
    const source = join(originalRoot, "memory.mem");
    writeFileSync(source, carrier(uri));
    const put = await original!.cli(["put", `title=${uri}`, "recipe=default", `file=${source}`, "json=true"]);
    expect(put.json?.["ok"], `${put.stdout}\n${put.stderr}`).toBe(true);
    await expectEntry(original!, {
      kind: "bag-projected",
      match: (event) => {
        const data = event.data as Record<string, unknown>;
        return data["bagId"] === "lar:///ha.ka.ba/wikis/daemon/working" && data["path"] === daemonWikiDir(originalRoot);
      },
    }, { budgetMs: 60_000 }); // LIVENESS: fail on the missing projection event; the bound never decides content equality.

    const oldProjection = join(daemonWikiDir(originalRoot), `${path}.mem`);
    expect(existsSync(oldProjection)).toBe(true);
    const oldProjectionRelative = relative(originalRoot, oldProjection);
    await original!.stopDaemonOnly();
    asideRoot = `${originalRoot}-aside`;
    renameSync(originalRoot, asideRoot);

    freshRoot = mkdtempSync(join(stageDir(), "lares-dogfood-memory-new-"));
    process.env["HOME"] = join(freshRoot, "home");
    mkdirSync(process.env["HOME"], { recursive: true });
    restored = await openStaged({ root: freshRoot, tag: "dogfood-memory-new" });
    // The face folder comes from the old projection itself; it remains inside the renamed state home.
    const archivedProjection = join(asideRoot, oldProjectionRelative);
    const priorWiki = readFileSync(archivedProjection, "utf8");
    expect(field(priorWiki, "uri-path")).toBe(path);
    const sourceAgain = join(freshRoot, "re-pour.mem");
    writeFileSync(sourceAgain, priorWiki);
    const poured = await restored!.cli(["put", `title=${uri}`, "recipe=default", `file=${sourceAgain}`, "json=true"]);
    expect(poured.json?.["ok"], `${poured.stdout}\n${poured.stderr}`).toBe(true);
    const fetched = await restored!.cli(["get", `title=${uri}`, "recipe=default", "mu=assert", "json=true"]);
    expect(fetched.json?.["ok"], `${fetched.stdout}\n${fetched.stderr}`).toBe(true);
    const data = (fetched.json?.["data"] as Record<string, unknown>)["meme"] as Record<string, unknown>;
    expect(data["uri"]).toBe(uri);
    expect(data["text"]).toBe(priorWiki);
    const text = String(data["text"]);
    expect([field(text, "kind"), field(text, "steward"), field(text, "uri-path"), field(text, "title")]).toEqual(["memory", "dogfood", path, uri]);
    const newProjection = join(daemonWikiDir(freshRoot), `${path}.mem`);
    await expectEntry(restored!, {
      kind: "bag-projected",
      match: (event) => {
        const eventData = event.data as Record<string, unknown>;
        return eventData["bagId"] === "lar:///ha.ka.ba/wikis/daemon/working" && eventData["path"] === daemonWikiDir(freshRoot);
      },
    }, { budgetMs: 60_000 }); // LIVENESS: projection is event-gated; timeout reports a stalled projector.
    expect(readFileSync(newProjection, "utf8")).toBe(priorWiki);
  }, 900_000); // LIVENESS: bound stalled stop/re-found/project events; assertions use event barriers and exact bytes.

  test("CONTROL: a changed stage path writes under a different title", async () => {
    const changedPath = `${ROW.stagePath}-changed`;
    const changedUri = titleFor(changedPath);
    expect(changedUri).not.toBe(titleFor(ROW.stagePath));
    const source = join(freshRoot, "changed-row.mem");
    writeFileSync(source, carrier(changedUri));
    const put = await restored!.cli(["put", `title=${changedUri}`, "recipe=default", `file=${source}`, "json=true"]);
    expect(put.json?.["ok"], `${put.stdout}\n${put.stderr}`).toBe(true);
    const fetched = await restored!.cli(["get", `title=${changedUri}`, "recipe=default", "mu=assert", "json=true"]);
    expect(fetched.json?.["ok"], `${fetched.stdout}\n${fetched.stderr}`).toBe(true);
    const text = String(((fetched.json?.["data"] as Record<string, unknown>)["meme"] as Record<string, unknown>)["text"]);
    expect([field(text, "uri-path"), field(text, "title")]).toEqual([pathFor(changedUri), changedUri]);

    // The gate holds the stage path's shape: a path of uppercase letters refuses by name, and the old stage meme stands.
    const malformedUri = titleFor("Dogfood-Memory");
    const malformed = join(freshRoot, "malformed-row.mem");
    writeFileSync(malformed, carrier(malformedUri));
    const refused = await restored!.cli(["put", `title=${malformedUri}`, "recipe=default", `file=${malformed}`, "json=true"]);
    expect(refused.json?.["ok"], `${refused.stdout}\n${refused.stderr}`).toBe(false);
    expect(JSON.stringify(refused.json?.["error"])).toContain("stage-path-shape");
    const kept = await restored!.cli(["get", `title=${titleFor(ROW.stagePath)}`, "recipe=default", "mu=assert", "json=true"]);
    expect(field(String(((kept.json?.["data"] as Record<string, unknown>)["meme"] as Record<string, unknown>)["text"]), "uri-path")).toBe(pathFor(titleFor(ROW.stagePath)));
  });
});
