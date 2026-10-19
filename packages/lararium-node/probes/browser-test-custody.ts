/**
 * browser-test-custody — a TEST HARNESS door: a harness's browser answers the web surface's custody form with the
 * PUBLISHED test route, the way a person would type a passphrase into it.
 *
 * The product has no such door. The page asks its person through an in-page form (`lararium-web` `askCustody`), and
 * no flag, env var, URL or tiddler carries a credential into it. A harness that drives the page as a person does
 * types the published test passphrase (`tools/test-custody-route.mjs`) into that same form, and nothing else.
 *
 * THE SCRATCH MARK. The node door acts only on a root a harness staged (`.lar-test-scratch`). The browser twin acts
 * only on a page a harness itself serves on the loopback, in a browser the harness launched: it answers a form only
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
 * Arm `target` (a context, or one page) so every custody form any of its pages raises gets the test route.
 * Call before the first `goto`: the watch rides an init script, so a reload or a second tab stays armed.
 */
export async function armTestCustody(target: BrowserContext | Page, label: string): Promise<void> {
  await target.exposeBinding("__larTestCustodyAsked", async ({ page }: { page: Page }, kind: unknown) => {
    const url = new URL(page.url());
    if (!LOOPBACK.has(url.hostname)) {
      const refusal = new TestDoorRefusal(`TestDoorRefusal: ${url.origin} is no harness's loopback origin — the browser test door answers a custody form only on a page the harness serves itself`);
      console.error(`[test-custody:${label}] ${refusal.message}`);
      throw refusal;
    }
    console.log(`[test-custody:${label}] ⚠ the custody form asked (${String(kind)}); answering with the PUBLISHED TEST ROUTE — a harness door, never a person's passphrase`);
    const form = page.locator("form.custody-ask").first();
    for (const field of await form.locator('input[type="password"]').all()) await field.fill(TEST_PASSPHRASE);
    await form.locator('button[type="submit"]').click();
  });
  await target.addInitScript(() => {
    const seen = new WeakSet<Element>();
    const look = (): void => {
      const form = document.querySelector("form.custody-ask");
      if (!form || seen.has(form)) return;
      seen.add(form);
      const call = (globalThis as unknown as { __larTestCustodyAsked?: (kind: string) => Promise<void> }).__larTestCustodyAsked;
      void call?.((form as HTMLElement).dataset["ask"] ?? "unnamed");
    };
    new MutationObserver(look).observe(document, { childList: true, subtree: true });
  });
}
