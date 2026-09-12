/**
 * THE IN-VM FACE — `$tw.lares.meme`, every meme law reachable from inside a wiki with no binary.
 *
 * A widget, an action, a filter: each holds `$tw` and nothing else. The face binds the placement,
 * the read, the pure laws, and the projection to the live `$tw.wiki`, so a wiki-side caller gets the
 * same verbs the daemon and the CLI get. The projection maps a TARGET to a TEMPLATE and renders it
 * the way `--render` does — one law behind both doors.
 */
import { describe, test, expect, beforeAll } from "vitest";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import type { TW5Engine } from "../src/tw5-vm.js";
import type { LaresMemeFace } from "../src/types/lares-globals.js";
import { memeticWikitextDeserializer } from "../src/deserializer.js";
import { projectSubmission } from "../src/meme-markdown.js";
import { normalizeMemeSource } from "../src/meme-normalize.js";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";

const URI = "lar:///t/face";
const meme = (slots: readonly string[]): string =>
  `<<^ code="&#x0001;" from="?" -> to="${URI}">>\n\`\`\`toml meta\nuri-path = "t/face"\n\`\`\`\n\n<<^ code="&#x0002;">>\n\n` +
  slots.map((s) => `<<~ ahu #${s}>>\n\n! ${s}\n\n<<~/ahu>>\n`).join("\n") +
  `\n<<^ code="&#x0003;">>\n\n<<^ code="&#x0004;" -> to="?">>\n`;

describe.skipIf(wikiSkip)(`$tw.lares.meme — the in-VM face${skipNote}`, () => {
  let engine: TW5Engine;
  let face: LaresMemeFace;
  beforeAll(async () => {
    engine = await bootTestWiki();
    face = (engine.$tw as unknown as { lares: { meme: LaresMemeFace } }).lares.meme;
  });

  test("the face stands with its nine verbs", () => {
    for (const v of ["place", "read", "list", "remove", "normalize", "check", "project", "recompose", "parse"] as const) expect(typeof face[v], v).toBe("function");
  });

  test("★ list answers the roots with their base; remove takes the group and refuses a stale base ★", async () => {
    const receipt = await face.place("lar:///t/face-listed", meme(["a"]).replaceAll("t/face", "t/face-listed"));
    const listed = await face.list();
    expect(listed.find((r) => r.uri === "lar:///t/face-listed")?.canonicalHash).toBe(receipt.canonicalHash);
    const tree = await face.list({ tree: true });
    expect(tree.find((r) => r.uri === "lar:///t/face-listed")?.slots).toEqual([{ slot: "#/a", uri: "lar:///t/face-listed#/a", slots: [] }]);
    // CONTROL: a stale base moves nothing.
    expect((await face.remove("lar:///t/face-listed", "sha256:stale")).decision).toBe("conflict");
    expect(engine.wiki.getTiddler("lar:///t/face-listed#/a")).toBeTruthy();
    expect((await face.remove("lar:///t/face-listed", receipt.canonicalHash)).decision).toBe("removed");
    expect(engine.wiki.getTiddler("lar:///t/face-listed#/a")).toBeFalsy();
    expect((await face.list()).some((r) => r.uri === "lar:///t/face-listed")).toBe(false);
  });

  test("place lands the records; read hands the meme back whole", async () => {
    const receipt = await face.place(URI, meme(["a", "b"]));
    expect(receipt.decision).toBe("ingest");
    expect(engine.wiki.getTiddler(`${URI}#/b`)).toBeTruthy();
    const back = await face.read(URI);
    expect(back?.text).toContain("<<~ ahu #/b>>");
    expect(back?.canonicalHash).toMatch(/^sha256:/);
    expect(await face.read("lar:///t/absent")).toBeNull();
  });

  test("normalize and check are the pure laws, unchanged", () => {
    const text = meme(["a"]);
    expect(face.normalize(text)).toEqual(normalizeMemeSource(text));
    expect(face.normalize(face.normalize(text).text).text).toBe(face.normalize(text).text);
    const c = face.check(text);
    expect(c.shape.kind).toBe("carrier");
    expect(c.check).toBe("unchecked");
    expect(c.bcc).toMatch(/^ni:\/\/\/sha-256;/);
    expect(c.edges).toEqual([]);
  });

  test("project → mem: the recomposed carrier, and its bytes deserialize to the same records", async () => {
    await face.place(URI, meme(["a", "b"]));
    const out = face.project(URI, "mem");
    expect(out).toMatchObject({ uri: URI, to: "mem", contentType: CARRIER_TYPE });
    expect(out.text).toBe((await face.read(URI))!.text);
    const records = memeticWikitextDeserializer.call({ wiki: engine.wiki } as never, out.text, { title: URI }, CARRIER_TYPE) as Array<{ title: string }>;
    // The content records; a carriage record (`#/$postamble`, the block-check slot) rides beside them.
    expect(records.map((r) => r.title).filter((t) => !t.includes("#/$")).sort()).toEqual([URI, `${URI}#/a`, `${URI}#/b`]);
  });

  test("project → md: the submission pair the CLI emits", async () => {
    const out = face.project(URI, "md");
    const pair = projectSubmission((await face.read(URI))!.text, { uri: URI });
    expect(out).toEqual({ uri: URI, to: "md", text: pair.markdown, meta: pair.meta, contentType: "text/markdown" });
    expect(out.text).toContain("# a");
  });

  test("project → html · tid · json ride TiddlyWiki's own templates", () => {
    const html = face.project(URI, "html");
    expect(html.contentType).toBe("text/html");
    expect(html.text).toMatch(/^<!doctype html>/);
    expect(html.text).toContain("tc-story-river");
    const tid = face.project(URI, "tid");
    expect(tid.contentType).toBe("application/x-tiddler");
    expect(tid.text).toContain(`title: ${URI}\n`);
    const json = face.project(URI, "json");
    expect(json.contentType).toBe("application/json");
    expect(JSON.parse(json.text).title).toBe(URI);
  });

  test("an unknown target refuses loud, naming the targets; an absent meme refuses naming the URI", () => {
    expect(() => face.project(URI, "docx")).toThrow(/docx.*mem · md · html · tid · json/);
    expect(() => face.project("lar:///t/absent", "mem")).toThrow(/lar:\/\/\/t\/absent/);
  });

  test("★ THE FACE OWNS THE MEME LAWS: recompose and parse live under `$tw.lares.meme`, and nowhere flat ★", async () => {
    await face.place(URI, meme(["a", "b"]));
    // recompose — the sync inverse of the record split, the whole carrier from its group.
    expect(face.recompose(URI)).toBe((await face.read(URI))!.text);
    expect(face.recompose("lar:///t/absent")).toBeNull();
    // parse — the graded meme-ast over any text, with the self-hosted grammar.
    const parsed = face.parse(URI, meme(["a"]));
    expect(parsed.meme.kind).toBe("Meme");
    expect(parsed.failures).toEqual([]);
    // CONTROL: `$tw.lares` carries the engine plumbing, the capture · query · worldline VM entries and
    // the face — and no meme law flat beside the face. One namespace, one spelling per law.
    const flat = (engine.$tw as unknown as { lares: Record<string, unknown> }).lares;
    expect(Object.keys(flat).sort()).toEqual([
      "beginHydration", "captureAnnotateVm", "deriveQuerySkeletonVm", "enqueueNalu", "flushNalu", "isApplyingNalu",
      "meme", "naluPending", "whenSeedDrained", "worldlineCompareVm", "worldlineTrajectoryVm",
    ]);
  });
});
