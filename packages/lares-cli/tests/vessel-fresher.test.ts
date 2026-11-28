/**
 * vessel-fresher — `lares vessel fresher bag=<slug>` lists each working copy that shadows a fresher canon record, with the
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

  test("F3 — the base-unknown class reads its own pages and prints its own section, one line per copy the judge can read", async () => {
    const asked: Array<{ after?: string; class?: string }> = [];
    const ask: FresherAsk = async (args) => {
      asked.push({ ...(args.after !== undefined ? { after: args.after } : {}), ...(args.class !== undefined ? { class: args.class } : {}) });
      return args.class === "base-unknown"
        ? { ok: true, fresher: [{ title: "lar:///t/c", base: null, canonHash: "sha256:dddd" }], next: null }
        : { ok: true, fresher: [], next: null };
    };
    const read = await readFresher(fresherBagOf("sdm"), ask, "base-unknown");
    expect(asked).toEqual([{ class: "base-unknown" }]);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    const lines = fresherLines("lar:///ha.ka.ba/bags/sdm", [], read.rows);
    expect(lines[0]).toBe("fresher: no working copy over lar:///ha.ka.ba/bags/sdm shadows a fresher canon record");
    expect(lines[1]).toBe("fresher: 1 working copy over lar:///ha.ka.ba/bags/sdm names no base and differs from canon (base unknown; review each, it may hide fresher canon):");
    expect(lines[2]).toBe("  lar:///t/c  base unknown -> sha256:dddd");
    const both = fresherLines("lar:///ha.ka.ba/bags/sdm", [{ title: "lar:///t/a", base: "sha256:aaaa", canonHash: "sha256:bbbb" }], read.rows);
    expect(both).toEqual([
      "fresher: 1 working copy over lar:///ha.ka.ba/bags/sdm shadow a fresher canon record (base -> canon now):",
      "  lar:///t/a  sha256:aaaa -> sha256:bbbb",
      "fresher: 1 working copy over lar:///ha.ka.ba/bags/sdm names no base and differs from canon (base unknown; review each, it may hide fresher canon):",
      "  lar:///t/c  base unknown -> sha256:dddd",
    ]);
  });
});
