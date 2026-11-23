/**
 * `lares vault recard --face N` — what the operator reads once a recard lands, and the usage refusal.
 *
 *   V1  a recard names what it kept (the identity), what it cannot recover (a peer's seal to a lost prekey, a reminted
 *       Document's content) and the runnable acts that follow.
 *   V2  a recard that names no handle-index refuses as usage, naming the roster command.
 */
import { describe, expect, test } from "vitest";
import { RecardUsage, recardLines, vaultRecard } from "../src/vault-recard.js";

describe("the recard's answer", () => {
  test("V1 kept, lost, and the next acts", () => {
    const text = recardLines(4).join("\n");
    expect(text).toContain("face h4 recarded: it lit again under its own identity");
    expect(text).toContain("ContentKeyNotHeld");
    expect(text).toContain("lares bag share <bag> --read <this face>");
    expect(text).toContain("lares vault status");
  });
  test("V2 no handle-index refuses as usage, naming the roster", async () => {
    for (const face of [undefined, "", "-1", "h2", "01"]) {
      const err = await vaultRecard({ command: "vault", positional: ["recard"], options: face === undefined ? {} : { face } } as never).then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(RecardUsage);
      expect((err as Error).message).toContain("lares vessel roster");
    }
  });
});
