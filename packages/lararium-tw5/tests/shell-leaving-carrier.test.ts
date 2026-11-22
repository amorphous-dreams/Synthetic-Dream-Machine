/**
 * shell-leaving-carrier — the record of a retired shell's leaving survives its own projection: the carrier the engine exports
 * for it reads back, through the island's deserializer, to the same fields and the same body (every carried record whole).
 *
 * The writer's stamp (`meta.authority`) rides the stored record, never a disk carrier: a row read back off disk carries the
 * body and fields alone, so a re-ingested copy reads as no retirement record until the house's own writer stamps it again.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { buildRetiredShellRecord, parseRetiredShellRecord, unionRetiredShell, type CarriedEffectRecord } from "@lararium/mesh";
import { TW5Engine } from "../src/tw5-vm.js";
import { exportCarrierFile } from "../src/meme-write.js";
import { makeTw5Deserializer } from "../src/action-handler.js";
import { bootTestWiki, skipNote, wikiSkip } from "./test-wiki.js";

const SLUG = "elyncia-referee";
const REC: CarriedEffectRecord = {
  layer: "working",
  title: "lar:///ha.ka.ba/wikis/elyncia-referee/working/ledger/residency/e1",
  fields: { title: "lar:///ha.ka.ba/wikis/elyncia-referee/working/ledger/residency/e1", bag: "lar:///ha.ka.ba/wikis/elyncia-referee/working", "archival-verb": "accession" },
};
const record = buildRetiredShellRecord(unionRetiredShell(SLUG, null, [REC], { face: "0xface", realmId: null, forced: false, authored: 0, carried: [REC.title] }));

describe.skipIf(wikiSkip)(`the record of leaving round-trips its carrier${skipNote}`, () => {
  let engine: TW5Engine;
  beforeAll(async () => { engine = await bootTestWiki({ tiddlers: [{ ...record.tiddler } as Record<string, string>] }); }, 60_000);

  test("★ the exported carrier reads back to the same fields and body; with the house's stamp it parses whole ★", () => {
    const file = exportCarrierFile(engine, record.tiddler.title as string);
    expect(file).not.toBeNull();
    const d = makeTw5Deserializer(engine);
    const fields = file!.metaBody ? d.parseFields(file!.metaBody) : {};
    const back = d.deserialize(file!.ext, file!.body, { ...fields, title: record.tiddler.title as string })[0]!;
    expect(String(back["text"]).trim()).toBe(String(record.tiddler.text).trim());
    expect(back["type"]).toBe("application/json");
    expect(back["retired-wiki"]).toBe(SLUG);
    // Off disk the row carries no writer's stamp, and reads as no retirement record by itself.
    expect(parseRetiredShellRecord(SLUG, { tiddler: back as never })).toBeNull();
    expect(parseRetiredShellRecord(SLUG, { tiddler: back as never, meta: record.meta! })?.records).toEqual([REC]);
  });
});
