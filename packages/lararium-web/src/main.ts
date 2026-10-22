/**
 * lararium-web — the Web-surface assembly.
 *
 * This package owns page composition and the visible projection edge: it resolves served Worker assets,
 * opens the browser vessel, paints returned frames, and relays named DOM events and bounded input back to
 * the worker island. It does not own TW5 state or run a second engine in the page. Direct web-surface tests
 * remain small; the browser vessel and TW5 seams carry their own focused coverage.
 */

/**
 * @lararium/web — DOM, Vite, and projection capability atoms for the Web-surface assembly.
 *
 * A sovereign causal island boots in the browser (its own key, IndexedDB, genesis
 * bytes) and — when a hearth's porch is reachable — reads the Nexus's floor off it (the node-less
 * path: an anon browser vessel consuming the read-only substrate, the elyncia.app
 * story), verifying every step here. Location-agnostic: served from localhost / LAN / elyncia.app, the vessel
 * always runs here; the origin is a static host, never an authority.
 */
import { createLoafBuffer } from "./loaf-buffer.js";
import {
  openBrowserVessel,
  parseAdmitCarriage, toAdmitCarriage,
  browserFleetJoinRequest, browserFleetJoinLand, browserFleetJoinSettle, browserFleetJoinAbandon, BrowserFleetJoinRefused,
  DAEMON_SURFACE_ID, requestDurableStorage, storageFloorReport, readBrowserSeedWrap, loadBrowserActivePersona, vesselLockName,
  standBrowserCustody, readBrowserCustody, type CustodyAsk, type CustodyAnswer, type HearthFloorRead,
} from "@lararium/browser";
import { phoneSeatExplanation, ambientPhoneSeatHost, seedRestStatus } from "./phone-seat.js";
import type { DeviceAdmitPayload } from "@lararium/keyhive";
import { LAR_WHOLE_VALUE_MAX_CHARS, didFromVerifyingKey, parseMeshPeer, readHearthFloorCard, type GenesisSeed, type MeshPeer } from "@lararium/mesh";
import { createProjectionSink } from "./projection-sink.js";
import { defaultReadFace, floorCardOf, mountLiveStatus, oracleElsewhereNote, resolveRelayUrl, sameOriginRelayUrl } from "./live-status.js";
// The materialize-fresh boot artifact: the PLAIN-DATA oracle seed (seed.json).
// The vessel materializes the oracle CRDT fresh from it under the deterministic doc id
// (node-parity). Boot imports this plain-data seed alone — no Automerge binary.
import genesisSeed from "../../../genesis/seed.json";
// `?worker&url` — Vite builds each worker shim through its worker pipeline and yields the built
// bundle's URL (a real /assets file). A standalone `new URL("./x.ts", import.meta.url)` passed
// INDIRECTLY to the vessel got inlined as a `data:` URI, where the worker's dynamic imports
// (keyhive-WASM-first, then the chain) cannot resolve — the daemon/wiki boot's silent death.
import daemonWorkerUrlStr from "./workers/daemon.worker.ts?worker&url";
import wikiWorkerUrlStr  from "./workers/wiki.worker.ts?worker&url";
import sharedHolderUrlStr from "./workers/shared-holder.worker.ts?sharedworker&url";

const daemonWorkerUrl  = new URL(daemonWorkerUrlStr, import.meta.url);
const workerScriptUrl = new URL(wikiWorkerUrlStr,  import.meta.url);
// C4's explicit diagnostic flag travels only to the daemon Worker. Ordinary
// browser boots create the exact same worker URL they carried before.
if (new URL(location.href).searchParams.get("c4trace") === "1") {
  daemonWorkerUrl.searchParams.set("c4trace", "1");
}
// THE SHARED HOLDER, OPT-IN BY URL (`?holder`): one daemon island per origin inside a SharedWorker, a port per
// tab. The holder's own URL carries the island script and the store's lock name. Absent the flag the vessel
// boots its dedicated worker exactly as before — the holder's lifetime past the last tab stays measured, not
// assumed, before it becomes the default.
const sharedHolderUrl = (() => {
  if (!new URL(location.href).searchParams.has("holder")) return undefined;
  const u = new URL(sharedHolderUrlStr, import.meta.url);
  u.searchParams.set("island", daemonWorkerUrl.href);
  u.searchParams.set("lock", vesselLockName("lares:vessel"));
  return u;
})();

