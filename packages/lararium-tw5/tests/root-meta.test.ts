/**
 * root-meta — the ONE locator every root-meta reader composes onto.
 *
 * Meme: lar:///tw5.root-meta.helper
 */

import { describe, expect, test } from "vitest";
import { metaFenceAt, rootMetaFence, rootMetaFields, metaValueRaw } from "../src/root-meta.js";

const STX = `<<^ code="&#x0002;">>`;

describe("root-meta — the root meta fence rides the body", () => {
  test("a frame head, STX, then a toml meta fence — the body is read", () => {
    const text = `${STX}\n\n\`\`\`toml meta\nbag = "x"\n\`\`\`\n\nprose\n`;
    expect(rootMetaFence(text)?.body).toContain('bag = "x"');
  });

  test("a later UNLABELLED ```toml teaching fence names no root meta — this pins the sync-heleuma bug", () => {
    const text = `${STX}\n\nprose\n\n\`\`\`toml\nmodule-ref = "evil"\n\`\`\`\n`;
    expect(rootMetaFields(text)).toEqual({});
  });

  test("a ````-quoted ```toml meta example in the body, before the real one — the mask wins", () => {
    const text = [
      STX,
      "",
      "````",
      "```toml meta",
      'bag = "lesson"',
      "```",
      "````",
      "",
      "```toml meta",
      'bag = "real"',
      "```",
      "",
    ].join("\n");
    expect(rootMetaFields(text)).toEqual({ bag: "real" });
  });

  test("an opener with no closer answers null — half a fence states nothing", () => {
    const text = `${STX}\n\n\`\`\`toml meta\nbag = "x"\n`;
    expect(rootMetaFence(text)).toBeNull();
  });

  test("the admitted spelling — two spaces before meta — is found", () => {
    const text = `${STX}\n\n\`\`\`toml  meta\nbag = "x"\n\`\`\`\n`;
    expect(rootMetaFence(text)?.body).toContain('bag = "x"');
  });
});

describe("metaFenceAt — the bare locator, no STX routing", () => {
  test("finds the first live opener at or past `from`", () => {
    const text = `prelude\n\n\`\`\`toml meta\nbag = "x"\n\`\`\`\n`;
    const fence = metaFenceAt(text);
    expect(fence?.body).toContain('bag = "x"');
    expect(text.slice(fence!.bodyStart, fence!.bodyEnd)).toBe(fence!.body);
  });
});

describe("metaValueRaw — a parser-free quoted read", () => {
  test("reads a quoted top-level value out of a raw body", () => {
    expect(metaValueRaw('harvest-to = "lar:///ha.ka.ba/bags/lares"', "harvest-to")).toBe(
      "lar:///ha.ka.ba/bags/lares",
    );
  });
  test("answers null where the key is absent", () => {
    expect(metaValueRaw('bag = "x"', "harvest-to")).toBeNull();
  });
});
