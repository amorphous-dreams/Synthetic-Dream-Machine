/**
 * smoke.spec.ts — Lararium node exploratory smoke tests.
 *
 * Drives the live app and reports what works, what breaks, and what's confusing.
 * Run with: pnpm --filter @lararium/node e2e
 */

import { test, expect, Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForLive(page: Page, timeout = 20_000) {
  await page.waitForFunction(
    () => (window as any).__larariumDebug?.openPhase === "live",
    { timeout }
  ).catch(() => null); // don't fail — we'll report what phase we're stuck at
}

async function getPhase(page: Page): Promise<string> {
  return page.evaluate(() => (window as any).__larariumDebug?.openPhase ?? "unknown");
}

async function getConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on("console", msg => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

// ---------------------------------------------------------------------------
// Boot smoke
// ---------------------------------------------------------------------------

test.describe("Boot + Meta", () => {
  test("page loads and serves HTML shell", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    const html = await page.content();
    expect(html).toContain("lararium");
  });

  test("lararium-receipt meta tag is present and non-empty", async ({ page }) => {
    await page.goto("/");
    const content = await page.$eval(
      'meta[name="lararium-receipt"]',
      (el) => el.getAttribute("content") ?? ""
    ).catch(() => "MISSING");
    expect(content).not.toBe("MISSING");
    expect(content.length).toBeGreaterThan(10);
  });

  test("reaches live phase within 20s", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });

    await page.goto("/");
    await waitForLive(page);
    const phase = await getPhase(page);

    console.log(`[smoke] openPhase: ${phase}`);
    console.log(`[smoke] console errors: ${errors.length ? errors.join("\n  ") : "none"}`);

    expect(phase).toBe("live");
  });

  test("no Unknown switch case or Empty text node errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });

    await page.goto("/");
    await waitForLive(page);
    await page.waitForTimeout(2000); // let any deferred renders settle

    const badErrors = errors.filter(e =>
      e.includes("Unknown switch case") ||
      e.includes("Empty text node") ||
      e.includes("Cannot read properties of undefined") ||
      e.includes("is not a function")
    );
    if (badErrors.length) console.log("[smoke] bad errors:\n  " + badErrors.join("\n  "));
    expect(badErrors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// BootSplash
// ---------------------------------------------------------------------------

test.describe("BootSplash", () => {
  test("BootSplash disappears after live phase", async ({ page }) => {
    await page.goto("/");
    await waitForLive(page);
    await page.waitForTimeout(500);

    const splash = await page.$(".lar-boot-splash, [data-testid='boot-splash']");
    if (splash) {
      const visible = await splash.isVisible();
      expect(visible).toBe(false);
    }
    // If no splash element at all, that's fine — it unmounts on live
  });
});

// ---------------------------------------------------------------------------
// TW5 Panel
// ---------------------------------------------------------------------------

test.describe("TW5 Panel", () => {
  test("TW5 panel mounts and renders at least one tiddler", async ({ page }) => {
    await page.goto("/");
    await waitForLive(page);
    await page.waitForTimeout(1000);

    // Look for TW5 story river or panel container
    const storyRiver = await page.$(".tc-story-river, .tc-tiddler-frame, [class*='tw5']");
    console.log(`[smoke] TW5 story river found: ${!!storyRiver}`);
    // Report rather than hard-fail — useful for discovery
  });

  test("lar: tiddler opens with Metadata tab visible", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", msg => { if (msg.type() === "error") errors.push(msg.text()); });

    await page.goto("/");
    await waitForLive(page);
    await page.waitForTimeout(1000);

    // Navigate to a known lar: tiddler via URL hash — triggers iam-startup-action
    await page.goto("/#lar:///ha.ka.ba/api/v0.1/pono/meme");
    await page.waitForTimeout(2000);

    const phase = await getPhase(page);
    console.log(`[smoke] phase after lar: navigation: ${phase}`);
    console.log(`[smoke] errors: ${errors.join(" | ") || "none"}`);

    // Check if TW5 opened the tiddler
    const bodyText = await page.textContent("body");
    const hasMeme = bodyText?.includes("meme") || bodyText?.includes("lar:");
    console.log(`[smoke] page body contains meme content: ${hasMeme}`);
  });

  test("iam-panel procedure renders stat bars for lar: tiddler", async ({ page }) => {
    await page.goto("/");
    await waitForLive(page);
    await page.waitForTimeout(1500);

    // Look for stat bar elements from the iam-panel template
    const statRows = await page.$$(".lar-stat-row, .lar-stat-block, .lar-iam-panel");
    console.log(`[smoke] iam-panel stat elements found: ${statRows.length}`);

    const details = await page.$$("details.lar-iam-details");
    console.log(`[smoke] disclosure <details> elements found: ${details.length}`);
  });
});

// ---------------------------------------------------------------------------
// Canvas / tldraw
// ---------------------------------------------------------------------------

test.describe("Canvas", () => {
  test("tldraw canvas mounts", async ({ page }) => {
    await page.goto("/");
    await waitForLive(page);
    await page.waitForTimeout(1500);

    const canvas = await page.$("canvas, .tl-canvas, [data-testid='canvas']");
    console.log(`[smoke] tldraw canvas element found: ${!!canvas}`);
  });

  test("canvas has shapes after corpus load", async ({ page }) => {
    await page.goto("/");
    await waitForLive(page);
    await page.waitForTimeout(2000);

    const shapeCount = await page.evaluate(() => {
      const debug = (window as any).__larariumDebug;
      return debug?.shapeCount ?? debug?.editor?.getCurrentPageShapes?.()?.length ?? "unavailable";
    });
    console.log(`[smoke] canvas shape count: ${shapeCount}`);
  });
});

// ---------------------------------------------------------------------------
// LarariumPanel
// ---------------------------------------------------------------------------

test.describe("LarariumPanel", () => {
  test("clicking a canvas shape or lar: link opens LarariumPanel", async ({ page }) => {
    await page.goto("/");
    await waitForLive(page);
    await page.waitForTimeout(1500);

    // Try clicking the first tldraw shape
    const shape = await page.$(".tl-shape, [data-shape-id]");
    if (shape) {
      await shape.click();
      await page.waitForTimeout(800);
    }

    const panel = await page.$(".lar-panel, [data-testid='lar-panel'], .LarariumPanel");
    console.log(`[smoke] LarariumPanel found after click: ${!!panel}`);
  });
});

// ---------------------------------------------------------------------------
// Fragment routing
// ---------------------------------------------------------------------------

test.describe("Fragment routing", () => {
  test("lar:///...#iam fragment opens parent with Metadata tab", async ({ page }) => {
    await page.goto("/");
    await waitForLive(page);

    // Navigate to a tiddler with #iam fragment
    await page.goto("/#lar:///ha.ka.ba/api/v0.1/pono/meme#iam");
    await page.waitForTimeout(2000);

    const tabState = await page.evaluate(() => {
      const tw = (window as any).__larariumDebug?.tw5?._tw;
      if (!tw) return "no tw5";
      const title = tw.wiki.filterTiddlers("[[$:/state/tab/view-1-lar:///ha.ka.ba/api/v0.1/pono/meme]]")[0];
      return tw.wiki.getTiddler(title)?.fields?.text ?? "no tab state";
    });
    console.log(`[smoke] tab state after #iam fragment: ${tabState}`);
  });
});

// ---------------------------------------------------------------------------
// Automerge sync
// ---------------------------------------------------------------------------

test.describe("Automerge sync", () => {
  test("meme-sync WebSocket connects", async ({ page }) => {
    const wsMessages: string[] = [];
    page.on("websocket", ws => {
      console.log(`[smoke] WS opened: ${ws.url()}`);
      ws.on("framereceived", f => wsMessages.push(String(f.payload).slice(0, 80)));
    });

    await page.goto("/");
    await waitForLive(page);
    await page.waitForTimeout(1000);

    console.log(`[smoke] WS frames received: ${wsMessages.length}`);
    expect(wsMessages.length).toBeGreaterThan(0);
  });
});
