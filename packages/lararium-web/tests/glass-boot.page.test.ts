import { describe, expect, test } from "vitest";
import * as glass from "@lararium/tw5/glass";
import { TW5Engine } from "@lararium/tw5/glass";
import { named } from "../src/glass/cid.js";
import coreUrl from "../../lararium-tw5/tw5-core/tiddlywikicore-5.5.0-prerelease.js?url";

async function coreBytes(): Promise<Uint8Array> {
  const response = await fetch(coreUrl);
  if (!response.ok) throw new Error(`glass-core-fixture-unavailable:${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

/** Run `act`, then wait for the wiki's own change event; the camera's listener stands ahead of this one. */
function afterChange(tw: { wiki: { addEventListener(t: string, l: () => void): void; removeEventListener(t: string, l: () => void): void } }, act: () => void): Promise<void> {
  return new Promise<void>(resolve => {
    const listener = () => { tw.wiki.removeEventListener("change", listener); resolve(); };
    tw.wiki.addEventListener("change", listener);
    act();
  });
}

describe("glass boot on the real page", () => {
  test("keeps the unflagged main thread guard", async () => {
    await expect(new TW5Engine().boot(await coreBytes())).rejects.toThrow(/sovereignty violation/);
  });

  test("R2: a glass boolean cannot open the main-thread guard", async () => {
    const engine = new TW5Engine();
    try {
      await expect(engine.boot(await coreBytes(), [], { glass: true } as never)).rejects.toThrow(/sovereignty violation/);
    } finally { engine.dispose(); engine.releaseGlass(); }
  });

  test("boots the third runtime and refreshes a shadow camera", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const shadowRoot = host.attachShadow({ mode: "open" });
    const transport = { send: () => ({ ok: true as const }), onMessage: () => () => {} };
    const door = (glass as any).openMirror;
    expect(door).toBeTypeOf("function");
    const bytes = await coreBytes();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const coreCid = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    const camera = await door({ transport, inputs: { coreBytes: bytes, coreCid, preloadedTiddlers: [
      { title: "Glass Seed", text: "Glass seed body" },
      { title: "$:/StoryList", list: ["Glass Seed"] },
    ] }, shadowRoot, wikiUri: "wiki", actor: "actor", width: "full", portId: "test", mintTx: () => "tx" });
    const tw = camera.tw;
    expect(tw.syncer).toBeUndefined();
    expect(tw.wiki.getTiddler("Glass Seed")?.fields.text).toBe("Glass seed body");

    // The story startup opens its default tiddlers at boot; the person's story list lands next, as the port would land it.
    await afterChange(tw, () => tw.wiki.addTiddler(new tw.Tiddler({ title: "$:/StoryList", list: ["Glass Seed"] })));
    expect(shadowRoot.textContent).toContain("Glass seed body");
    expect(shadowRoot.querySelector("style")?.textContent).toContain("--tpc-background");
    expect(shadowRoot.querySelector("style")?.querySelector("p")).toBeNull();

    await afterChange(tw, () => tw.wiki.addTiddler(new tw.Tiddler({ title: "Glass Seed", text: "Changed glass body" })));
    expect(shadowRoot.textContent).toContain("Changed glass body");
    camera.unmount();
    expect(shadowRoot.childNodes).toHaveLength(0);
    tw.wiki.addTiddler(new tw.Tiddler({ title: "Glass Seed", text: "After unmount" }));
    expect(shadowRoot.childNodes).toHaveLength(0);
    host.remove();
    // CONTROL: the lends stay for the engine's life and leave with it.
    expect(typeof (globalThis as Record<string, unknown>)["Buffer"]).toBe("function");
    expect(typeof (globalThis as Record<string, unknown>)["Buffer"]).toBe("undefined");
  });
});

describe("glass cas names", () => {
  test("a malformed core or plugin id refuses by name before any read; a hash passes", () => {
    expect(() => named("core", "not-a-cid")).toThrow("glass-core-cid-refused:not-a-cid");
    expect(() => named("plugin", "../x")).toThrow("glass-plugin-cid-refused:../x");
    expect(named("core", "0".repeat(64))).toBe("0".repeat(64));
  });
});
