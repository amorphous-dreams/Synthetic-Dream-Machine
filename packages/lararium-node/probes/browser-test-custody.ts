/**
 * browser-test-custody — a TEST HARNESS door: a harness's browser answers the unlock ceremony with the PUBLISHED test
 * route, the way a person would type a passphrase into it.
 *
 * The product has no such door. The surface page paints an ask's public words and one button; the button opens the clean
 * ceremony document (`lararium-web` `ceremony.html`) in its own window, and only that document takes the secret. No flag,
 * env var, URL or tiddler carries a credential into it. A harness that drives the page as a person does presses the
 * page's button, then types the published test passphrase (`tools/test-custody-route.mjs`) into the ceremony document's
 * form, and nothing else.
 *
 * THE SCRATCH MARK. The node door acts only on a root a harness staged (`.lar-test-scratch`). The browser twin acts
 * only on a page a harness itself serves on the loopback, in a browser the harness launched: it answers a ceremony only
 * on an origin whose host reads `localhost`, `127.0.0.1` or `[::1]`, refuses by name (TestDoorRefusal) on any other,
 * and prints one loud line for every answer it gives, so a log never hides that a test route opened a vessel.
 *
 * Meme: lar:///ha.ka.ba/lararium/browser/browser-custody
 */
import type { BrowserContext, Page } from "playwright";

/** The published test route (`tools/test-custody-route.mjs` holds the same bytes; a tools test reads both). */
export const TEST_PASSPHRASE = "test-founding-passphrase";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** A page this door will not answer: its origin is no harness's own loopback. */
export class TestDoorRefusal extends Error {
  override readonly name = "TestDoorRefusal";
}

/**
 * Arm `target` (a context, or one page) so every ask any of its pages raises gets the test route through the ceremony.
 * Call before the first `goto`: the watch rides an init script, so a reload or a second tab stays armed.
 */
export async function armTestCustody(target: BrowserContext | Page, label: string): Promise<void> {
  const context: BrowserContext = "context" in target && typeof target.context === "function" ? (target as Page).context() : target as BrowserContext;
  const loopbackOrRefuse = (where: string): void => {
    const url = new URL(where);
    if (LOOPBACK.has(url.hostname)) return;
    const refusal = new TestDoorRefusal(`TestDoorRefusal: ${url.origin} is no harness's loopback origin — the browser test door answers a ceremony only on a page the harness serves itself`);
    console.error(`[test-custody:${label}] ${refusal.message}`);
    throw refusal;
  };
  await target.exposeBinding("__larTestCustodyAsked", async ({ page }: { page: Page }, kind: unknown, askId: unknown) => {
    loopbackOrRefuse(page.url());
    console.log(`[test-custody:${label}] ⚠ the vessel asked (${String(kind)}); answering through the ceremony with the PUBLISHED TEST ROUTE — a harness door, never a person's passphrase`);
    const id = String(askId);
    // The ceremony opens with no opener, so it reads as a new page of the context; its navigation names the ask.
    const opened = context.waitForEvent("page", {
      timeout: 60_000,
      predicate: async (p: Page) => { await p.waitForURL((u) => u.pathname === "/ceremony.html", { timeout: 30_000 }).catch(() => undefined); return p.url().includes(id); },
    });
    await page.locator(`.ceremony-ask[data-ask-id="${id}"] button.ceremony-open`).click();
    const ceremony = await opened;
    loopbackOrRefuse(ceremony.url());
    const form = ceremony.locator("#ceremony-form");
    await form.waitFor({ state: "visible", timeout: 30_000 });
    for (const field of await form.locator('input[type="password"]:visible').all()) await field.fill(TEST_PASSPHRASE);
    await form.locator('button[type="submit"]').click();
  });
  await target.addInitScript(() => {
    const seen = new WeakSet<Element>();
    const look = (): void => {
      for (const notice of document.querySelectorAll<HTMLElement>(".ceremony-ask")) {
        if (seen.has(notice) || notice.dataset["refusal"]) continue;
        seen.add(notice);
        const call = (globalThis as unknown as { __larTestCustodyAsked?: (kind: string, askId: string) => Promise<void> }).__larTestCustodyAsked;
        void call?.(notice.dataset["ask"] ?? "unnamed", notice.dataset["askId"] ?? "");
      }
    };
    new MutationObserver(look).observe(document, { childList: true, subtree: true });
  });
}
