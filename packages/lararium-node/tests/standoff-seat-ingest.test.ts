/**
 * A STAND-OFF SETTLES ON A HAND, AT THE INGEST DOOR TOO. `take-disk` and `keep-disk` ride an INGEST wave whose candidate names
 * the records' present hash as its base, and the island's gate trusts the caller's base. So a seat that hands INGEST that
 * hash (readable off `lares shore list`) would take the disk's side of a stand-off with no hand. The island refuses: a wave
 * whose carrier stands in a projector stand-off lands only from a person's line (`cli` or `tab`); a seat refuses
 * `hand-act-only` and a line no door read refuses `hand-unattested`, each naming `lares shore keep-disk <uri> --key <key>`.
 *
 * The rig's bag holds house canon, whose reach refuses a seat's wave by itself (`seat-canon-reach`); the stand-off's refusal
 * answers first and names the stand-off's own cure, and it holds the same line over a working layer a seat may write.
 *
 * CONTROL: the same wave from the operator's line lands (that wave IS `take-disk`), and a seat's wave over a carrier that
 * stands in no stand-off meets the bag's own reach, never the stand-off's refusal.
 */
import { afterEach, describe, expect, test } from "vitest";
import { ShoreRig, RIG_BAG, coreBlobSkip } from "./shore-rig.js";
import { scanSource } from "../../lares-cli/src/ingest-core.js";

let rig: ShoreRig | null = null;
afterEach(async () => { await rig?.close(); rig = null; });

const firstLine = (text: string): string => text.split("\n").find((l) => /^[A-Za-z'`]/.test(l.trim()) && l.trim().length > 12)!.trim();

/** A rig with one carrier standing off: a hand's disk edit, a seat's records edit to another slot. */
async function standOff(): Promise<{ r: ShoreRig; uri: string; key: string; records: string }> {
  const r = await ShoreRig.stand(6);
  rig = r;
  await r.ingest();
  await r.boot();
  const uri = r.uris.find((u) => r.titlesOf(u).filter((t) => t.startsWith(`${u}#/`)).length >= 2)!;
  const slots = r.titlesOf(uri).filter((t) => t.startsWith(`${uri}#/`)).sort();
  const text = (t: string): string => String((r.engine.$tw as unknown as { wiki: { getTiddler(t: string): { fields: Record<string, unknown> } | undefined } }).wiki.getTiddler(t)?.fields["text"] ?? "");
  const line = firstLine(r.read(uri));
  r.write(uri, r.read(uri).replace(line, `${line} (the operator's own words)`));
  await r.save(slots[slots.length - 1]!, `${text(slots[slots.length - 1]!)}\n\nThe records moved too.`);
  await r.idle();
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

describe.skipIf(coreBlobSkip)("the ingest door holds a stand-off for a hand", () => {
  test("a seat's wave naming the records' hash over a stand-off refuses hand-act-only and lands nothing", async () => {
    const { r, uri, key, records } = await standOff();
    const held = await r.store.get(r.titlesOf(uri).find((t) => t.startsWith(`${uri}#/`))!);
    await expect(r.submitWave(forged(r, uri, records), "seat")).rejects.toMatchObject({ reason: "hand-act-only", message: expect.stringContaining(`lares shore keep-disk ${uri} --key ${key}`) });
    await expect(r.submitWave(forged(r, uri, records), null)).rejects.toMatchObject({ reason: "hand-unattested" });
    expect(await r.store.get(String(held?.tiddler["title"]))).toEqual(held);
    expect(r.projector.standing().find((s) => s.uri === uri)?.standoff).toBe(key);
  });

  test("CONTROL: the operator's own line lands the same wave (take-disk), and a seat's wave over an unstanding carrier lands", async () => {
    const { r, uri, records } = await standOff();
    const other = r.uris.find((u) => u !== uri && r.projector.standing().every((s) => s.uri !== u))!;
    r.write(other, r.read(other).replace(firstLine(r.read(other)), `${firstLine(r.read(other))} (a seat's ordinary edit)`));
    const scan = scanSource(r.scratch, r.fileOf(other), RIG_BAG, r.tree as unknown as Parameters<typeof scanSource>[3])!;
    await expect(r.submitWave({ source: r.fileOf(other), toBag: RIG_BAG, did: "did:test", candidates: scan.rows.filter((x) => x.uri === other) }, "seat"))
      .rejects.toMatchObject({ reason: "seat-canon-reach" });
    const hand = await r.submitWave(forged(r, uri, records), "cli");
    expect(hand.status).toBe("done");
  });
});
