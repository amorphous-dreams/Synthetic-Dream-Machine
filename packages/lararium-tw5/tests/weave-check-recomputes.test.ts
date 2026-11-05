/**
 * weave-check-recomputes — a woven carrier or pin names the check its STX..ETX body earns, never the check a
 * hand wrote into the closer's `bcc` slot. The seal covers the body alone, so a stored value passed through
 * unread lets a forged or stale `bcc` ride into a pin line, a submission sidecar and a `meme-pin` render as if
 * it verified. The weave recomputes (`bccOf`); a carrier with no framed body reads "unchecked".
 */
import { describe, expect, test } from "vitest";
import { bccOf } from "@lararium/memetic-frame";
import { projectSubmission, readPin, transposeMarkdown } from "../src/weave/index.js";

const body = (bcc: string | null): string => [
  "<<!DOCTYPE type=`memetic-wikitext+tiddlywiki` spec=`lar:///ha.ka.ba/lares/api/pono/memetic-wikitext`>>",
  "",
  "<<^ code=`&#x0001;` namespace=`⊙` from=`?` to=`lar:///ha.ka.ba/lares/api/pono/probe`>>",
  "<<^ code=`&#x0002;`>>",
  "",
  "```toml meta",
  'l-space  = "adjacent"',
  'uri-path = "ha.ka.ba/lares/api/pono/probe"',
  "```",
  "",
  "A body line the seal covers.",
  "",
  bcc === null ? "<<^ code=`&#x0003;`>>" : `<<^ code=\`&#x0003;\` bcc=\`${bcc}\`>>`,
  "<<^ code=`&#x0004;` to=`?`>>",
  "",
].join("\n");

const FORGED = "ni:///sha-256;FORGED_not_the_hash_of_anything";

describe("the weave recomputes the check", () => {
  const earned = bccOf(body(null));

  test("the fixture earns a real check (control for the reds below)", () => {
    expect(earned).toMatch(/^ni:\/\/\/sha-256;/);
    expect(bccOf(body(FORGED))).toBe(earned);
  });

  test("transposeMarkdown names the earned check where the closer stores a forged one", () => {
    expect(transposeMarkdown(body(FORGED)).check).toBe(earned);
  });

  test("a correctly stored check reads the same (control)", () => {
    expect(transposeMarkdown(body(earned)).check).toBe(earned);
  });

  test("projectSubmission and readPin carry the earned check", () => {
    expect(projectSubmission(body(FORGED)).check).toBe(earned);
    const pin = readPin(body(FORGED), null);
    expect(pin?.check).toBe(earned);
  });

  test("a carrier with no ETX reads unchecked", () => {
    expect(transposeMarkdown("plain prose, no frame\n").check ?? "unchecked").toBe("unchecked");
  });
});