const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

const VESSEL_IDB = "lares:vessel";

// Page instruments report what the browser exposes. They never decide whether a boot succeeds.
const vesselLoaf = createLoafBuffer();
const vesselLoafSupported = typeof PerformanceObserver !== "undefined"
  && PerformanceObserver.supportedEntryTypes.includes("long-animation-frame");
if (vesselLoafSupported) {
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const frame = entry as PerformanceEntry & { blockingDuration?: number };
      vesselLoaf.push({ startTime: frame.startTime, duration: frame.duration, blockingDuration: frame.blockingDuration ?? 0 });
    }
  }).observe({ type: "long-animation-frame", buffered: true });
}
let firstPaintReported = false;
let firstPaintHeap: number | null = null;
const showPageInstruments = (): void => {
  const vessel = document.getElementById("vessel");
  if (!vessel || !firstPaintReported) return;
  const show = (label: string, value: string): void => {
    const existing = [...vessel.querySelectorAll<HTMLElement>(".row")]
      .find((item) => item.querySelector(".k")?.textContent === label)?.querySelector<HTMLElement>(".v");
    if (existing) existing.textContent = value;
    else row(vessel, label, value);
  };
  show("LoAF", vesselLoafSupported ? `${vesselLoaf.observed()} observed` : "absent");
  show("heap after first paint", firstPaintHeap === null ? "absent" : `${firstPaintHeap} bytes`);
};
function reportFirstPaint(): void {
  if (firstPaintReported) return;
  firstPaintReported = true;
  requestAnimationFrame(() => {
    const heap = (performance as Performance & { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize;
    firstPaintHeap = typeof heap === "number" ? heap : null;
    const reading = {
      longAnimationFrames: vesselLoafSupported ? { supported: true, observed: vesselLoaf.observed(), entries: [...vesselLoaf.entries()] } : { supported: false, reading: "absent" },
      heapAfterFirstPaint: typeof heap === "number" ? { bytes: heap } : { reading: "absent" },
    };
    (window as Window & { __larVesselMetrics?: typeof reading }).__larVesselMetrics = reading;
    console.log("[vessel] page instruments", reading);
    showPageInstruments();
  });
}

/**
 * THIS TAB'S CUSTODY DOOR (operator ruling 2026-10-18: each browser tab asks for its own unlock, and the shared holder
 * carries no unlock between tabs). One small form on the page asks the person; the passphrase lives in this page's
 * memory for the one act and never enters a tiddler, a verb's arguments, a URL or storage. "Not now" answers null.
 */
function askCustody(question: CustodyAsk | { readonly kind: "clear" }): Promise<CustodyAnswer> {
  return new Promise((resolve) => {
    const form = document.createElement("form");
    form.className = "custody-ask";
    form.dataset["ask"] = question.kind;
    const say = document.createElement("div");
    say.textContent =
      question.kind === "unlock" ? `Unlock this browser's vessel (attempt ${String(question.attempt)} of ${String(question.of)})${question.notes.length ? ` — ${question.notes.join("; ")}` : ""}`
        : question.kind === "bind-first" ? "Bind a passphrase to this browser before it holds a face's secrets. Keep it: nothing here recovers it."
          : "Enter this browser's passphrase to clear it. Its secrets will then rest in the clear in this browser's storage.";
    const pass = document.createElement("input");
    pass.type = "password"; pass.autocomplete = question.kind === "bind-first" ? "new-password" : "current-password"; pass.required = true;
    const again = question.kind === "bind-first" ? document.createElement("input") : null;
    if (again) { again.type = "password"; again.autocomplete = "new-password"; again.required = true; again.placeholder = "again"; }
    const go = document.createElement("button"); go.type = "submit"; go.textContent = question.kind === "clear" ? "clear" : question.kind === "bind-first" ? "bind" : "unlock";
    const not = document.createElement("button"); not.type = "button"; not.textContent = "not now";
    const done = (answer: CustodyAnswer): void => { pass.value = ""; if (again) again.value = ""; form.remove(); resolve(answer); };
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (again && again.value !== pass.value) { say.textContent = "The two passphrases differ; type them again."; again.value = ""; return; }
      done({ kind: "passphrase", passphrase: pass.value });
    });
    not.addEventListener("click", () => done(null));
    form.append(say, pass, ...(again ? [again] : []), go, not);
    document.body.prepend(form);
    pass.focus();
  });
}


