/**
 * ceremony — the clean ceremony document's script (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-ceremony; the
 * operator's ruling, 2026-11-05: "Approve").
 *
 * Same origin, no mirror, no plugins, a strict policy (`ceremony.html`). It paints only the ask the vessel sends down its
 * brokered port (the public label and digest, the face, the kind), takes the secret, and sends its bytes down that port to
 * the vessel worker. The surface page never holds them: the page opened this window with no opener, and the port reached
 * this document through the service worker.
 */
import type { BrokerToCeremony, CeremonyAsk, CeremonyToBroker, VesselToCeremony } from "../ceremony-protocol.js";
import { askIdOf, ceremonyRefusal, evalRuns, sendDecline, sendPasskey, sendPassphrase } from "./ceremony-core.js";

const $ = (id: string): HTMLElement => document.getElementById(id)!;

function refuse(refusal: string): void {
  document.body.dataset["refusal"] = refusal;
  $("ceremony-state").textContent = `This ceremony refuses: ${refusal}. Nothing was asked, and no form stands.`;
  $("ceremony-form").hidden = true;
}

function done(words: string): void {
  document.body.dataset["settled"] = "true";
  $("ceremony-state").textContent = words;
  $("ceremony-form").hidden = true;
  window.close();
}

function paint(ask: CeremonyAsk, port: MessagePort): void {
  const form = $("ceremony-form") as HTMLFormElement;
  form.dataset["kind"] = ask.kind;
  $("ceremony-label").textContent =
    ask.kind === "unlock" ? `Unlock this browser's vessel (${ask.act})${ask.words ? ` — ${ask.words}` : ""}`
      : ask.kind === "bind-first" ? "Bind a passphrase to this browser before it holds a face's secrets. Keep it: nothing here recovers it."
        : ask.kind === "ward" ? `Enter this face's passphrase for one ward act (${ask.act}).`
          : "Enter this browser's passphrase to clear it. Its secrets will then rest in the clear in this browser's storage.";
  $("ceremony-face").textContent = ask.face ?? "this browser";
  $("ceremony-digest").textContent = ask.digest;
  const pass = $("ceremony-pass") as HTMLInputElement;
  const again = $("ceremony-again") as HTMLInputElement;
  pass.autocomplete = ask.kind === "bind-first" ? "new-password" : "current-password";
  again.required = ask.kind === "bind-first";
  again.hidden = ask.kind !== "bind-first";
  const passkey = $("ceremony-passkey") as HTMLButtonElement;
  passkey.hidden = !(ask.routes.includes("passkey") && typeof PublicKeyCredential === "function");
  form.hidden = false;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (ask.kind === "bind-first" && again.value !== pass.value) {
      again.value = "";
      $("ceremony-state").textContent = "The two passphrases differ; type them again.";
      return;
    }
    if (pass.value.length === 0) return;
    sendPassphrase(port, ask.askId, [pass, again]);
    $("ceremony-state").textContent = "Sent to the vessel.";
  });
  $("ceremony-decline").addEventListener("click", () => { pass.value = ""; again.value = ""; sendDecline(port, ask.askId); });
  passkey.addEventListener("click", () => {
    void sendPasskey(port, ask.askId, ask.passkeys, navigator.credentials).catch((err: unknown) => {
      $("ceremony-state").textContent = `The passkey answered nothing (${err instanceof Error ? err.message : String(err)}); the passphrase still opens.`;
    });
  });
  pass.focus();
}

async function stand(): Promise<void> {
  const refusal = ceremonyRefusal({
    isSecureContext: window.isSecureContext,
    framed: window.top !== window.self,
    hasServiceWorker: "serviceWorker" in navigator,
    evalRuns: evalRuns(),
  });
  if (refusal) { refuse(refusal); return; }
  const askId = askIdOf(location.hash);
  if (!askId) { refuse("ceremony-ask-absent"); return; }
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) { refuse("ceremony-broker-absent"); return; }
  const broker = registration.active ?? (await navigator.serviceWorker.ready).active;
  if (!broker) { refuse("ceremony-broker-absent"); return; }
  navigator.serviceWorker.onmessage = (e: MessageEvent) => {
    const msg = e.data as BrokerToCeremony | null;
    if (!msg || msg.askId !== askId) return;
    if (msg.t === "ceremony:absent" || !e.ports[0]) { refuse("ceremony-ask-unbrokered"); return; }
    const port = e.ports[0];
    port.onmessage = (m: MessageEvent) => {
      const from = m.data as VesselToCeremony | null;
      if (!from || from.askId !== askId) { refuse("ceremony-ask-mismatch"); return; }
      if (from.t === "ask") paint(from, port);
      else if (from.t === "settled") done("The vessel took the answer. This window closes.");
      else refuse(from.refusal);
    };
  };
  broker.postMessage({ t: "ceremony:claim", askId } satisfies CeremonyToBroker);
}

void stand().catch((err: unknown) => refuse(`ceremony-failed (${err instanceof Error ? err.message : String(err)})`));
