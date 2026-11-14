/**
 * ceremony-page — THE BROKER STANDS ONLY OVER A PAGE IT CONTROLS (browser-vessel-lift slice 4; Gate-and-Glass, Sol 2026-11-06).
 *
 * On a first load the service worker activates before it claims the page: `registration.active` stands while
 * `navigator.serviceWorker.controller` still reads null, and the broker's `clients.matchAll({type:"window"})` reads controlled
 * windows alone, so a want for an uncontrolled page reaches nobody. The page's broker therefore waits on control.
 *
 *   CP1 RED   a first-load page whose worker stands active but has not claimed it: the broker does not stand until
 *             `controllerchange`, and then stands as the page's controller.
 *   CONTROL   a page already controlled stands its broker at once.
 *
 * AN ASK READS AS AN ASK. A boot may ask a person twice in a row (a founding's place card, then its first passphrase), and the
 * ceremony's window closes between the two. The page's notice and its boot status row carry the whole signal that the vessel
 * waits on the person, so each ask names itself on its own button and the status row says who the boot waits on.
 *
 *   CP2 RED   each ask kind's button names that ask; no two kinds share a label.
 *   CP3 RED   while an ask stands, the boot status row says it waits on the person and names the ask; a second ask after the
 *             first settles re-words it; the last settle hands the row back to the boot. The row carries no `warn` or `err`
 *             class (a harness reads those as a verdict).
 *   CONTROL   a page with no broker paints the refusal and no button, and the status row never says it waits on the person;
 *             a status another hand wrote while the ask stood stays as written.
 *
 * THE PAGE SAYS WHICH ASKS STILL STAND. The console door's `vessel read` names every ask the page shows, read off the notices
 * themselves, so a person who missed a second ask reads it by name.
 *
 *   CP4 RED   two asks painted in one boot both read standing, each with its kind; the one whose button was pressed reads
 *             `window-opened`, the other `button-waits`; a refused ask reads `refused` with its name; a settled ask reads absent.
 *
 * THE RESET ASK READS AS AN ASK OF ITS OWN (browser-vessel-lift#/the-reset). The page burns nothing: it paints the ask, and the
 * ask's button opens the ceremony document, which takes the typed confirmation.
 *
 *   CP5 RED   the reset ask's button names the reset and shares its label with no other kind; pressing it opens the ceremony
 *             document at `#reset=<askId>` in a window with no opener; a second reset ask answers the standing one's id and
 *             paints no second notice; the notice reads among the standing asks; "not now" takes it down.
 *   CONTROL   the boot status row never says the boot waits on a reset: the vessel boots on beneath it.
 *   CP6 RED   THE PAGE RECORDS THE RESET ASK IT RAISES, and the ceremony burns for no other (#/the-reset): painting the ask
 *             writes `lares:reset-ask:<id>` to the origin's record; each press writes it again before the ceremony opens;
 *             "not now" forgets it. A page whose storage withholds itself paints the refusal `reset-unrecorded` with no
 *             button to a ceremony that would refuse. CONTROL: a second ask in the same page records nothing new.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { expect, test } from "vitest";
import { openResetCeremony, paintCeremonyAsk, paintResetAsk, resetAskAnswer, settleCeremonyAsk, standCeremonyBroker, standingAsks, type CeremonyBroker, type PageAsk } from "../src/ceremony-page.js";
import { resetAskStands, type AskRecord } from "../src/ceremony/reset-core.js";

/** The origin's ask record over a plain map. */
function recordOf() {
  const map = new Map<string, string>();
  const record: AskRecord = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: (k) => { map.delete(k); } };
  return { map, record };
}

function containerOf(active: ServiceWorker, controller: ServiceWorker | null) {
  const listeners = new Set<() => void>();
  const container = {
    controller,
    register: async () => ({ active }),
    ready: Promise.resolve({ active }),
    addEventListener(type: string, l: () => void) { if (type === "controllerchange") listeners.add(l); },
    removeEventListener(type: string, l: () => void) { if (type === "controllerchange") listeners.delete(l); },
  };
  return { container, claim(by: ServiceWorker) { container.controller = by; for (const l of [...listeners]) l(); } };
}
const worker = (name: string) => ({ name, postMessage() {} }) as unknown as ServiceWorker;

