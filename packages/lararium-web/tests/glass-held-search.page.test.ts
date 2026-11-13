/**
 * glass-held-search — a person on a tab the evidence holds at skinny still gets stock TiddlyWiki's search: the sidebar's search
 * box takes their words, the dropdown opens on that focus, and the count button toggles it. The records ride as a skinny port
 * sends them (titles and tags, each body left out), and the engine boots with them in its store. The e2e walk
 * (`shore-writes`: "a tab held at skinny …") drives the same steps over a real vessel; this file holds them without one.
 */
import { afterEach, beforeEach, expect, test } from "vitest";
import { standMirror } from "../src/glass/stand.js";
import { forgetEvidence, rig } from "./glass-rig.js";
import housePlugin from "../../lararium-tw5/plugins/lares-memetic-wikitext.json";
import bootShadows from "../../lararium-tw5/plugins/lararium-boot-shadows.json";
import vanilla from "../../lararium-tw5/plugins/tiddlywiki-vanilla.json";
import snowwhite from "../../lararium-tw5/plugins/tiddlywiki-snowwhite.json";

beforeEach(forgetEvidence); afterEach(forgetEvidence);

const preloads = [housePlugin, ...(bootShadows as Record<string, unknown>[]), vanilla, snowwhite] as Record<string, unknown>[];
/** A record as a skinny port carries it: the body exists and stays behind. */
const skinny = (title: string, tags = "") => ({ title, fields: tags ? { tags } : {}, omitted: ["text"] });
const frames = () => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
const until = async (what: string, read: () => boolean): Promise<void> => {
  for (let turn = 0; turn < 120 && !read(); turn++) await frames();
  expect(read(), what).toBe(true);
};

async function walk(held: boolean) {
  if (held) sessionStorage.setItem("mirror:began:wiki", "left-by-a-full-boot-that-died");
  const r = await rig({ preloads, records: [skinny("lar:///ha.ka.ba/lares/docs/welcome", "$:/tags/lares/Landing"), skinny("Shore Write Probe Updated"), skinny("Another Note")] as never });
  r.host.style.cssText = "display:block;width:1100px;height:700px";
  const result = await standMirror(r.options, r.seams) as any;
  try {
    expect(result.kind).toBe("mirror");
    expect(await result.settled).toEqual(held ? { width: "skinny", why: "full-boot-unfinished" } : { width: "full" });
    const shadow = r.host.shadowRoot!;
    const dropdown = () => shadow.querySelector<HTMLElement>(".tc-search-drop-down");
    const open = () => { const node = dropdown(); return !!node && node.getClientRects().length > 0; };
    const input = shadow.querySelector<HTMLInputElement>('input[type="search"]');
    expect(input, "the sidebar's search box stands in the pane").not.toBeNull();
    expect(input!.getClientRects().length, "and shows").toBeGreaterThan(0);
    // The person types: focus opens the dropdown (`focusPopup`), the words reach the search state.
    input!.focus();
    input!.value = "Probe";
    input!.dispatchEvent(new InputEvent("input", { bubbles: true, composed: true }));
    await until("the dropdown opens on the search box's focus", open);
    await until("the search finds the record by its title, though its body stayed behind", () => (dropdown()?.textContent ?? "").includes("Shore Write Probe Updated"));
    // The count button carries the popup handle: its first click shuts the dropdown the focus opened, its second opens it.
    const count = () => [...shadow.querySelectorAll<HTMLButtonElement>("button")].find(button => /matches/.test(button.textContent ?? ""))!;
    expect(count(), "the count button stands").toBeDefined();
    count().click();
    await until("the count button shuts the dropdown", () => !open());
    count().click();
    await until("and opens it again", open);
    expect(shadow.querySelectorAll(".tc-alerts .tc-alert").length, "no alert covers the pane").toBe(0);
    expect(r.messages.filter(m => m.type === "port:write"), "a search writes nothing across the port").toEqual([]);
  } finally { result.unmount?.(); r.host.remove(); }
}

test("a tab the evidence holds at skinny searches as stock TiddlyWiki does", async () => { await walk(true); });
test("CONTROL: the same walk on a full tab", async () => { await walk(false); });
