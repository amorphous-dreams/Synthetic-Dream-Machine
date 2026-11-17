/**
 * pulama-standby-names-refusal — a vessel standing by its pūlama remembers why its last dial stood no session, so the custody
 * door's reading names a composition the vessel refused over the session (`composition-refused`) rather than the pūlama's last
 * hello reading, and a session that stands clears it.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { PulamaHolder } from "../src/pulama-holder.js";
import { pulamaStandBy } from "../src/pulama-seat.js";

/** A holder whose pūlama serves every dial a session; its own last hello reading stays whatever the test sets. */
function fakeHolder(): PulamaHolder & { helloReading: string | null } {
  let open = false;
  const h = {
    helloReading: "pulama-image-unadmitted" as string | null,
    onClosed: () => () => {},
    isUnlocked: () => open,
    unlock: async () => { open = true; return { reading: "opens", slot: "pulama" }; },
    lock: async () => { open = false; },
    wears: () => 0,
    waits: () => (open ? null : h.helloReading),
    landRite: async () => { throw Object.assign(new Error("rite-not-begun"), { reading: "rite-not-begun" }); },
  };
  return h as unknown as PulamaHolder & { helloReading: string | null };
}

describe("RED door-names-the-composition-refusal: the stand-by remembers its last dial's reading", () => {
  test("a composition refused over the session reads `composition-refused` until a session stands, whatever the pūlama's last hello read", async () => {
    const holder = fakeHolder();
    let refuse = true;
    const by = pulamaStandBy({
      holder, mount: () => {}, onLog: () => {},
      recompose: async (sovereign) => (sovereign && refuse ? { standing: "herm", refused: "outside-the-lei: …" } : { standing: sovereign ? "hearth" : "herm" }),
    });
    expect(await by.dial()).toEqual({ session: false, waits: "composition-refused" });
    expect(holder.isUnlocked()).toBe(false);
    expect(by.waits()).toBe("composition-refused");
    refuse = false;
    expect(await by.dial()).toEqual({ session: true, waits: null });
    expect(by.waits()).toBeNull();
  });

  test("WELD: the custody door's pūlama reading names the stand-by's last dial before the holder's last hello", () => {
    const source = readFileSync(join(import.meta.dirname, "..", "src", "main.ts"), "utf8");
    expect(source).toContain("waits: pulama.isUnlocked() ? null : (standBy.waits() ?? pulama.waits())");
  });
});