test("CP1 RED a first-load page's broker waits on the page's control, then stands as its controller", async () => {
  const sw = worker("broker");
  const c = containerOf(sw, null);
  let stood: unknown = "waiting";
  void standCeremonyBroker({ isSecureContext: true, container: c.container as never }).then((b) => { stood = b; });
  await new Promise((r) => setTimeout(r, 50));
  expect(stood, "an active worker that has not claimed the page stands no broker yet").toBe("waiting");
  c.claim(sw);
  await new Promise((r) => setTimeout(r, 10));
  expect(stood, "the claim stands the broker as the page's controller").toEqual({ worker: sw });
});

test("CONTROL a page already controlled stands its broker at once", async () => {
  const sw = worker("broker");
  const c = containerOf(sw, sw);
  await expect(standCeremonyBroker({ isSecureContext: true, container: c.container as never })).resolves.toEqual({ worker: sw });
});

/** A page as the vessel's boot leaves it: the status row inside the vessel panel, mid-boot. */
function bootPage(): { doc: Document; status: HTMLElement } {
  const doc = document.implementation.createHTMLDocument("vessel");
  doc.body.innerHTML = '<main><div id="vessel"><div class="row"><span class="k">status</span><span class="v" id="status">booting…</span></div></div></main>';
  return { doc, status: doc.getElementById("status")! };
}
const KINDS = ["unlock", "bind-first", "clear", "ward", "card"] as const;
const askOf = (kind: PageAsk["kind"], n = 1): PageAsk => ({ askId: `00000000-0000-4000-8000-00000000000${n}`, kind, act: "boot", words: "" });
const standing = (): Promise<CeremonyBroker> => Promise.resolve({ worker: worker("broker") });
const doors = (broker: Promise<CeremonyBroker>, refused: string[] = []) => ({ broker, port: () => {}, refused: (r: string) => { refused.push(r); }, open: () => {} });

test("CP2 RED each ask kind names itself on its button, and no two kinds share a label", async () => {
  const labels = new Map<string, string>();
  for (const kind of KINDS) {
    const { doc } = bootPage();
    paintCeremonyAsk(doc, askOf(kind), doors(standing()));
    labels.set(kind, doc.querySelector<HTMLElement>(".ceremony-ask button.ceremony-open")!.textContent ?? "");
  }
  expect(new Set(labels.values()).size, `every kind carries its own label: ${JSON.stringify([...labels])}`).toBe(KINDS.length);
  expect(labels.get("card")).toContain("place card");
  expect(labels.get("bind-first")).toContain("first passphrase");
  // CONTROL: the unlock keeps the words a returning person knows.
  expect(labels.get("unlock")).toBe("open the unlock ceremony");
});

test("CP3 RED a standing ask turns the boot status row to the person, a second ask re-words it, and the last settle hands the row back", async () => {
  const { doc, status } = bootPage();
  const card = askOf("card", 1), bind = askOf("bind-first", 2);
  paintCeremonyAsk(doc, card, doors(standing()));
  expect(status.textContent, "the row says the boot waits on the person").toMatch(/^waiting on you/);
  expect(status.textContent).toContain("place card");
  expect([...status.classList], "no verdict class rides a waiting row").toEqual(["v", "ask"]);
  const first = status.textContent;
  settleCeremonyAsk(doc, card.askId);
  expect(status.textContent, "between two asks the boot runs on").toBe("booting…");
  expect([...status.classList]).toEqual(["v"]);
  paintCeremonyAsk(doc, bind, doors(standing()));
  expect(status.textContent).toMatch(/^waiting on you/);
  expect(status.textContent, "the second ask reads as another ask, never as the first one still standing").not.toBe(first);
  expect(status.textContent).toContain("first passphrase");
  expect(doc.querySelectorAll(".ceremony-ask").length).toBe(1);
  settleCeremonyAsk(doc, bind.askId);
  expect(status.textContent).toBe("booting…");
});