/**
 * The oracle read-face this page reads from, when no `?oracle=` names one.
 *
 * The page is served BY the vessel it reads, so the host that delivered it is the host that answers — a
 * literal `localhost` reads true only where the browser and the node share a machine, and silently points a
 * LAN or a phone at itself. `location.hostname` follows the page home wherever it was fetched from.
 */
function row(parent: HTMLElement, k: string, v: string, cls = ""): void {
  const d = document.createElement("div");
  d.className = "row";
  const ke = document.createElement("span"); ke.className = "k"; ke.textContent = k;
  const ve = document.createElement("span"); ve.className = "v " + cls; ve.textContent = v;
  d.append(ke, ve);
  parent.appendChild(d);
}
function set(id: string, text: string, cls = ""): void {
  const el = $(id); el.textContent = text; el.className = "v " + cls;
}

// The floor — the Nexus's one public answer. The page reads it only through its own vessel, which fetches the hearth's porch
// (`/floor/<Nexus AID>`) and the head release's blobs by CID, and verifies every step here: the epoch lineage re-derives the
// AID the floor card (or the admit) carries, the head release seals as a seat of its epoch under the cabal's approval of the
// manifest's exact bytes, and each blob hashes to its CID. The read face is the node that served this page (?oracle=… names
// another). The read records no acceptance: the page's running floor stays the genesis floor it booted on.
type FloorReader = (baseUrl: string) => Promise<HearthFloorRead>;
async function readFloor(read: FloorReader): Promise<void> {
  const params = new URLSearchParams(location.search);
  const readFace = params.get("oracle") ?? defaultReadFace(location);
  const elsewhere = oracleElsewhereNote(params.get("oracle"), resolveRelayUrl(params));
  const say = (text: string, cls = ""): void => set("floor-status", elsewhere ? `${text} — ${elsewhere}` : text, cls);
  say(`reading the porch at ${readFace} …`);
  try {
    const r = await read(readFace);
    if (r.ok) {
      const floorEl = $("floor"); floorEl.replaceChildren();
      row(floorEl, "status", "✓ verified floor", "ok");
      if (elsewhere) row(floorEl, "note", elsewhere, "warn");
      row(floorEl, "release", r.head.cid.slice(0, 16) + "…");
      row(floorEl, "epoch", r.head.body.epoch.slice(0, 22) + "…");
      row(floorEl, "prior", r.head.body.prior ? r.head.body.prior.slice(0, 16) + "…" : "(the Nexus's first release)");
      row(floorEl, "manifest", r.head.body.manifest);
      row(floorEl, "lares rows", String(Object.keys(r.lares).length));
      row(floorEl, "lararium rows", String(Object.keys(r.lararium).length));
      for (const refused of r.refused) row(floorEl, "set aside", `${refused.keyCid.slice(0, 16)}… ${refused.reason}${refused.detail ? ` (${refused.detail})` : ""}`, "warn");
    } else {
      say(`✗ ${r.reason}${r.detail ? ` — ${r.detail}` : ""}`, "warn");
    }
  } catch (e) {
    say(`✗ ${e instanceof Error ? e.message : String(e)}`, "warn");
  }
}

