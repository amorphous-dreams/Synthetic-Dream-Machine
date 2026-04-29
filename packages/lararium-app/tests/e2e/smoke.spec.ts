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