test("CONTROL a page with no broker paints the refusal with no button and no waiting row; a status another hand wrote stays as written", async () => {
  const { doc, status } = bootPage();
  const refused: string[] = [];
  paintCeremonyAsk(doc, askOf("unlock"), doors(Promise.resolve({ refusal: "ceremony-broker-absent" }), refused));
  await new Promise((r) => setTimeout(r, 0));
  expect(refused).toEqual(["ceremony-broker-absent"]);
  expect(doc.querySelector(".ceremony-ask")!.getAttribute("data-refusal")).toBe("ceremony-broker-absent");
  expect(doc.querySelector(".ceremony-ask button")).toBeNull();
  expect(status.textContent, "a refused ask waits on nobody").toBe("booting…");

  const live = bootPage();
  const ask = askOf("unlock", 3);
  paintCeremonyAsk(live.doc, ask, doors(standing()));
  live.status.textContent = "the vessel ended"; live.status.className = "v err";
  settleCeremonyAsk(live.doc, ask.askId);
  expect(live.status.textContent, "the settle never overwrites a verdict").toBe("the vessel ended");
  expect(live.status.className).toBe("v err");
  // A live page holds no boot status row at all (the vessel panel repainted): an ask there paints its notice alone.
  live.doc.getElementById("vessel")!.replaceChildren();
  expect(() => { paintCeremonyAsk(live.doc, askOf("ward", 4), doors(standing())); settleCeremonyAsk(live.doc, askOf("ward", 4).askId); }).not.toThrow();
});

test("CP4 RED the page names every ask it still shows: its kind, and whether its button waits, its window opened, or it refused", async () => {
  const { doc } = bootPage();
  const card = askOf("card", 1), bind = askOf("bind-first", 2), ward = askOf("ward", 3);
  paintCeremonyAsk(doc, card, doors(standing()));
  paintCeremonyAsk(doc, bind, doors(standing()));
  doc.querySelector<HTMLElement>(`.ceremony-ask[data-ask-id="${card.askId}"] button.ceremony-open`)!.click();
  await new Promise((r) => setTimeout(r, 0));
  expect(standingAsks(doc)).toEqual([
    { askId: bind.askId, kind: "bind-first", ceremony: "button-waits", refusal: null },
    { askId: card.askId, kind: "card", ceremony: "window-opened", refusal: null },
  ]);
  paintCeremonyAsk(doc, ward, doors(Promise.resolve({ refusal: "ceremony-broker-absent" })));
  await new Promise((r) => setTimeout(r, 0));
  expect(standingAsks(doc)[0]).toEqual({ askId: ward.askId, kind: "ward", ceremony: "refused", refusal: "ceremony-broker-absent" });
  // A settled ask reads absent: its notice left the page.
  settleCeremonyAsk(doc, card.askId);
  expect(standingAsks(doc).map((a) => a.kind)).toEqual(["ward", "bind-first"]);
});

test("CP5 RED the reset ask names itself, opens the ceremony at #reset=<askId> with no opener, stands once, and never words the boot row", () => {
  const { doc, status } = bootPage();
  const RESET = "00000000-0000-4000-8000-0000000000aa";
  const opened: string[][] = [];
  const open = (askId: string): void => openResetCeremony(askId, (url, target, features) => { opened.push([url, target, features]); return null; });
  const { record } = recordOf();
  expect(paintResetAsk(doc, () => RESET, open, record)).toBe(RESET);
  const button = doc.querySelector<HTMLElement>(".ceremony-ask[data-ask=\"reset\"] button.ceremony-open")!;
  expect(button.textContent).toBe("open the reset ceremony");
  for (const kind of KINDS) {
    const other = bootPage();
    paintCeremonyAsk(other.doc, askOf(kind), doors(standing()));
    expect(other.doc.querySelector<HTMLElement>(".ceremony-ask button.ceremony-open")!.textContent, `${kind} carries another label`).not.toBe(button.textContent);
  }
  // CONTROL: the vessel boots on beneath a reset ask, so the boot row keeps its own words.
  expect(status.textContent).toBe("booting…");
  expect(opened, "painting opens nothing: the person's press does").toEqual([]);
  button.click();
  expect(opened).toEqual([[`/ceremony.html#reset=${RESET}`, "_blank", "noopener"]]);
  expect(standingAsks(doc)).toEqual([{ askId: RESET, kind: "reset", ceremony: "window-opened", refusal: null }]);
  // A second ask answers the standing one and paints no second notice.
  expect(paintResetAsk(doc, () => "00000000-0000-4000-8000-0000000000bb", open, record)).toBe(RESET);
  expect(doc.querySelectorAll(".ceremony-ask").length).toBe(1);
  doc.querySelector<HTMLElement>(".ceremony-ask button.ceremony-withdraw")!.click();
  expect(doc.querySelector(".ceremony-ask")).toBeNull();
});

