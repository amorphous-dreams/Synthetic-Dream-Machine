/**
 * floor-card-seed-pin — the seed row reads the pin: a pin whose offering already carries the seed's skins reads level and names
 * no adopt, while a seed the pin lacks still reads as an offer with its adopt line.
 */
import { describe, expect, test } from "vitest";
import { readFloorDrifts } from "../src/floor-card.js";

const ratchets = (engine: "same" | "moved") => (["engine", "grammar", "lararium", "plugins", "floor"] as const).map((ratchet) => ({
  ratchet, record: "a", other: "b", reading: ratchet === "engine" ? engine : "moved" as const,
}));
const rowOf = (onPin: boolean | undefined, engine: "same" | "moved" = "same") => readFloorDrifts({
  canon: { drift: null }, seed: { cid: "s".repeat(8), ratchets: ratchets(engine), ...(onPin === undefined ? {} : { onPin }) }, shadow: null, lag: undefined,
}).find((r) => r.word === "seed offer")!;

describe("the seed row reads the pin", () => {
  test("a pin that carries the seed reads level and names no adopt", () => {
    const row = rowOf(true);
    expect(row.state).toBe("level");
    expect(row.detail).toContain("the pin already carries this seed; serving stands on the founding record because");
    expect(row.next).not.toContain("adopt");
  });
  test("CONTROL: a seed the pin lacks still waits as an offer with its adopt line", () => {
    const row = rowOf(undefined);
    expect(row.state).toBe("drifts");
    expect(row.detail).toContain("a newer seed waits");
    expect(row.next).toContain("adopt");
  });
  test("a moved engine keeps the offer held even where the skins stand on the pin", () => {
    expect(rowOf(true, "moved").detail).toContain("a newer seed waits");
  });
});
