/**
 * ddate-macro — `<<ddate>>` renders the Discordian date of the day, in any wiki that holds the memetic-wikitext plugin.
 *
 * The macro renders the DAY and never a cast: the same day answers the same words, a `%.` draws from a door keyed on
 * the day, and the calendar itself comes from the one core the CLI and the daemon verb share
 * (`@lararium/mesh/ddate`, held against the host's `ddate` by its own golden tests).
 */
import { describe, test, expect, beforeAll } from "vitest";
import { TW5Engine } from "../src/tw5-vm.js";
import { bootTestWiki, renderWikitext, wikiSkip, skipNote } from "./test-wiki.js";
import { DEFAULT_FORMAT, EXCLAMATIONS, dayEntropy, discordianDay, formatDiscordian } from "@lararium/mesh/ddate";

describe.skipIf(wikiSkip)(`<<ddate>> renders the day${skipNote}`, () => {
  let e: TW5Engine;
  beforeAll(async () => { e = await bootTestWiki(); }, 60_000);
  const r = (t: string) => renderWikitext(e, t);

  /** The core's own answer for the local day, the same seam the macro reads. */
  function core(format: string): string {
    const here = new Date();
    const today = { year: here.getFullYear(), month: here.getMonth() + 1, day: here.getDate() };
    return formatDiscordian(discordianDay(today)!, format, dayEntropy(today)).text;
  }
  const escaped = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\s+/g, " ").trim();

  test("CONTROL — the plugin stands, so the bare macro call is the one under test", () => {
    expect(r("just prose")).toContain("just prose");
  });

  test("a bare <<ddate>> renders the default line for the day", () => {
    const html = r("<<ddate>>");
    expect(html).toMatch(/^<p>Today is .+, the \d+(st|nd|rd|th) day of (Chaos|Discord|Confusion|Bureaucracy|The Aftermath) in the YOLD \d+/);
    expect(html).toContain(escaped(core(DEFAULT_FORMAT).split("\n")[0]!));
  });

  test("<<ddate format>> takes the ddate(1) codes", () => {
    const html = r('<<ddate "%A, %B %d, %Y">>');
    expect(html).toContain(escaped(core("%A, %B %d, %Y")));
  });

  test("the same day renders the same words, a `%.` included, and the draw is one of the house's exclamations", () => {
    const a = r('<<ddate "%.">>');
    const b = r('<<ddate "%.">>');
    expect(a).toBe(b);
    expect(EXCLAMATIONS.some((x) => a.includes(x.replace(/'/g, "'")) || a.includes(x.replace(/'/g, "&#39;")))).toBe(true);
  });

  test("the %E easter egg and the ordinals ride the macro", () => {
    expect(r('<<ddate "%e|%E">>')).toContain(escaped(core("%e|%E")));
  });
});