test("CP6 RED the page records the reset ask it raises, records it again at each press, forgets it at not-now, and refuses reset-unrecorded where storage withholds itself", () => {
  const { doc } = bootPage();
  const RESET = "00000000-0000-4000-8000-0000000000aa";
  const { map, record } = recordOf();
  const stoodAtOpen: boolean[] = [];
  const open = (askId: string): void => { stoodAtOpen.push(resetAskStands(record, askId)); };
  expect(paintResetAsk(doc, () => RESET, open, record)).toBe(RESET);
  expect([...map.keys()], "the paint records the ask under the vessel's own prefix").toEqual([`lares:reset-ask:${RESET}`]);
  // CONTROL: a second ask answers the standing one and records nothing new.
  paintResetAsk(doc, () => "00000000-0000-4000-8000-0000000000bb", open, record);
  expect([...map.keys()]).toEqual([`lares:reset-ask:${RESET}`]);
  // A record another hand removed (a decline in an earlier ceremony window, a cleared storage) returns at the press.
  map.clear();
  doc.querySelector<HTMLElement>(".ceremony-ask[data-ask=\"reset\"] button.ceremony-open")!.click();
  expect(stoodAtOpen, "the ask stands recorded as its ceremony opens").toEqual([true]);
  doc.querySelector<HTMLElement>(".ceremony-ask button.ceremony-withdraw")!.click();
  expect([...map.keys()], "not now forgets the ask, so its id stands no ceremony").toEqual([]);

  // A storage that withholds itself: the ceremony would refuse, so the page says so and offers no button to it.
  const dark = bootPage();
  const withheld: AskRecord = { getItem: () => null, setItem: () => { throw new Error("SecurityError"); }, removeItem: () => {} };
  const opened: string[] = [];
  paintResetAsk(dark.doc, () => RESET, (askId) => { opened.push(askId); }, withheld);
  const notice = dark.doc.querySelector<HTMLElement>(".ceremony-ask[data-ask=\"reset\"]")!;
  expect(notice.dataset["refusal"]).toBe("reset-unrecorded");
  expect(notice.querySelector("button.ceremony-open:not(.ceremony-withdraw)")).toBeNull();
  expect(standingAsks(dark.doc)).toEqual([{ askId: RESET, kind: "reset", ceremony: "refused", refusal: "reset-unrecorded" }]);
  expect(opened).toEqual([]);
});

test("CP6b RED `vessel reset` answers what the page shows: a withheld storage names reset-unrecorded and sends nobody to a button the notice never offers", () => {
  const RESET = "00000000-0000-4000-8000-0000000000aa";
  const dark = bootPage();
  const withheld: AskRecord = { getItem: () => null, setItem: () => { throw new Error("SecurityError"); }, removeItem: () => {} };
  const refused = resetAskAnswer(dark.doc, paintResetAsk(dark.doc, () => RESET, () => {}, withheld));
  expect(refused).toMatchObject({ refusal: "reset-unrecorded" });
  expect((refused as { why: string }).why).toMatch(/withholds this site's storage/);
  expect(JSON.stringify(refused)).not.toMatch(/press/);
  // CONTROL: a recorded ask names its id and the button that opens its ceremony.
  const lit = bootPage();
  const answer = resetAskAnswer(lit.doc, paintResetAsk(lit.doc, () => RESET, () => {}, recordOf().record));
  expect(answer).toMatchObject({ asked: "reset", askId: RESET });
  expect((answer as { next: string }).next).toMatch(/press "open the reset ceremony"/);
});
