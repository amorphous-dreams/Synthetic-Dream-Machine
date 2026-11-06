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
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import { expect, test } from "vitest";
import { standCeremonyBroker } from "../src/ceremony-page.js";

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