// The projection-nalu sink: one pane, painted by whichever surface holds the vessel's projection gate. The
// sink scopes revisions to a surface and stamps each returned event with the surface that painted its target
// (`projection-sink`); boot arms its return leg once the vessel stands.
const projectionSink = createProjectionSink($("projection"), { inputMaxChars: LAR_WHOLE_VALUE_MAX_CHARS, addressBar: true });

/**
 * The tab-local hand-off the fleet-join landing writes: a carriage waiting for the boot that consumes it.
 * The admit enters the vessel at the identity seat — before the PersonaGroup, the relay caps, and the
 * Handle stand — so a landed admission re-enters through boot rather than reaching behind a live cap stack. This page performs that re-entry itself; the human pastes and taps.
 *
 * The stash rides sessionStorage, never the URL. sessionStorage closes with the tab,
 * and this read REMOVES the entry — the carriage exists for exactly one boot.
 */
const ADMIT_STASH_KEY = "lares:admit-carriage";
function takeStashedAdmit(): DeviceAdmitPayload | null {
  let carriage: string | null = null;
  try { carriage = sessionStorage.getItem(ADMIT_STASH_KEY); } catch { return null; }
  if (!carriage) return null;
  try { sessionStorage.removeItem(ADMIT_STASH_KEY); } catch { /* the read already holds the bytes */ }
  const payload = parseAdmitCarriage(carriage);
  if (payload) console.log("[vessel] ADMIT taken from the fleet-join landing — this vessel JOINS an existing PersonaGroup.");
  return payload;
}

/** The fleet-join file a paste carries, by its `kind`: an offer to request against, an answer to land, or neither. */
function fleetJoinFileOf(text: string): { readonly kind: "fleet-join-offer" | "fleet-join-answer"; readonly value: unknown } | null {
  let value: unknown;
  try { value = JSON.parse(text.trim()); } catch { return null; }
  const kind = typeof value === "object" && value !== null ? (value as { kind?: unknown }).kind : undefined;
  return kind === "fleet-join-offer" || kind === "fleet-join-answer" ? { kind, value } : null;
}

/**
 * Mount the identity + admit surface: this vessel names its own key, writes the command that starts a fleet join,
 * and takes the files back as pastes. THE FLEET-JOIN DOOR: the root holder's offer pastes in, and this browser
 * answers with its request (its face-scoped keys mint here); the root holder's answer pastes in, and this browser
 * lands it and re-enters boot on the admit it carried. The paste box reads a fleet-join offer or answer only.
 *
 * The alternative path costs a human a devtools console on a phone. The key, the command, and the door
 * all live on the page instead — the vessel says the one thing only it holds, and reads back the one
 * thing only the node can sign. `fleetJoinFileOf` adjudicates: a refusal states itself and the page
 * stands unchanged, because a garbled paste means the admit DID NOT ARRIVE, never that an attack landed.
 */
