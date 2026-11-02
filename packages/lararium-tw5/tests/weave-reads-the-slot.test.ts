/**
 * The weave reads a carrier's check from the ETX mark's `bcc` slot — a value of the check's own shape,
 * and nothing else. A slot holding anything but an `ni:///<alg>;<base64url>` reads `unchecked`, so a
 * woven pair never carries a malformed value forward as its source-check (Cold-Reader L10).
 *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */
import { describe, test, expect } from "vitest";
import { transposeMarkdown } from "../src/weave/index.js";

const carrier = (etx: string): string =>
  "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>\n\n"
  + "<<^ code=`&#x0001;` from=`?` to=`lar:///t.t.t/weave-slot`>>\n<<^ code=`&#x0002;`>>\n\n! Head\n\nbody.\n\n"
  + `${etx}\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

describe("★ the weave's check comes from the slot, in the check's own shape ★", () => {
  test("RED: a slot holding a non-check value reads unchecked, never that value", () => {
    expect(transposeMarkdown(carrier("<<^ code=`&#x0003;` bcc=`not-a-check`>>")).check ?? "unchecked").toBe("unchecked");
  });

  test("CONTROL: a slot holding a check reads that check; a bare ETX reads unchecked", () => {
    expect(transposeMarkdown(carrier("<<^ code=`&#x0003;` bcc=`ni:///sha-256;abc`>>")).check).toBe("ni:///sha-256;abc");
    expect(transposeMarkdown(carrier("<<^ code=`&#x0003;`>>")).check ?? "unchecked").toBe("unchecked");
  });
});
