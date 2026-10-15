/**
 * foreign-title-siting — a title that is not a `lar:` URI still names a file.
 *
 * The operator's sync law: every tiddler allowed to sync by NOT sitting in a volatile layer shall
 * sync — and what syncs into a MIRRORED bag shall land on disk. `carrierBaseRelPath` answers only
 * for the `lar:` family (uri-paths are injective), so a foreign title needs TW5's own flattened
 * default: `generateTiddlerFilepath`'s no-rule branch. The render shore hands that path back as
 * `defaultRelPath` — never as `relPath`, which stays reserved for a `$:/config/FileSystemPaths`
 * rule, so the projector's precedence (rule → loci → flattened) reads off the shape alone.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/tw5-file-info
 */

import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, wikiSkip, skipNote } from "./test-wiki.js";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";
import { exportCarrierFile } from "../src/meme-write.js";

describe.skipIf(wikiSkip)(`foreign-title siting — the flattened default${skipNote}`, () => {
  let engine: TW5Engine;

  beforeAll(async () => {
    engine = await bootTestWiki();
    engine.setTiddler({ title: "My Notes", type: "text/vnd.tiddlywiki", text: "a plain title.\n" });
    engine.setTiddler({ title: "A/B",      type: "text/vnd.tiddlywiki", text: "slash.\n" });
    engine.setTiddler({ title: "A_B",      type: "text/vnd.tiddlywiki", text: "underscore.\n" });
    engine.setTiddler({ title: "$:/config/Foo", type: "text/vnd.tiddlywiki", text: "system.\n" });
    engine.setTiddler({ title: "shot", type: "image/png", text: "AAAA" });
    engine.setTiddler({ title: "loose meme", type: CARRIER_TYPE, text: "a memetic carrier with a foreign title.\n" });
    engine.setTiddler({ title: "lar:///ha.ka.ba/lares/api/native/leaf", type: "text/vnd.tiddlywiki", text: "loci.\n" });
  }, 60_000);

  test("★ a plain title carries TW5's flattened default path ★", () => {
    const file = exportCarrierFile(engine, "My Notes");
    expect(file).not.toBeNull();
    expect(file!.ext).toBe(".tid");
    expect(file!.defaultRelPath).toBe("My Notes.tid");
    expect(file!.relPath).toBeUndefined();              // no rule fired
  });

  test("★ two titles that sanitize alike SHARE one default path — the projector must uniquify ★", () => {
    expect(exportCarrierFile(engine, "A/B")!.defaultRelPath).toBe("A_B.tid");
    expect(exportCarrierFile(engine, "A_B")!.defaultRelPath).toBe("A_B.tid");
  });

  test("the `.tid` body names its own title — the ownership proof the uniquifier reads", () => {
    expect(exportCarrierFile(engine, "A/B")!.body).toContain("title: A/B");
    expect(exportCarrierFile(engine, "A_B")!.body).toContain("title: A_B");
  });

  test("a `$:/`-titled tiddler flattens the way a stock folder wiki writes it", () => {
    expect(exportCarrierFile(engine, "$:/config/Foo")!.defaultRelPath).toBe("$__config_Foo.tid");
  });

  test("a content filetype carries the default path AND the sidecar that proves ownership", () => {
    const file = exportCarrierFile(engine, "shot");
    expect(file!.defaultRelPath).toBe("shot.png");
    expect(file!.metaBody).toContain("title: shot");
  });

  test("a memetic carrier with a foreign title flattens to `.mem` — and its bytes name no title", () => {
    const file = exportCarrierFile(engine, "loose meme");
    expect(file!.ext).toBe(".mem");
    expect(file!.defaultRelPath).toBe("loose meme.mem");
    expect(file!.metaBody).toBeUndefined();
    expect(file!.body).not.toContain("title: loose meme");   // nothing on disk can prove ownership
  });

  test("CONTROL — a `lar:` carrier still hands back NO ruled path; the loci law owns it", () => {
    const file = exportCarrierFile(engine, "lar:///ha.ka.ba/lares/api/native/leaf");
    expect(file!.relPath).toBeUndefined();
    // the flattened default rides too, but the projector never reaches it for a lar: name
    expect(file!.defaultRelPath).toBe("lar____ha.ka.ba_lares_api_native_leaf.tid");
  });
});