function mountAdmitSurface(verifyingKeyHex: string): void {
  const keyEl = $("vessel-key"), cmdEl = $("admit-cmd"), statusEl = $("admit-status");
  const paste = document.getElementById("admit-paste") as HTMLTextAreaElement | null;
  const apply = document.getElementById("admit-apply") as HTMLButtonElement | null;
  keyEl.textContent = verifyingKeyHex;
  cmdEl.textContent = "lares fleet join offer --out offer.json";

  // Copy where the platform grants a clipboard; SELECT where it does not (an insecure origin, an older
  // browser). A selected span is a thumb away from the OS copy affordance, so the path never dead-ends.
  const copyFrom = (el: HTMLElement, btn: HTMLButtonElement): void => {
    const text = el.textContent ?? "";
    const done = (label: string): void => { btn.textContent = label; setTimeout(() => { btn.textContent = btn.dataset["label"]!; }, 1400); };
    void (async () => {
      try { await navigator.clipboard.writeText(text); done("copied ✓"); }
      catch {
        const r = document.createRange(); r.selectNodeContents(el);
        const s = getSelection(); s?.removeAllRanges(); s?.addRange(r);
        done("selected — copy");
      }
    })();
  };
  for (const [btnId, srcEl] of [["copy-key", keyEl], ["copy-cmd", cmdEl]] as const) {
    const btn = document.getElementById(btnId) as HTMLButtonElement | null;
    if (!btn) continue;
    btn.dataset["label"] = btn.textContent ?? "copy";
    btn.addEventListener("click", () => copyFrom(srcEl, btn));
  }

  if (!paste || !apply) return;
  const stashAndReboot = (carriage: string): void => {
    try { sessionStorage.setItem(ADMIT_STASH_KEY, carriage); }
    catch {
      statusEl.textContent = "✗ this browser withholds sessionStorage — the admit cannot reach boot here.";
      statusEl.className = "err";
      return;
    }
    location.reload();
  };
  apply.addEventListener("click", () => {
    const file = fleetJoinFileOf(paste.value);
    if (file) {
      apply.disabled = true;
      void (async () => {
        try {
          if (file.kind === "fleet-join-offer") {
            // Another join standing pending would strand this page: the human may abandon it here, by name.
            // A JOIN MINTS FACE SECRETS (the face-scoped key, then the address secret): the slot binds first, in this tab.
            const custody = await standBrowserCustody({ idbName: VESSEL_IDB, ask: askCustody, secretMintDue: true });
            if (custody.reading !== "bound" && custody.reading !== "opens" && custody.reading !== "held") {
              throw new Error(`this browser's custody reads ${custody.reading}; a fleet join mints a face's secrets only over a slot`);
            }
            const request = await browserFleetJoinRequest({ offer: file.value }).catch(async (err: unknown) => {
              if (!(err instanceof BrowserFleetJoinRefused && err.refusal === "join-pending")) throw err;
              if (!confirm("Another fleet join stands pending in this browser. Abandon it, and request against this offer instead?")) throw err;
              await browserFleetJoinAbandon();
              return browserFleetJoinRequest({ offer: file.value });
            });
            paste.value = JSON.stringify(request, null, 2);
            paste.select();
            statusEl.textContent = "✓ request minted — carry it back to the root holder: `lares fleet join answer <request-file>`, then paste the answer here.";
            statusEl.className = "ok";
            return;
          }
          const { admit } = await browserFleetJoinLand({ answer: file.value });
          statusEl.textContent = `✓ answer landed — signed by ${admit.signerDid.slice(0, 12)}… · re-entering boot`;
          statusEl.className = "ok";
          paste.value = "";
          stashAndReboot(toAdmitCarriage(admit));
        } catch (err) {
          statusEl.textContent = err instanceof BrowserFleetJoinRefused ? `✗ refused — ${err.message}` : `✗ ${String(err)}`;
          statusEl.className = "err";
        } finally { apply.disabled = false; }
      })();
      return;
    }
    statusEl.textContent = "✗ not a fleet-join offer or answer — paste the whole offer or answer file.";
    statusEl.className = "err";
  });
}

let pendingAdmit: DeviceAdmitPayload | null = null;
function offerBootRetry(): void {
  if (document.getElementById("retry-unlock")) return;
  const button = document.createElement("button");
  button.id = "retry-unlock";
  button.type = "button";
  button.textContent = "Unlock and retry";
  button.addEventListener("click", () => { button.remove(); void bootVessel(); });
  $("status").insertAdjacentElement("afterend", button);
}

