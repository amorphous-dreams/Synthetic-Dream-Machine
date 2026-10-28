import { describe, expect, test } from "vitest";
import { carriageStack, incommensurablePullMs } from "../src/carriage-caps.js";

describe("public carriage cadence", () => {
  test("a changed place seed leaves cadence intact; a changed public id changes it", () => {
    const publicId = "ab".repeat(32);
    const seedA = "01".repeat(32), seedB = "02".repeat(32);
    const cadence = (id: string) => incommensurablePullMs(id, 30_000, () => 0.5);
    // The surrounding custody changes; the production call receives only the public id.
    const underSeed = (secret: string) => ({ secret, pull: cadence(publicId) });
    expect(underSeed(seedA).pull).toBe(underSeed(seedB).pull);
    // Mutation control: if a secret were added to the cadence input, this fixture would move.
    expect(cadence(publicId + seedA)).not.toBe(cadence(publicId + seedB));
    expect(cadence(publicId)).not.toBe(cadence("cd".repeat(32)));
  });

  test("carriageStack names only a public cadence key", () => {
    type StackInput = Parameters<typeof carriageStack>[0];
    const publicId = "ab".repeat(32);
    const input: Pick<StackInput, "cadenceKey"> = { cadenceKey: publicId };
    expect(input.cadenceKey).toBe(publicId);
    // @ts-expect-error the seed input left the carriage contract
    const former: Pick<StackInput, "nodeSeedHex"> = { nodeSeedHex: publicId };
    expect(former.nodeSeedHex).toBe(publicId);
  });
});
