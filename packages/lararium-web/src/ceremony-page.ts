/**
 * ceremony-page — the surface page's part in the unlock ceremony (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-ceremony).
 *
 * The page paints no secret form. It registers the broker (the service worker) at the floor, with no secret held; on the
 * vessel's ask it paints the ask's public words and one button. The button mints a fresh MessageChannel, transfers one end
 * to the vessel worker and the other to the broker, and opens the ceremony document as a window with no opener, so the page
 * holds no handle to the window and no end of the channel. A page that cannot stand the broker names its refusal to the
 * vessel and never falls back to a form of its own.
 */
import { CEREMONY_BROKER_PATH, CEREMONY_DOCUMENT_PATH, type CeremonyAskKind, type PageToBroker } from "./ceremony-protocol.js";

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

/** The ask's public words as the page holds them. */
export interface PageAsk { readonly askId: string; readonly kind: CeremonyAskKind; readonly act: string; readonly words: string }

/** What an ask's notice reaches: the broker as it stands, and the vessel's two answers for this ask. */
export interface AskNoticeDoors {
  readonly broker: Promise<CeremonyBroker>;
  readonly port: (port: MessagePort) => void;
  readonly refused: (refusal: string) => void;
  readonly open?: (askId: string, broker: ServiceWorker, toVessel: (port: MessagePort) => void) => void;
}

/** Each ask kind in the page's words: the label its button carries, and what the boot status row says the vessel waits on. */
const ASK_WORDS: Record<CeremonyAskKind, { readonly open: string; readonly waits: string }> = {
  "unlock": { open: "open the unlock ceremony", waits: "this browser's unlock" },
  "bind-first": { open: "open the first passphrase ceremony", waits: "a first passphrase" },
  "clear": { open: "open the custody clear ceremony", waits: "the passphrase that clears this browser's custody" },
  "ward": { open: "open the ward act ceremony", waits: "this face's passphrase for one ward act" },
  "card": { open: "open the place card ceremony", waits: "the place card, written down and typed back" },
};

/**
 * THE BOOT STATUS ROW SAYS WHO THE BOOT WAITS ON. While an ask stands unrefused the row names it; a second ask re-words the row;
 * the last settle hands the row back as it read before. The row carries the `ask` class and never `warn` or `err` (a harness
 * reads those as a verdict), and a verdict another hand wrote stays as written. A live page holds no such row: nothing moves.
 */
function wordBootStatus(doc: Document): void {
  const status = doc.getElementById("status");
  if (!status) return;
  const ours = status.dataset["larWaits"];
  if (ours !== undefined && status.textContent !== ours) { delete status.dataset["larWaits"]; delete status.dataset["larBefore"]; return; }
  const pending = doc.querySelector<HTMLElement>(".ceremony-ask:not([data-refusal])");
  if (pending) {
    if (ours === undefined) {
      if (["warn", "err", "ok"].some((verdict) => status.classList.contains(verdict))) return;
      status.dataset["larBefore"] = status.textContent ?? "";
    }
    const words = ASK_WORDS[pending.dataset["ask"] as CeremonyAskKind];
    const text = `waiting on you: the vessel asks for ${words.waits}. The button at the top of this page opens its ceremony.`;
    status.textContent = text; status.className = "v ask"; status.dataset["larWaits"] = text;
  } else if (ours !== undefined) {
    status.textContent = status.dataset["larBefore"] ?? ""; status.className = "v";
    delete status.dataset["larWaits"]; delete status.dataset["larBefore"];
  }
}

/**
 * Paint one ask at the top of the page: its public words and one button that opens the ceremony document. The button names its
 * own ask, so a second ask in one boot reads as another ask, and the boot status row says the vessel waits on the person.
 */
export function paintCeremonyAsk(doc: Document, ask: PageAsk, doors: AskNoticeDoors): void {
  const notice = doc.createElement("div");
  notice.className = "ceremony-ask";
  notice.setAttribute("role", "alert");
  notice.dataset["ask"] = ask.kind;
  notice.dataset["askId"] = ask.askId;
  const say = doc.createElement("div");
  say.textContent =
    ask.kind === "unlock" ? `This browser's vessel asks for its unlock (${ask.act}${ask.words ? `, ${ask.words}` : ""}).`
      : ask.kind === "bind-first" ? "This browser's vessel asks for a first passphrase before it holds a face's secrets."
        : ask.kind === "ward" ? `This face asks for its passphrase for one ward act (${ask.act}).`
          : ask.kind === "card" ? "This browser founds its place: the ceremony shows its place card to write on paper and type back. Nothing is written until it reads back."
          : "This browser's vessel asks for its passphrase to clear its custody.";
  const go = doc.createElement("button");
  go.type = "button"; go.className = "ceremony-open"; go.textContent = ASK_WORDS[ask.kind].open;
  const refuse = (refusal: string): void => {
    doors.refused(refusal);
    notice.dataset["refusal"] = refusal;
    say.textContent = `The unlock ceremony cannot stand here: ${refusal}.`;
    go.remove();
    wordBootStatus(doc);
  };
  go.addEventListener("click", () => {
    void doors.broker.then((broker) => {
      if ("refusal" in broker) { refuse(broker.refusal); return; }
      (doors.open ?? openCeremony)(ask.askId, broker.worker, doors.port);
      go.textContent = "the ceremony stands in its own window";
    });
  });
  notice.append(say, go);
  doc.body.prepend(notice);
  wordBootStatus(doc);
  // A page that stands no broker refuses at once, by name, and offers no form of its own.
  void doors.broker.then((broker) => { if ("refusal" in broker) refuse(broker.refusal); });
}

/** The vessel settled an ask: its notice leaves the page. */
export function settleCeremonyAsk(doc: Document, askId: string): void {
  for (const notice of doc.querySelectorAll<HTMLElement>(".ceremony-ask")) if (notice.dataset["askId"] === askId) notice.remove();
  wordBootStatus(doc);
}
