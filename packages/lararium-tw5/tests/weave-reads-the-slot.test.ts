/**
 * The weave recomputes the check over a framed body regardless of the ETX slot's contents. *
 * Meme: lar:///ha.ka.ba/lares/api/pono/memetic-wikitext-framing
 */
import { describe, test, expect } from "vitest";
import { transposeMarkdown } from "../src/weave/index.js";
import { bccOf, stampCarrier, verdict } from "@lararium/memetic-frame";

const carrier = (etx: string): string =>
  "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>\n\n"
  + "<<^ code=`&#x0001;` from=`?` to=`lar:///t.t.t/weave-slot`>>\n<<^ code=`&#x0002;`>>\n\n"
  // The sealed root meta names the head's address, so the seal binds the head (head-bind.ts).
  + "```toml meta\ntitle = \"lar:///t.t.t/weave-slot\"\n```\n\n! Head\n\nbody.\n\n"
  + `${etx}\n\n<<^ code=\`&#x0004;\` to=\`?\`>>\n`;

describe("★ the weave computes the body's check ★", () => {
  test("stored values and a bare ETX all report the earned check", () => {
    for (const etx of ["<<^ code=`&#x0003;` bcc=`not-a-check`>>", "<<^ code=`&#x0003;` bcc=`ni:///sha-256;abc`>>", "<<^ code=`&#x0003;`>>"]) {
      const text = carrier(etx);
      expect(transposeMarkdown(text).check).toBe(bccOf(text));
    }
  });
});

describe("★ the weave never drops text the seal covers ★", () => {
  test("RED: text after the STX mark (inside the checked span, rendered inline by the plugin) survives the weave", () => {
    const t = stampCarrier(carrier("<<^ code=`&#x0003;`>>").replace("<<^ code=`&#x0002;`>>", "<<^ code=`&#x0002;`>> HIDDEN-IN-WEAVE"));
    // The text now stands between STX and the root meta, so that meta no longer OPENS the body and binds
    // nothing (the fence-opens-the-body rule): the head reads unbound, and the check still verifies.
    expect(verdict(t).kind).toBe("head-unbound");
    expect(transposeMarkdown(t).markdown).toContain("HIDDEN-IN-WEAVE");
  });

  test("CONTROL: a frame mark alone on its line still drops from the woven markdown", () => {
    const t = stampCarrier(carrier("<<^ code=`&#x0003;`>>"));
    const md = transposeMarkdown(t).markdown;
    expect(md).not.toContain("&#x0002;");
    expect(md).not.toContain("&#x0003;");
    expect(md).toContain("body.");
  });
});
