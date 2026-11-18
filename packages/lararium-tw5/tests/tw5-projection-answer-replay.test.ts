import { afterEach, describe, expect, test } from "vitest";
import { mkLarResend } from "@lararium/mesh";
import { dispatchLarControlEvent, resendLarCamera } from "../src/tw5-projection.js";
import { mountSurface, type Surface } from "./projection-surface.js";
import { skipNote, wikiSkip } from "./test-wiki.js";

const title = "lar:///t/replay/count";
const counter = `<$button class="count" actions="""<$action-setfield $tiddler="${title}" text={{{ [{${title}}add[1]] }}}/>""">count</$button>`;

describe.skipIf(wikiSkip)(`the camera answer ring${skipNote}`, () => {
  let surface: Surface | undefined;
  afterEach(() => { surface?.stop(); surface = undefined; });

  test("a same-id resend replays the original answer and applies once; CONTROL: a new id applies, an old epoch refuses", async () => {
    surface = await mountSurface(counter, [{ title, text: "0" }]);
    const firstEvent = surface.event("count", { kind: "lar:act", action: "lar:click" });
    const firstAnswer = dispatchLarControlEvent(firstEvent);
    expect(firstAnswer).toMatchObject({ eventId: firstEvent.eventId, status: "applied" });
    await surface.flush();
    expect(surface.wiki.getTiddler(title)?.fields["text"]).toBe("1");

    const replay = dispatchLarControlEvent(firstEvent);
    expect(replay).toEqual(firstAnswer);
    await surface.flush();
    expect(surface.results.slice(0, 2)).toEqual([firstAnswer, firstAnswer]);
    expect(surface.wiki.getTiddler(title)?.fields["text"]).toBe("1");

    const nextEvent = surface.event("count", { kind: "lar:act", action: "lar:click" });
    expect(nextEvent.eventId).not.toBe(firstEvent.eventId);
    expect(dispatchLarControlEvent(nextEvent)).toMatchObject({ eventId: nextEvent.eventId, status: "applied" });
    await surface.flush();
    expect(surface.wiki.getTiddler(title)?.fields["text"]).toBe("2");

    resendLarCamera(mkLarResend(), surface.ctx.wikiUri);
    await surface.flush();
    expect(surface.last().mountEpoch).not.toBe(firstEvent.mountEpoch);
    expect(dispatchLarControlEvent(firstEvent)).toMatchObject({ eventId: firstEvent.eventId, status: "stale-target" });
    await surface.flush();
    expect(surface.wiki.getTiddler(title)?.fields["text"]).toBe("2");
  }, 120_000);
});
