import { describe, expect, it } from "vitest";
import { said, vessel, world } from "./content-key-fixture.js";

/**
 * THE IMPORT DOOR NEEDS THIS VESSEL'S OWN SEAT (`content-key-holder.ts`, `importMemory`). An import wraps each entry
 * for this vessel's own seat alone, so a vessel whose seat stands in no key group of its face refuses the whole act
 * by name, before it opens the section. The holder decides this itself: a node vessel whose face holds no atom refuses
 * at its boot, so only the holder can show the refusal still stands.
 */
describe("the import door needs this vessel's own seat", () => {
  it("a vessel whose seat stands in no key group refuses the import `seat-not-standing`, before it opens the section", async () => {
    const v = await vessel(world(), "unseated");
    v.seated = false;
    const out = await v.holder.importMemory({ section: new Uint8Array([1, 2, 3]), secret: new Uint8Array(32), signer: v.signer });
    expect(said(out)).toBe("seat-not-standing");
  });

  it("CONTROL: the same vessel, seated, passes the seat and refuses the unreadable section as `memory-malformed`", async () => {
    const v = await vessel(world(), "seated");
    const out = await v.holder.importMemory({ section: new Uint8Array([1, 2, 3]), secret: new Uint8Array(32), signer: v.signer });
    expect(said(out)).toBe("memory-malformed");
  });
});
