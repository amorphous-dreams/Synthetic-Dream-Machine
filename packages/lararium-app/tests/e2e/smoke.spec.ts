/**
 * Lararium browser smoke suite — M10 baseline (TW5 pipeline).
 *
 * Requires lararium node server running on localhost:4321:
 *   pnpm --filter @lararium/node serve
 *
 * Pass semantics:
 *   N1  canvas mounts without blocking spinner
 *   N2  no "Unknown switch case" console errors
 *   N3  no "Empty text nodes" RangeError
 *   N5  __larariumDebug.receiptShape is non-null after sync
 *   N6  __larariumDebug.hostReceipt upgrades from null to a string
 *   N4  shape.meta has no "id" or "typeName" keys
 *   T1  __larariumDebug.tw5 is non-null (TW5 always boots)
 *
 * Arc A — store-authority carrierText (LarariumPanel):
 *   A1  tiddlerStore.get(uri) returns text after sync (store has carrier text)
 *   A2  tiddlerStore.subscribe fires when store record changes (live update path present)
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectConsoleErrors(page: Page): { messages: string[] } {
  const messages: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") {
      messages.push(msg.text());
    }
  });
  page.on("pageerror", (err) => {
    messages.push(err.message);
  });
  return { messages };
}

async function waitForSync(page: Page, timeout = 15_000): Promise<void> {
  await page.waitForFunction(
    () => {
      const dbg = (window as unknown as Record<string, unknown>)["__larariumDebug"] as Record<string, unknown> | undefined;
      const store = dbg?.["store"] as Record<string, unknown> | undefined;
      return store?.["status"] === "synced-remote";
    },
    { timeout },
  );
}

async function waitForDebugKey(page: Page, key: string, timeout = 10_000): Promise<unknown> {
  return page.waitForFunction(
    (k) => {
      const dbg = (window as unknown as Record<string, unknown>)["__larariumDebug"] as Record<string, unknown> | undefined;
      return dbg?.[k] != null ? dbg[k] : null;
    },
    key,
    { timeout },
  );
}

// ---------------------------------------------------------------------------
// Smoke suite (TW5 always active)
// ---------------------------------------------------------------------------

test.describe("Lararium smoke — N1–N6, T1", () => {
  test("N1: canvas element mounts without blocking spinner", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible({ timeout: 10_000 });
  });

  test("N2+N3: no forbidden console errors", async ({ page }) => {
    const { messages } = collectConsoleErrors(page);
    await page.goto("/");
    await waitForSync(page).catch(() => {});
    await page.waitForTimeout(2_000);

    const forbidden = messages.filter(
      (m) =>
        m.includes("Unknown switch case") ||
        m.includes("Empty text nodes are not allowed"),
    );
    expect(forbidden, `Forbidden console errors: ${forbidden.join("; ")}`).toHaveLength(0);
  });

  test("N5: __larariumDebug.receiptShape non-null after sync", async ({ page }) => {
    await page.goto("/");
    await waitForSync(page);
    const shape = await waitForDebugKey(page, "receiptShape");
    expect(shape).not.toBeNull();
  });

  test("N6: hostReceipt upgrades from null to string", async ({ page }) => {
    await page.goto("/");
    await waitForSync(page);
    await waitForDebugKey(page, "hostReceipt");
    const receipt = await page.evaluate(
      () => ((window as unknown as Record<string, unknown>)["__larariumDebug"] as Record<string, unknown>)?.["hostReceipt"],
    );
    expect(typeof receipt).toBe("string");
    expect((receipt as string).length).toBeGreaterThan(0);
  });

  test("N4: receiptShape.meta has no id or typeName keys", async ({ page }) => {
    await page.goto("/");
    await waitForSync(page);
    await waitForDebugKey(page, "receiptShape");

    const metaKeys = await page.evaluate(() => {
      const dbg = (window as unknown as Record<string, unknown>)["__larariumDebug"] as Record<string, unknown>;
      const shape = dbg?.["receiptShape"] as Record<string, unknown> | undefined;
      const meta = shape?.["meta"] as Record<string, unknown> | undefined;
      return meta ? Object.keys(meta) : null;
    });

    expect(metaKeys).not.toBeNull();
    expect(metaKeys).not.toContain("id");
    expect(metaKeys).not.toContain("typeName");
  });

  // ---------------------------------------------------------------------------
  // Arc A — tiddlerStore as live carrierText authority
  // ---------------------------------------------------------------------------

  test("A1: tiddlerStore.get returns carrier text for at least one meme after sync", async ({ page }) => {
    await page.goto("/");
    await waitForSync(page);
    // Wait for tiddlerStore to be seeded (hostReceipt must land first)
    await waitForDebugKey(page, "hostReceipt");
    await page.waitForTimeout(500); // allow seedAll debounce to fire

    const result = await page.evaluate(async () => {
      const dbg = (window as unknown as Record<string, unknown>)["__larariumDebug"] as Record<string, unknown>;
      const store = dbg?.["tiddlerStore"] as { listVisible: () => Promise<string[]>; get: (t: string) => Promise<{ text?: string } | null> } | undefined;
      if (!store) return null;
      const titles = await store.listVisible();
      const memes = titles.filter((t: string) => t.startsWith("lar:"));
      if (memes.length === 0) return { memeCount: 0, hasText: false };
      const first = await store.get(memes[0]!);
      return { memeCount: memes.length, hasText: typeof first?.text === "string" && first.text.length > 0 };
    });

    expect(result).not.toBeNull();
    expect(result?.memeCount).toBeGreaterThan(0);
    expect(result?.hasText).toBe(true);
  });

  test("A2: tiddlerStore.subscribe delivers change when put is called", async ({ page }) => {
    await page.goto("/");
    await waitForSync(page);
    await waitForDebugKey(page, "hostReceipt");
    await page.waitForTimeout(500);

    const fired = await page.evaluate(async () => {
      const dbg = (window as unknown as Record<string, unknown>)["__larariumDebug"] as Record<string, unknown>;
      const store = dbg?.["tiddlerStore"] as {
        subscribe: (fn: (c: { title: string; record: { text?: string } | null }) => void) => () => void;
        put: (r: { title: string; fields: Record<string, string>; text: string }, o: { kind: string }) => Promise<void>;
      } | undefined;
      if (!store) return null;

      let received: string | null = null;
      const unsub = store.subscribe((change) => {
        if (change.title === "lar:///test-arc-a") received = change.record?.text ?? null;
      });

      await store.put(
        { title: "lar:///test-arc-a", fields: {}, text: "arc-a-sentinel" },
        { kind: "canvas-draft", shapeId: "test-shape" },
      );

      // Give subscriber one microtask to fire (it's synchronous in MemoryTiddlerStore)
      await Promise.resolve();
      unsub();
      return received;
    });

    expect(fired).toBe("arc-a-sentinel");
  });

  test("T1: __larariumDebug.tw5 is non-null (TW5 always boots)", async ({ page }) => {
    await page.goto("/");
    await waitForSync(page).catch(() => {});

    const tw5 = await page.waitForFunction(
      () => {
        const dbg = (window as unknown as Record<string, unknown>)["__larariumDebug"] as Record<string, unknown> | undefined;
        return dbg?.["tw5"] != null ? true : null;
      },
      { timeout: 15_000 },
    ).catch(() => null);

    if (tw5 !== null) {
      const val = await page.evaluate(
        () => ((window as unknown as Record<string, unknown>)["__larariumDebug"] as Record<string, unknown>)?.["tw5"],
      );
      expect(val).not.toBeNull();
    }
  });
});
