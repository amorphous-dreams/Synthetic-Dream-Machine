/**
 * The `file-path` meta field retires (Train Q, operator ruling 2026-11-01). Residency rides the
 * envelope (the bag), and a title names content, never residency, so no carrier's meta names the
 * file it rests in: the root denies the field as every child already does.
 *
 * RED: a root meta holding `file-path` reads non-canonical under normalize, and the deserializer's
 * re-emit drops it from a root record. CONTROL: a carrier without the field reads canonical, and
 * every other authored root field re-emits.
 */
import { describe, expect, test } from "vitest";
import { CARRIER_DECLARATION as DECLARATION } from "@lararium/memetic-frame";
import { CARRIER_TYPE } from "@lararium/mesh/carrier-type";

import { normalizeMemeSource } from "../src/meme-normalize.js";
import { deserializeCarrier, expandMemeRefs } from "../src/deserializer.js";
import type { TiddlerFields } from "../src/deserializer.js";

const carrier = (filePath: boolean): string =>
  `${DECLARATION}\n\n<<^ code=\`&#x0001;\` from=\`?\` to=\`lar:///x\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
  "```toml meta\n" +
  "cacheable = true\n" +
  (filePath ? 'file-path = "bags/x/x.mem"\n' : "") +
  'title     = "lar:///x"\n' +
  "```\n\nbody\n\n<<^ code=`&#x0003;`>>\n";

describe("the file-path meta field retires on a root", () => {
  test("RED: a root meta holding file-path reads non-canonical, and normalize drops the line", () => {
    const r = normalizeMemeSource(carrier(true));
    expect(r.changed).toBe(true);
    expect(r.text).not.toMatch(/file-path/);
    expect(r.notes.join("\n")).toMatch(/file-path/);
    expect(r.text).toBe(carrier(false));
  });

  test("CONTROL: a root meta without file-path reads canonical", () => {
    const r = normalizeMemeSource(carrier(false));
    expect(r.changed).toBe(false);
    expect(r.text).toBe(carrier(false));
  });

  test("a file-path shown inside a fence stays held text", () => {
    const shown = carrier(false).replace("body\n", "````text\n```toml meta\nfile-path = \"...\"\n```\n````\n");
    expect(normalizeMemeSource(shown).changed).toBe(false);
  });

  test("RED: the deserializer denies file-path on a root the way it does on a child", () => {
    const ROOT = "lar:///ha.ka.ba/x/demo";
    const root: TiddlerFields = {
      title: ROOT, type: CARRIER_TYPE, "$carrier-soh": "0001",
      role: "keep-me", "uri-path": "ha.ka.ba/x/demo", "file-path": "bags/x/demo.mem", text: "body",
    };
    const out = expandMemeRefs((t) => (t === ROOT ? root : undefined), ROOT);
    expect(out).not.toBeNull();
    expect(out!).toMatch(/^role +=/m);
    expect(out!).toMatch(/^uri-path +=/m);
    expect(out!).not.toMatch(/file-path/);
  });

  // INGEST DENIES IT TOO. The re-emit drop alone left the field landing on ingest records: a carrier
  // arriving with `file-path = "../../etc/passwd"` stored it on the root and the child (the train
  // security read's plant). No reader sites a carrier by it, so the field is inert, and the ruling
  // denies it everywhere.
  const planted = (filePath: boolean): string => {
    const fp = filePath ? 'file-path = "../../etc/passwd"\n' : "";
    return `${DECLARATION}\n\n<<^ code=\`&#x0001;\` from=\`?\` to=\`lar:///ha.ka.ba/x/demo\`>>\n<<^ code=\`&#x0002;\`>>\n\n` +
      "```toml meta\n" + fp + 'role      = "keep-root"\ntitle     = "lar:///ha.ka.ba/x/demo"\n' + "```\n\n" +
      "<<~ ahu slot=`#/kid`>>\n```toml meta\n" + fp + 'role = "keep-kid"\n' + "```\nkid body\n<<~/ahu>>\n\n" +
      "<<^ code=`&#x0003;`>>\n";
  };
  const ingest = (text: string) => {
    const { records } = deserializeCarrier(text, { title: "lar:///ha.ka.ba/x/demo" });
    const root = records.find((r) => r.title === "lar:///ha.ka.ba/x/demo");
    const kid = records.find((r) => r.title === "lar:///ha.ka.ba/x/demo#/kid");
    return { records, root, kid };
  };

  test("RED: an ingested root and child that each declare file-path carry no such field on their records", () => {
    const { records, root, kid } = ingest(planted(true));
    expect(root).toBeDefined();
    expect(kid).toBeDefined();
    for (const r of records) expect(r["file-path"]).toBeUndefined();
  });

  test("CONTROL: other meta keys still land on the ingested root and child", () => {
    for (const fp of [true, false]) {
      const { root, kid } = ingest(planted(fp));
      expect(root?.["role"]).toBe("keep-root");
      expect(kid?.["role"]).toBe("keep-kid");
    }
  });
});
