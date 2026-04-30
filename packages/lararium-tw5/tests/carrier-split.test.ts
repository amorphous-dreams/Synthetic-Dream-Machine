import { describe, test, expect } from "@jest/globals";
import { splitCarrierToTiddlers } from "../src/carrier-split.js";

function carrierWithIam(toml: string): string {
  return [
    "<<~ ? -> lar:///lararium-node/toml-warning >>",
    "",
    "<<~ ahu #iam >>",
    "```toml",
    toml,
    "```",
    "<<~/ahu >>",
    "",
    "<<~>>",
    "",
    "<<~ ahu #body >>",
    "body",
    "<<~/ahu >>",
    "",
    "<<~ -> ? >>",
    "",
  ].join("\n");
}

describe("splitCarrierToTiddlers — #iam TOML parsing (smol-toml)", () => {
  test("inline comments on scalar values parse correctly", () => {
    const split = splitCarrierToTiddlers(
      "lar:///lararium-node/toml-inline-comment",
      carrierWithIam([
        "e-prime-slider = 0.50  # baseline dial",
        "ooda-ha-slider = 0.75  # session override",
        'role = "config surface"  # operator notes here',
      ].join("\n")),
    );

    expect(split.warnings).toHaveLength(0);
    expect(split.parent.fields["e-prime-slider"]).toBe("0.5");
    expect(split.parent.fields["ooda-ha-slider"]).toBe("0.75");
    expect(split.parent.fields["role"]).toBe("config surface");
  });

  test("TOML table sections are flattened with prefix keys", () => {
    const split = splitCarrierToTiddlers(
      "lar:///lararium-node/toml-table",
      carrierWithIam([
        'register = "CS"',
        "",
        "[uncertainty]",
        'meme-class-name = "Meme preferred"',
        'graph-class-name = "MemeGraph preferred"',
      ].join("\n")),
    );

    expect(split.warnings).toHaveLength(0);
    expect(split.parent.fields["register"]).toBe("CS");
    expect(split.parent.fields["uncertainty-meme-class-name"]).toBe("Meme preferred");
    expect(split.parent.fields["uncertainty-graph-class-name"]).toBe("MemeGraph preferred");
  });

  test("inline arrays parse correctly", () => {
    const split = splitCarrierToTiddlers(
      "lar:///lararium-node/toml-array",
      carrierWithIam([
        'implements = ["lar:///pono/meme", "lar:///pono/invariant"]',
        'register = "CS"',
      ].join("\n")),
    );

    expect(split.warnings).toHaveLength(0);
    expect(split.parent.fields["register"]).toBe("CS");
    // implements is normalized to space-joined string by splitCarrierToTiddlers
    expect(split.parent.fields["implements"]).toBe(
      "lar:///pono/meme lar:///pono/invariant",
    );
  });

  test("invalid TOML emits a single parse error warning and returns empty fields", () => {
    const split = splitCarrierToTiddlers(
      "lar:///lararium-node/toml-invalid",
      carrierWithIam([
        "broken line without equals",
        'role = "this would be valid but the block fails"',
      ].join("\n")),
    );

    // smol-toml is spec-correct: one error fails the whole block.
    // The parent tiddler still has carrier-text so no data is lost.
    expect(split.warnings).toHaveLength(1);
    expect(split.warnings[0]).toMatch(/TOML parse error/);
    expect(split.parent.fields["role"]).toBeUndefined();
    // carrier-text always preserved regardless of parse failure
    expect(typeof split.parent.fields["carrier-text"]).toBe("string");
  });

  test("valid TOML with mixed types emits no warnings", () => {
    const split = splitCarrierToTiddlers(
      "lar:///lararium-node/toml-mixed",
      carrierWithIam([
        'uri-path = "LARES"',
        "confidence = 0.82",
        "cacheable = true",
        'register = "CS"',
        'role = "operator control panel"',
      ].join("\n")),
    );

    expect(split.warnings).toHaveLength(0);
    expect(split.parent.fields["confidence"]).toBe("0.82");
    expect(split.parent.fields["cacheable"]).toBe("true");
    expect(split.parent.fields["register"]).toBe("CS");
  });
});
