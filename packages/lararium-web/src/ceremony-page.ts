/**
 * ceremony-page — the surface page's part in the unlock ceremony (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-ceremony).
 *
 * The page paints no secret form. It registers the broker (the service worker) at the floor, with no secret held; on the
 * vessel's ask it paints the ask's public words and one button. The button mints a fresh MessageChannel, transfers one end
 * to the vessel worker and the other to the broker, and opens the ceremony document as a window with no opener, so the page
 * holds no handle to the window and no end of the channel. A page that cannot stand the broker names its refusal to the
 * vessel and never falls back to a form of its own.
 */
import { CEREMONY_BROKER_PATH, CEREMONY_DOCUMENT_PATH, type PageToBroker } from "./ceremony-protocol.js";

export interface PageCeremonyEnv { readonly isSecureContext: boolean; readonly hasServiceWorker: boolean }

/** The refusal a page stands under before it may open a ceremony, or null. */
export function pageCeremonyRefusal(env: PageCeremonyEnv): string | null {
  if (!env.isSecureContext) return "ceremony-needs-secure-context";
  if (!env.hasServiceWorker) return "ceremony-broker-absent";
  return null;
}

/** The broker as it stands: its active worker, or the refusal that keeps it down. */
export type CeremonyBroker = { readonly worker: ServiceWorker } | { readonly refusal: string };

/** Register the broker and wait for control: on first load it can activate before claiming the page, while matchAll reads controlled windows alone. */
export async function standCeremonyBroker(env: { readonly isSecureContext: boolean; readonly container: ServiceWorkerContainer | null } = {
  isSecureContext: window.isSecureContext, container: "serviceWorker" in navigator ? navigator.serviceWorker : null,
}): Promise<CeremonyBroker> {
  const { container } = env;
  const refusal = pageCeremonyRefusal({ isSecureContext: env.isSecureContext, hasServiceWorker: container !== null });
  if (refusal || !container) return { refusal: refusal ?? "ceremony-broker-absent" };
  try {
    await container.register(CEREMONY_BROKER_PATH, { scope: "/", type: "classic" });
    if (container.controller) return { worker: container.controller };
    return await new Promise<CeremonyBroker>((resolve) => {
      const changed = (): void => {
        if (!container.controller) return;
        container.removeEventListener("controllerchange", changed);
        resolve({ worker: container.controller });
      };
      container.addEventListener("controllerchange", changed);
      changed();
    });
  } catch {
    return { refusal: "ceremony-broker-absent" };
  }
}

/**
 * Open the ceremony for one ask: one channel end to the vessel (`toVessel`, transferred), the other to the broker, and the
 * ceremony document in a window with no opener.
 */
export function openCeremony(askId: string, broker: ServiceWorker, toVessel: (port: MessagePort) => void,
  open: (url: string, target: string, features: string) => unknown = (u, t, f) => window.open(u, t, f)): void {
  const channel = new MessageChannel();
  toVessel(channel.port1);
  broker.postMessage({ t: "ceremony:offer", askId } satisfies PageToBroker, [channel.port2]);
  // `noopener`: the platform answers null and the ceremony's window carries no opener, so neither side scripts the other.
  open(`${CEREMONY_DOCUMENT_PATH}#ask=${encodeURIComponent(askId)}`, "_blank", "noopener");
}
