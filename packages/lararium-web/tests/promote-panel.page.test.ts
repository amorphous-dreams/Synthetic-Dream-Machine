/**
 * promote-panel — the page's plain "rites waiting here" list, grouped per wiki: each waiting rite shows its origin, digest and code
 * class beside a commit button; a promoted rite shows its state, an orphan offers keep and drop, a shadowed edge reads set aside.
 * The panel reads no query or fragment key: its wiki, rows and clicks come through the vessel's api alone.
 * Every red pairs with a CONTROL. Meme: lar:///ha.ka.ba/lares/docs/pono/kahua-memory-stage
 */
import { afterEach, describe, expect, test } from "vitest";
import panelSource from "../src/promote-panel.ts?raw";
import { mountPromotePanel, type PromotePanelApi } from "../src/promote-panel.js";

const D = "d".repeat(64), E = "e".repeat(64);
const hosts: HTMLElement[] = [];
afterEach(() => { for (const h of hosts.splice(0)) h.remove(); });

function stand(snapshot: Awaited<ReturnType<PromotePanelApi["snapshot"]>>) {
  const clicks: string[] = [];
  const api: PromotePanelApi = {
    snapshot: async () => snapshot,
    commit: async (w, d) => { clicks.push(`commit ${w} ${d}`); }, drop: async (w, d) => { clicks.push(`drop ${w} ${d}`); },
    orphan: async (w, d, x) => { clicks.push(`orphan ${w} ${d} ${x}`); }, raise: async (w, d) => { clicks.push(`raise ${w} ${d}`); }, lower: async (w, d) => { clicks.push(`lower ${w} ${d}`); },
  };
  const host = document.createElement("div");
  document.body.append(host); hosts.push(host);
  return { host, api, clicks, panel: mountPromotePanel(host, api) };
}

const snapshot = {
  wikis: [
    { wiki: "daemon", shadowed: [], rows: [{ wiki: "daemon", digest: E, title: "rites/old", revision: "r", state: "orphaned", classes: ["module-type"], shadowed: false }],
      waiting: [{ title: "rites/field-notes", digest: D, revision: "r", classes: ["module-type", "startup-action"], origin: { seat: "seat-key", device: "dev-key", session: "s-1" } }] },
    { wiki: "garden", shadowed: [], rows: [], waiting: [] },
    { wiki: "broken", error: "wiki unreadable" },
  ],
} as never;

describe("rites waiting here", () => {
  test("RED: each wiki gets its own section; a waiting rite shows its title, origin, digest and class beside a commit button that commits THAT wiki's digest; CONTROL: an empty wiki says so and a broken one names its error", async () => {
    const s = stand(snapshot);
    await s.panel.refresh();
    const sections = [...s.host.querySelectorAll("[data-wiki]")].map((n) => n.getAttribute("data-wiki"));
    expect(sections).toEqual(["daemon", "garden", "broken"]);
    const daemon = s.host.querySelector('[data-wiki="daemon"]')!;
    expect(daemon.textContent).toContain("rites/field-notes");
    expect(daemon.textContent).toContain(D.slice(0, 12));
    expect(daemon.textContent).toContain("startup-action");
    expect(daemon.textContent).toContain("s-1");
    (daemon.querySelector(`[data-act="commit"][data-digest="${D}"]`) as HTMLButtonElement).click();
    expect(s.clicks).toEqual([`commit daemon ${D}`]);
    expect(s.host.querySelector('[data-wiki="garden"]')!.textContent).toContain("no rites waiting");
    expect(s.host.querySelector('[data-wiki="broken"]')!.textContent).toContain("wiki unreadable");
  });

  test("RED: an orphaned rite is named and offers keep and drop; CONTROL: a standing rite offers drop alone", async () => {
    const s = stand({ wikis: [{ wiki: "daemon", shadowed: [], waiting: [], rows: [
      { wiki: "daemon", digest: E, title: "rites/old", revision: "r", state: "orphaned", classes: [], shadowed: false },
      { wiki: "daemon", digest: D, title: "rites/live", revision: "r", state: "standing", classes: [], shadowed: false }] }] } as never);
    await s.panel.refresh();
    const q = (act: string, digest: string) => s.host.querySelector(`[data-act="${act}"][data-digest="${digest}"]`) as HTMLButtonElement | null;
    expect(s.host.textContent).toContain("orphaned");
    q("orphan-keep", E)!.click(); q("orphan-drop", E)!.click();
    expect(s.clicks).toEqual([`orphan daemon ${E} keep`, `orphan daemon ${E} drop`]);
    expect(q("orphan-keep", D)).toBeNull();
    expect(q("drop", D)).not.toBeNull();
  });

  test("RED: a shadowed edge reads set aside and offers lower, an open one offers raise; CONTROL: the panel reads no query or fragment key", async () => {
    const s = stand({ wikis: [{ wiki: "daemon", shadowed: [D], waiting: [], rows: [
      { wiki: "daemon", digest: D, title: "rites/live", revision: "r", state: "standing", classes: [], shadowed: true },
      { wiki: "daemon", digest: E, title: "rites/other", revision: "r", state: "standing", classes: [], shadowed: false }] }] } as never);
    history.replaceState(null, "", "?wiki=garden#digest=" + E);
    await s.panel.refresh();
    expect(s.host.querySelector(`[data-act="lower"][data-digest="${D}"]`)).not.toBeNull();
    expect(s.host.querySelector(`[data-act="raise"][data-digest="${E}"]`)).not.toBeNull();
    expect(s.host.querySelector(`[data-act="raise"][data-digest="${D}"]`)).toBeNull();
    expect(s.host.textContent).toContain("set aside");
    expect([...s.host.querySelectorAll("[data-wiki]")].map((n) => n.getAttribute("data-wiki"))).toEqual(["daemon"]);
    history.replaceState(null, "", location.pathname);
    expect(panelSource).not.toMatch(/location\.(search|hash|href)|URLSearchParams|history\./);
  });
});
