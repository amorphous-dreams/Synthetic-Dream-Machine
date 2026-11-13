/**
 * ceremony — the clean ceremony document's script (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-ceremony; the
 * operator's ruling, 2026-11-05: "Approve").
 *
 * Same origin, no mirror, no plugins, a strict policy (`ceremony.html`). It paints only the ask the vessel sends down its
 * brokered port (the public label and digest, the face, the kind), takes the secret, and sends its bytes down that port to
 * the vessel worker. The surface page never holds them: the page opened this window with no opener, and the port reached
 * this document through the service worker.
 *
 * A RESET ASK (`#reset=<askId>`, browser-vessel-lift#/the-reset) stands here too, and it takes no secret and no port: this
 * document takes one typed confirmation and burns the place itself (`reset-core.ts`). The navigation alone stands no reset:
 * the id must name an ask a page of this origin recorded and that still stands, or the document refuses `reset-unasked` and
 * paints no form.
 */
import { RESET_CHANNEL, type BrokerToCeremony, type CeremonyAsk, type CeremonyToBroker, type ResetSignal, type VesselToCeremony } from "../ceremony-protocol.js";
import { askIdOf, ceremonyRefusal, evalRuns, resetAskOf, sendDecline, sendPasskey, sendPassphrase } from "./ceremony-core.js";
import { ambientResetEnv, burnPlace, forgetResetAsk, originAskRecord, RESET_PHRASE, resetAskStands, ResetRefused, resetRefusal, typedConfirms } from "./reset-core.js";

const $ = (id: string): HTMLElement => document.getElementById(id)!;

function refuse(refusal: string): void {
  document.body.dataset["refusal"] = refusal;
  $("ceremony-state").textContent = `This ceremony refuses: ${refusal}. Nothing was asked, and no form stands.`;
  $("ceremony-form").hidden = true;
}

/** The card leaves the document as the ask settles: no code row stays painted. */
function unpaintCard(): void {
  const card = document.getElementById("ceremony-card");
  if (card) { card.textContent = ""; card.hidden = true; }
}

function done(words: string): void {
  unpaintCard();
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
        : ask.kind === "ward" ? ask.words || `Enter this face's passphrase for one ward act (${ask.act}).`
          : ask.kind === "card" ? ask.words
          : "Enter this browser's passphrase to clear it. Its secrets will then rest in the clear in this browser's storage.";
  $("ceremony-face").textContent = ask.face ?? "this browser";
  $("ceremony-digest").textContent = ask.digest;
  // A CARD ASK paints its card for the person to copy onto paper; the typed code rows answer it. No other ask paints one.
  const card = $("ceremony-card");
  card.textContent = ask.kind === "card" ? (ask.card ?? []).join("\n") : "";
  card.hidden = ask.kind !== "card";
  const pass = $("ceremony-pass") as HTMLInputElement;
  const again = $("ceremony-again") as HTMLInputElement;
  pass.autocomplete = ask.kind === "bind-first" ? "new-password" : ask.kind === "card" ? "off" : "current-password";
  pass.placeholder = ask.kind === "card" ? "the three code rows" : "";
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
    unpaintCard();
    $("ceremony-state").textContent = "Sent to the vessel.";
  });
  $("ceremony-decline").addEventListener("click", () => { pass.value = ""; again.value = ""; unpaintCard(); sendDecline(port, ask.askId); });
  passkey.addEventListener("click", () => {
    void sendPasskey(port, ask.askId, ask.passkeys, navigator.credentials).catch((err: unknown) => {
      $("ceremony-state").textContent = `The passkey answered nothing (${err instanceof Error ? err.message : String(err)}); the passphrase still opens.`;
    });
  });
  pass.focus();
}

/**
 * THE RESET CEREMONY (`reset-core.ts`): this document, standing clean, takes one typed confirmation and burns the place
 * itself. No vessel answers it and no port reaches it, so it stands while the vessel rests locked, half-founded or down. It
 * tells every tab of the origin to stand down first, names any tab that still holds a store, and tells them all to boot
 * afresh once the place burned. It stands only for an ask the origin's record names: a link from anywhere else carries an id
 * no page raised, and refuses `reset-unasked` with no form painted.
 */
function standReset(askId: string): void {
  const record = originAskRecord();
  const refusal = resetRefusal({ framed: window.top !== window.self, evalRuns: evalRuns(), asked: resetAskStands(record, askId) });
  if (refusal) { refuse(refusal); return; }
  const channel = new BroadcastChannel(RESET_CHANNEL);
  const signal = (msg: ResetSignal): void => channel.postMessage(msg);
  const say = (words: string): void => { $("ceremony-state").textContent = words; };
  document.title = "Lararium — reset ceremony";
  const heading = document.querySelector("h1");
  if (heading) heading.textContent = "Lararium — reset ceremony";
  const form = $("ceremony-form") as HTMLFormElement;
  form.dataset["kind"] = "reset";
  $("ceremony-label").textContent =
    "Reset this browser's vessel to its anon floor. Every key, face, wiki and pin this browser holds for this site burns, in every tab. "
    + "A face that also lives on another vessel lives on there; a face that lives only here ends with this reset, and nothing recovers it. "
    + `To confirm, type: ${RESET_PHRASE}`;
  $("ceremony-face").textContent = "this browser";
  $("ceremony-digest").textContent = askId;
  const pass = $("ceremony-pass") as HTMLInputElement;
  pass.type = "text"; pass.autocomplete = "off"; pass.placeholder = RESET_PHRASE;
  ($("ceremony-again") as HTMLInputElement).hidden = true;
  ($("ceremony-passkey") as HTMLButtonElement).hidden = true;
  $("ceremony-go").textContent = "reset this browser's vessel";
  say("Nothing burns until the typed words read back.");
  form.hidden = false;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!typedConfirms(pass.value)) { pass.value = ""; say(`The words differ, and nothing burned. Type: ${RESET_PHRASE}`); return; }
    form.hidden = true;
    void burnPlace(ambientResetEnv(signal, say), askId).then(
      (report) => done(`This browser's vessel stands at its anon floor again (${String(report.databases.length)} store(s) burned). Every tab of this site boots afresh. This window closes.`),
      (err: unknown) => {
        // The ask left the record while this window stood (the page withdrew it, or another window settled it): nothing burned.
        if (err instanceof ResetRefused && err.refusal === "reset-unasked") { refuse(err.refusal); return; }
        form.hidden = false; say(`The reset stopped: ${err instanceof Error ? err.message : String(err)}. What burned before it stays burned; confirm again to go on.`);
      },
    );
  });
  $("ceremony-decline").addEventListener("click", () => { pass.value = ""; forgetResetAsk(record, askId); signal({ t: "reset:declined", askId }); done("Nothing burned. This window closes."); });
  pass.focus();
}

async function stand(): Promise<void> {
  // A RESET ASK names itself on the navigation and needs neither a secure context nor a broker: it stands first.
  const reset = resetAskOf(location.hash);
  if (reset) { standReset(reset); return; }
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