async function bootVessel(): Promise<void> {
  document.getElementById("retry-unlock")?.remove();
  const phasesEl = $("phases");
  phasesEl.replaceChildren();
  const paint = (p: string): void => {
    const d = document.createElement("div"); d.className = "phase"; d.textContent = p;
    phasesEl.appendChild(d);
  };

  set("status", "booting…");
  // ?relay=ws://host:port/ws → the node↔browser spore crossing (opt-in; absent = pure local boot).
  const relayParams = new URLSearchParams(location.search);
  const relayUrl = resolveRelayUrl(relayParams);
  // #floor=<card> → the hearth's oracle floor card, carried by hand off its banner: what a device at the floor reads under.
  const floor = floorCardOf(location.hash, readHearthFloorCard);
  // The fleet-join landing stashes the admit it carried; this boot takes it and the vessel opens on it.
  const admit = pendingAdmit ?? takeStashedAdmit();
  pendingAdmit = admit;
  // A local boot and a CROSSED boot look identical from the outside: both render, both say "ready". So
  // the vessel names which one it just performed. A shore nobody can see is a shore nobody watches, and an
  // absent crossing that reports nothing reads exactly like a crossing that worked.
  if (relayUrl) {
    console.log(`[vessel] CROSSING → ${relayUrl}`);
    if (floor && floor.card === null) console.warn("[vessel] the floor card this URL carries does not read: open the URL the hearth's banner prints");
  } else {
    console.log(
      "[vessel] PURE LOCAL BOOT — no node vessel dialled.\n" +
      "         To cross: open the URL a hearth's banner prints (`?relay=…#floor=…`); this device stands at its floor, and a face joins it by the fleet-join door.",
    );
  }
  // ?genesis=<base> → where the static host serves genesis/ (seed + cas/). Default /genesis.
  const genesisCasBaseUrl = new URLSearchParams(location.search).get("genesis") ?? "/genesis";
  // ?mesh=<readface%23gatekey,…> → carry-in as a mesh LEAF, bootstrapping the FLOW-map from peer oracle
  //   read-faces, each pinned by its gate key (opt-in; absent = no carriage / pure local boot). An entry with no
  //   key is dropped: nothing to knock on. The browser is a LEAF (no endpoint — carries-in, not dial-able).
  const meshParam = new URLSearchParams(location.search).get("mesh");
  const meshLeaf = meshParam !== null
    ? {
        coordSeed: location.origin,
        peers: meshParam.split(",").map((s) => parseMeshPeer(s.trim())).filter((p): p is MeshPeer => p !== null),
      }
    : undefined;
  let vesselOpened = false;
  try {
    // THE BOOT'S CUSTODY STEP, before the vessel opens: a sealed keystore asks this tab's person for its unlock. A boot
    // that opens over a locked keystore refuses `sealed-locked` and gives the store lock back, so declining here
    // leaves the page able to try again.
    const custody = await standBrowserCustody({ idbName: VESSEL_IDB, ask: askCustody });
    if (custody.reading === "declined" || custody.reading === "no-slot-opens" || custody.reading === "unreadable") {
      set("status", `this browser's vessel stays locked (${custody.reading})`, "warn");
      offerBootRetry();
      return;
    }
    const result = await openBrowserVessel({
      askCustody,
      hostId: "elyncia-browser",
      wikiId: "lares",
      genesisSeed: genesisSeed as unknown as GenesisSeed,
      genesisCasBaseUrl,
      daemonWorkerUrl,
      ...(sharedHolderUrl ? { sharedHolderUrl } : {}),
      workerScriptUrl,
      onPhase: (p) => { paint(p); projectionSink.setBreath("lares", { phase: p }); },
      onFrame: (frame) => { if (projectionSink.apply(frame) === "painted" && frame.keys.some((key) => key.key === "lar:surface")) reportFirstPaint(); },
      onControlResult: (_surface, result) => { projectionSink.applyResult(result); },
      ...(relayUrl ? { relayUrl } : {}),
      ...(floor ? { floorCard: floor.text } : {}),
      ...(admit ? { admit } : {}),
      ...(meshLeaf ? { meshLeaf } : {}),
    });
    vesselOpened = true;
    pendingAdmit = null;
    // Identity custody stays in the browser vessel. The web surface renders the public receipt returned
    // by that opening instead of opening the key store a second time just to paint it.
    const did = didFromVerifyingKey(result.identity.verifyingKey);
    // A landed fleet join leaves its pending row only now that the vessel stood on its admit.
    if (admit) void browserFleetJoinSettle().catch((err: unknown) => console.warn("[vessel] the landed fleet join did not settle:", err));
    mountAdmitSurface(result.identity.verifyingKey);
    if (relayUrl) {
      console.log(`[vessel] this leaf's key: ${did}`);
      console.log("[vessel] to join a face's fleet, on the root holder: lares fleet join offer --out offer.json, then paste the offer here");
    }
    void readFloor(result.readFloor);           // the vessel stands, so it reads and verifies the hearth's floor
    // Arm the interactivity RETURN leg (click and text halves): each event carries its source surface.
    projectionSink.arm({ sendControlEvent: result.sendControlEvent });
    // The UNIVERSAL summon (the reachability affordance): host chrome overlays EVERY
    // wiki, so this button + chord flips the projection gate to the daemon from any
    // active surface — a pure gate flip (both surfaces already mounted), no reboot.
    // Distinct from the daemon-scoped $:/temp/lares/surface toggle inside the widget.
    const summon = (): void => { projectionSink.awaitSurface(DAEMON_SURFACE_ID); result.setActiveSurface(DAEMON_SURFACE_ID); };
    const summonBtn = document.getElementById("summon-daemon") as HTMLButtonElement | null;
    if (summonBtn) { summonBtn.disabled = false; summonBtn.addEventListener("click", summon); }
    window.addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) { e.preventDefault(); summon(); }
    });
    const vesselEl = $("vessel"); vesselEl.replaceChildren();
    row(vesselEl, "status", "live — sovereign local island", "ok");
    row(vesselEl, "did", did);
    row(vesselEl, "origin", location.origin);
    row(vesselEl, "relay", relayUrl ?? `not pinned · ${sameOriginRelayUrl(location)}`);
    mountLiveStatus(vesselEl, result.connectionState);
    row(vesselEl, "wiki", result.activeWikiId);
    row(vesselEl, "wiki doc", result.wikiDocUrl);
    row(vesselEl, "oracle doc", result.oracleDocUrl ?? "(local genesis)");
    showPageInstruments();
    // THE SEVEN-DAY CLOCK, REPORTED — the eviction class + estimate() as one line (never a fault), and the
    // PHONE SEAT's offer beneath it, rendered only where the clock stands and the page is not yet installed.
    void requestDurableStorage().then((reading) => {
      const floor = storageFloorReport(reading);
      if (floor) { console.log(floor); row(vesselEl, "storage", floor.replace(/^\[vessel\] storage floor: /, ""), "warn"); }
      const offer = phoneSeatExplanation(ambientPhoneSeatHost(reading.persistence));
      if (offer) row(vesselEl, "phone seat", offer, "warn");
    }).catch(() => { /* an unreadable storage surface reports nothing — never a fault */ });
    // THE SEED AT REST — sealed under this browser's slot tree, or else cleartext or a passkey wrap whose class the line names.
    void readBrowserCustody(VESSEL_IDB).then(async (custodyNow) => {
      if (custodyNow.reading === "sealed") { row(vesselEl, "seed", "sealed under this browser's passphrase slot", "ok"); return; }
      const wrap = await readBrowserSeedWrap(undefined, (await loadBrowserActivePersona()) ?? 0);
      row(vesselEl, "seed", seedRestStatus(wrap), wrap ? "ok" : "warn");
    }).catch(() => { /* an unreadable slot reads as cleartext elsewhere; this line stays silent — never a fault */ });
  } catch (e) {
    set("status", `boot failed: ${e instanceof Error ? e.message : String(e)}`, "err");
    if (!vesselOpened) offerBootRetry();
  }
}

void bootVessel();
