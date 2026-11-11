/**
 * vessel-fresher — `lares vessel fresher --bag <slug>` lists each working copy that shadows a fresher canon record, with the
 * copy's base hash beside the canon hash standing now, every page of the daemon's `fresher-canon` read; a refusal answers by
 * name and lists nothing.
 */
import { describe, expect, test } from "vitest";
import { fresherBagOf, fresherLines, readFresher, type FresherAsk } from "../src/commands/vessel-fresher.js";

describe("the fresher read", () => {
  test("F1 — every page reads, in order; each line names the base beside canon's hash", async () => {
    const pages: Record<string, { fresher: Array<{ title: string; base: string | null; canonHash: string | null }>; next: string | null }> = {
      "": { fresher: [{ title: "lar:///t/a", base: "sha256:aaaa", canonHash: "sha256:bbbb" }], next: "lar:///t/a" },
      "lar:///t/a": { fresher: [{ title: "lar:///t/b", base: null, canonHash: "sha256:cccc" }], next: null },
    };
    const asked: string[] = [];
    const ask: FresherAsk = async ({ after }) => { asked.push(after ?? ""); return { ok: true, ...pages[after ?? ""]! }; };
    const read = await readFresher(fresherBagOf("sdm"), ask);
    expect(asked).toEqual(["", "lar:///t/a"]);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const lines = fresherLines("lar:///ha.ka.ba/bags/sdm", read.rows);
    expect(lines[0]).toMatch(/2 working copies over lar:\/\/\/ha\.ka\.ba\/bags\/sdm/);
    expect(lines[1]).toBe("  lar:///t/a  sha256:aaaa -> sha256:bbbb");
    expect(lines[2]).toBe("  lar:///t/b  (none) -> sha256:cccc");
  });

  test("F2 — a slug and a URI name the same bag; a refusal lists nothing", async () => {
    expect(fresherBagOf("sdm")).toBe("lar:///ha.ka.ba/bags/sdm");
    expect(fresherBagOf("lar:///ha.ka.ba/bags/sdm")).toBe("lar:///ha.ka.ba/bags/sdm");
    expect(await readFresher("lar:///ha.ka.ba/bags/sdm", async () => ({ ok: false, why: "cap-denied" }))).toEqual({ ok: false, why: "cap-denied" });
    expect(fresherLines("lar:///ha.ka.ba/bags/sdm", [])).toEqual(["fresher: no working copy over lar:///ha.ka.ba/bags/sdm shadows a fresher canon record"]);
  });
});
