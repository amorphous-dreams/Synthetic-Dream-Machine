import { afterEach, expect, test } from "vitest";
import { dispatchLarControlEvent } from "../src/tw5-projection.js";
import { mountSurface, type Surface } from "./projection-surface.js";
import { skipNote, wikiSkip } from "./test-wiki.js";

let surface: Surface | undefined;
afterEach(() => { surface?.stop(); surface = undefined; });

test.skipIf(wikiSkip)(`summons carry their actual leg, never a tiddler's origin claim${skipNote}`, async () => {
  const title = "lar:///test/origin/summon";
  surface = await mountSurface(`<\$button class="summon"><\$action-setfield \$tiddler="${title}" verb="pin" lares-dispatch="yes" listenable="place"/></\$button>`);
  const events: Array<Record<string, unknown>> = [];
  const wiki = surface.wiki as unknown as { addEventListener(t: string, f: (e: Record<string, unknown>) => void): void; removeEventListener(t: string, f: (e: Record<string, unknown>) => void): void };
  const record = (e: Record<string, unknown>) => events.push(e);
  wiki.addEventListener("tm-verse-event", record);
  try {
    // CONTROL: the control leg writes the very same summon and must identify a surface act.
    expect(dispatchLarControlEvent(surface.event("summon", { kind: "lar:act", action: "lar:click" }))).toMatchObject({ status: "applied" });
    await surface.flush();
    expect(events.filter((e) => e.verb === "pin")).toHaveLength(1);
    // RED today: the router and verse event do not carry a leg-derived origin.
    expect(events.at(-1)).toMatchObject({ verb: "pin", origin: "surface" });
  } finally { wiki.removeEventListener("tm-verse-event", record); }
}, 120_000);

test.skipIf(wikiSkip)(`a store-written summon cannot claim the surface leg${skipNote}`, async () => {
  surface = await mountSurface("<p>origin</p>");
  const events: Array<Record<string, unknown>> = [];
  const wiki = surface.wiki as unknown as { addEventListener(t: string, f: (e: Record<string, unknown>) => void): void; removeEventListener(t: string, f: (e: Record<string, unknown>) => void): void };
  const record = (e: Record<string, unknown>) => events.push(e);
  wiki.addEventListener("tm-verse-event", record);
  try {
    surface.wiki.addTiddler({ title: "lar:///test/origin/synced", verb: "pin", "lares-dispatch": "yes", listenable: "place", origin: "surface", "lar-origin": "channel" });
    await surface.flush();
    expect(events.filter((e) => e.verb === "pin")).toHaveLength(1);
    // RED today: content events carry no origin at all.
    expect(events.at(-1)).toMatchObject({ verb: "pin", origin: "content" });
  } finally { wiki.removeEventListener("tm-verse-event", record); }
}, 120_000);

test.skipIf(wikiSkip)(`a store write landing beside a click, in the same change batch, does not inherit the click's surface stamp${skipNote}`, async () => {
  const title = "lar:///test/origin/clicked";
  surface = await mountSurface(`<\$button class="summon"><\$action-setfield \$tiddler="${title}" verb="pin" lares-dispatch="yes"/></\$button>`);
  const events: Array<Record<string, unknown>> = [];
  const wiki = surface.wiki as unknown as { addEventListener(t: string, f: (e: Record<string, unknown>) => void): void; removeEventListener(t: string, f: (e: Record<string, unknown>) => void): void };
  const record = (e: Record<string, unknown>) => events.push(e);
  wiki.addEventListener("tm-verse-event", record);
  try {
    expect(dispatchLarControlEvent(surface.event("summon", { kind: "lar:act", action: "lar:click" }))).toMatchObject({ status: "applied" });
    // The router reads changes in a batch after the handler returns: a synced write landing before that batch
    // fires must still read content (Terra's seam, slice 4).
    surface.wiki.addTiddler({ title: "lar:///test/origin/neighbour", verb: "unpin", "lares-dispatch": "yes" });
    await surface.flush();
    expect(events.find((e) => e.verb === "pin")).toMatchObject({ origin: "surface" });
    expect(events.find((e) => e.verb === "unpin")).toMatchObject({ origin: "content" });
  } finally { wiki.removeEventListener("tm-verse-event", record); }
}, 120_000);


test.skipIf(wikiSkip)(`a click's write the router never reads leaves no stamp behind (Luna and Sol, slice 4)${skipNote}`, async () => {
  surface = await mountSurface(`<\$button class="plain"><\$action-setfield \$tiddler="$:/temp/plain-write" text="x"/></\$button>`);
  expect(dispatchLarControlEvent(surface.event("plain", { kind: "lar:act", action: "lar:click" }))).toMatchObject({ status: "applied" });
  await surface.flush();
  const stamps = (surface.wiki as unknown as { __larSurfaceWrites?: Map<string, unknown> }).__larSurfaceWrites;
  // RED today: every title a dispatch writes is stamped, and a title outside `lar:` never reaches the router to consume it.
  expect(stamps?.has("$:/temp/plain-write") ?? false).toBe(false);
}, 120_000);
