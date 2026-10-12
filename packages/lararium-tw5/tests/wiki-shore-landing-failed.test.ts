import { describe, expect, test, vi } from "vitest";
import type { LarTiddlerChange } from "@lararium/mesh";
import { WaveLanding } from "../src/wave-landing.js";
import { landingFailedAlertTitle } from "../src/island-adaptor.js";
import { wikiSkip, skipNote } from "./test-wiki.js";
import { arrived, remote, shoreRig, turns } from "./wiki-shore-rig.js";

const change = (title: string): LarTiddlerChange => ({
  title,
  record: { tiddler: { title, text: title } },
  origin: remote,
});

describe("WaveLanding resident failure debt", () => {
  test("a twice-failed title rests outside idle until the next wave and recovers first", async () => {
    const title = "lar:///t/landing/owed";
    const next = "lar:///t/landing/next";
    const attempts: string[] = [];
    const failed = vi.fn();
    const recovered = vi.fn();
    let failTitle = true;
    const landing = new WaveLanding(async (item) => {
      attempts.push(item.title);
      if (item.title === title && failTitle) throw new Error("resident fault");
    }, async () => {}, (t, e) => failed(t, e), (t) => recovered(t));

    await landing.checkpoint();
    landing.enqueue(change(title));
    await landing.idle();
    expect(failed).toHaveBeenCalledTimes(1);
    expect(failed).toHaveBeenCalledWith(title, expect.any(Error));
    expect(landing.pending()).toBe(0);
    await landing.idle();

    failTitle = false;
    landing.enqueue(change(next));
    await landing.idle();
    expect(attempts.slice(2)).toEqual([title, next]);
    expect(recovered).toHaveBeenCalledTimes(1);
    expect(recovered).toHaveBeenCalledWith(title);
    landing.enqueue(change("lar:///t/landing/third"));
    await landing.idle();
    expect(attempts.filter((attempt) => attempt === title)).toHaveLength(3);
    await landing.stop();
  });

  test("a failed change superseded by a later landed change of the same title is never owed or replayed", async () => {
    const title = "lar:///t/landing/superseded";
    const landed: string[] = [];
    const failed = vi.fn();
    const landing = new WaveLanding(async (item) => {
      const text = String(item.record?.tiddler.text);
      if (text === "older") throw new Error("the older change cannot land");
      landed.push(`${item.title}=${text}`);
    }, async () => {}, failed);
    await landing.checkpoint();
    landing.enqueue({ title, record: { tiddler: { title, text: "older" } }, origin: remote });
    landing.enqueue({ title, record: { tiddler: { title, text: "newer" } }, origin: remote });
    await landing.idle();
    expect(landed).toEqual([`${title}=newer`]);
    expect(failed).not.toHaveBeenCalled();
    landing.enqueue(change("lar:///t/landing/after"));
    await landing.idle();
    expect(landed, "the next wave replays nothing for the superseded change").toEqual([`${title}=newer`, "lar:///t/landing/after=lar:///t/landing/after"]);
    await landing.stop();
  });

  test("an in-drain retry that succeeds raises no resident failure callback", async () => {
    let attempts = 0;
    const failed = vi.fn();
    const recovered = vi.fn();
    const landing = new WaveLanding(async () => { if (++attempts === 1) throw new Error("transient"); }, async () => {}, failed, recovered);
    await landing.checkpoint();
    landing.enqueue(change("lar:///t/landing/transient"));
    await landing.idle();
    expect(attempts).toBe(2);
    expect(failed).not.toHaveBeenCalled();
    expect(recovered).not.toHaveBeenCalled();
    await landing.stop();
  });
});

describe.skipIf(wikiSkip)(`resident landing failure alert surfaces and clears${skipNote}`, () => {
  test("another title's wave retries the owed title before its own landing", async () => {
    const r = await shoreRig();
    await r.adaptor.armSeedCheckpoint();
    const title = "lar:///t/landing/adaptor-failure";
    const next = "lar:///t/landing/adaptor-next";
    const resolve = r.composite.resolveLayered.bind(r.composite);
    let fails = 0;
    vi.spyOn(r.composite, "resolveLayered").mockImplementation(async (requested) => {
      if (requested === title && fails < 2) { fails++; throw new Error("composition refused"); }
      return resolve(requested);
    });
    const before = r.arrivals.length;
    await r.working.put({ tiddler: { title, text: "recovered value" } }, remote);
    await arrived(r, before, [title]);
    await r.adaptor.landingIdle();
    expect(fails).toBe(2);
    expect(r.wiki.getTiddler(landingFailedAlertTitle(title))?.fields).toMatchObject({
      "alert-kind": "landing-failed",
      "landing-title": title,
    });

    const nextBefore = r.arrivals.length;
    await r.working.put({ tiddler: { title: next, text: "next wave" } }, remote);
    await arrived(r, nextBefore, [next]);
    await r.adaptor.landingIdle();
    expect(r.wiki.getTiddler(title)?.fields.text).toBe("recovered value");
    expect(r.wiki.getTiddler(landingFailedAlertTitle(title))).toBeUndefined();
    await r.stop();
  }, 120_000);
});
