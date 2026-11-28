/**
 * A STAND-OFF SETTLES ON A HAND, AT THE INGEST DOOR TOO. `take-disk` and `keep-disk` ride an INGEST wave whose candidate names
 * the records' present hash as its base, and the island's gate trusts the caller's base. So any line that hands INGEST that
 * hash (readable off `lares shore list`) would take the disk's side of a stand-off. The island answers each carrier that
 * stands in a projector stand-off `conflict` (it awaits a hand, naming `lares shore keep-disk <uri> key=<key>`) unless the
 * wave rides a person's line (`cli` or `tab`), and lands the rest of the wave. No word of the frame (`unattended`) changes
 * that: the vessel's own watchers never adopt over a stand-off either.
 *
 * The rig's bag holds house canon, whose reach refuses a seat's wave whole (`seat-canon-reach`), so the line here that no door
 * read (no asker) carries the vectors; the island answers it exactly as it answers a seat over a working layer.
 *
 * CONTROL: the same wave from the operator's line lands (that wave IS `take-disk`).
 */
import { afterEach, describe, expect, test } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ShoreRig, RIG_BAG, coreBlobSkip } from "./shore-rig.js";
import { scanSource } from "../../lares-cli/src/ingest-core.js";
import { VERB_RESULT_KEY } from "@lararium/mesh/verb-tiddler";

let rig: ShoreRig | null = null;
afterEach(async () => { await rig?.close(); rig = null; });

const addLine = (text: string, line: string): string => text.replace(/\n! ([^\n]*)\n/, (m) => `${m}\n${line}\n`);

/** The first prose line inside a slot's body (past the head and its meta fence). */
const firstLine = (text: string): string => text.slice(text.indexOf("<<~ ahu slot=")).split("\n").find((l) => /^[A-Za-z'`]/.test(l.trim()) && / /.test(l.trim()) && !l.includes("=") && l.trim().length > 12)!.trim();

/**
 * A rig with one carrier standing off, as `take-disk` meets one: a hand's line in the mirror file, and an ingest from a
 * holding copy that moves the records (both sides moved past the mirror's base).
 */
async function standOff(): Promise<{ r: ShoreRig; uri: string; key: string; records: string }> {
  const r = await ShoreRig.stand(6);
  rig = r;
  await r.ingest();
  await r.boot();
  const uri = r.uris[r.uris.length - 1]!;
  const before = r.read(uri);
  r.write(uri, addLine(before, "A HAND WROTE THIS LINE IN THE MIRROR FILE."));
  const holding = path.join(r.scratch, "wikis", "inbox", `${uri.slice("lar:///".length)}.mem`);
  mkdirSync(path.dirname(holding), { recursive: true });
  writeFileSync(holding, addLine(before, "A LINE ADDED IN THE HOLDING COPY."), "utf8");
  await r.ingest(holding);
  const standing = r.projector.standing().find((s) => s.uri === uri);
  if (standing === undefined || !standing.records) throw new Error("rig: the carrier stands in no stand-off");
  return { r, uri, key: standing.standoff, records: standing.records };
}

/** The wave a seat could forge: the mirror file, its base claimed as the records' present hash. */
function forged(r: ShoreRig, uri: string, records: string) {
  const scan = scanSource(r.scratch, r.fileOf(uri), RIG_BAG, r.tree as unknown as Parameters<typeof scanSource>[3])!;
  const row = scan.rows.find((x) => x.uri === uri)!;
  const { syncedRecordsHash: _side, ...rest } = row;
  return { source: r.fileOf(uri), toBag: RIG_BAG, did: "did:test", candidates: [{ ...rest, status: "changed" as const, syncedHash: records }] };
}

/** The rows a wave's answer names. */
const rowsOf = (result: { readonly results?: Record<string, { readonly output?: Record<string, unknown> }> }): Array<Record<string, unknown>> =>
  ((result.results?.[VERB_RESULT_KEY]?.output?.["carriers"] as Array<Record<string, unknown>> | undefined) ?? []);

/** A carrier that stands in no stand-off, edited on disk, as a scan reads it. */
function ordinaryEdit(r: ShoreRig, uri: string) {
  const other = r.uris.find((u) => u !== uri && r.projector.standing().every((s) => s.uri !== u))!;
  r.write(other, r.read(other).replace(firstLine(r.read(other)), `${firstLine(r.read(other))} (an ordinary edit)`));
  const scan = scanSource(r.scratch, r.fileOf(other), RIG_BAG, r.tree as unknown as Parameters<typeof scanSource>[3])!;
  return { other, rows: scan.rows.filter((x) => x.uri === other) };
}

describe.skipIf(coreBlobSkip)("the ingest door holds a stand-off for a hand", () => {
  test("a line no door read, naming `unattended` and the records' hash over a stand-off, lands nothing for that carrier", async () => {
    const { r, uri, key, records } = await standOff();
    const held = await r.store.get(r.titlesOf(uri).find((t) => t.startsWith(`${uri}#/`))!);
    const result = await r.submitWave({ ...forged(r, uri, records), unattended: true }, null);
    const row = rowsOf(result).find((x) => x["uri"] === uri);
    expect(row?.["decision"]).toBe("conflict");
    expect(String(row?.["warnings"])).toContain(`lares shore keep-disk ${uri} key=${key}`);
    expect(await r.store.get(String(held?.tiddler["title"]))).toEqual(held);
    expect(r.projector.standing().find((s) => s.uri === uri)?.standoff).toBe(key);
  });

  test("one stood-off carrier holds back only itself: the wave lands the others", async () => {
    const { r, uri, key, records } = await standOff();
    const { other, rows } = ordinaryEdit(r, uri);
    const wave = forged(r, uri, records);
    const result = await r.submitWave({ ...wave, candidates: [...wave.candidates, ...rows] }, null);
    const answered = rowsOf(result);
    expect(answered.find((x) => x["uri"] === uri)?.["decision"]).toBe("conflict");
    expect(answered.find((x) => x["uri"] === other)?.["decision"]).toBe("ingest");
    expect(r.projector.standing().find((s) => s.uri === uri)?.standoff).toBe(key);
  });

  test("a seat's wave over a stand-off lands nothing for that carrier (here the canon's own reach answers first)", async () => {
    const { r, uri, key, records } = await standOff();
    await expect(r.submitWave(forged(r, uri, records), "seat")).rejects.toMatchObject({ reason: "seat-canon-reach" });
    expect(r.projector.standing().find((s) => s.uri === uri)?.standoff).toBe(key);
  });

  test("CONTROL: the operator's own line lands the same wave (take-disk)", async () => {
    const { r, uri, records } = await standOff();
    const hand = await r.submitWave(forged(r, uri, records), "cli");
    expect(rowsOf(hand).find((x) => x["uri"] === uri), JSON.stringify(rowsOf(hand))).toMatchObject({ decision: "ingest" });
  });
});
