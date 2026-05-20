import { describe, expect, test } from "vitest";
import { planPromoteUris } from "../../../packages/lararium-tw5/src/modules/lar-promote.js";
import { createTestLararium } from "../support/test-lararium.ts";

describe("lar-promote", () => {
  test("promotes root and fragment children through the TW5 wiki surface", () => {
    const rootUri = "lar:///ha.ka.ba/docs/lares/the-lares-protocols";
    const childUri = `${rootUri}#house-law`;
    const wiki = createTestLararium({
      "lar:///ha.ka.ba/@lares": {
        title: "lar:///ha.ka.ba/@lares",
        "path-filter": "lar-bag-path[lares]",
        "mirror-root": "bags/@lares",
      },
      [rootUri]: {
        title: rootUri,
        bag: "lar:///ha.ka.ba/@lararium/wikis/scratch",
        text: "root",
      },
      [childUri]: {
        title: childUri,
        bag: "lar:///ha.ka.ba/@lararium/wikis/scratch",
        text: "child",
      },
    });

    const result = planPromoteUris(wiki, [rootUri], "lar:///ha.ka.ba/@lares");

    expect(result.error).toBeUndefined();
    expect(result.promoted).toEqual([rootUri, childUri]);
    expect(result.childrenPromoted).toEqual([childUri]);
    expect(result.promotedTo).toBe("lar:///ha.ka.ba/@lares");
    expect(result.tombstones).toEqual([rootUri, childUri]);
    expect(result.copies.map((copy) => copy.title)).toEqual([rootUri, childUri]);
    expect(result.copies[0]?.fields["bag"]).toBe("lar:///ha.ka.ba/@lares");
    expect(result.copies[1]?.fields["bag"]).toBe("lar:///ha.ka.ba/@lares");
    expect(result.copies[0]?.fields["file-path"]).toBe("bags/@lares/docs/lares/the-lares-protocols.md");
    expect(result.copies[1]?.fields["file-path"]).toBe("bags/@lares/docs/lares/the-lares-protocols/house-law.md");
  });
});