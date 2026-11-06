// ceremony-broker — THE SERVICE WORKER THAT BROKERS THE CEREMONY'S PORT (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-ceremony).
//
// The surface page mints a MessageChannel per ask: one end goes to the vessel worker, the other comes here (`ceremony:offer`).
// The ceremony document claims it (`ceremony:claim`) and this worker transfers it on. It holds a port only between the offer
// and the claim, never starts it and never reads it, and keeps no state past that hand. A claim from any document but the
// ceremony's own, or an offer from the ceremony document, answers `ceremony:absent`.
//
// It imports nothing and handles no fetch: it carries no content key and serves no bytes.
const CEREMONY_PATH = "/ceremony.html";
const held = new Map();

const pathOf = (client) => { try { const url = new URL(client.url); return url.origin === self.location.origin ? url.pathname : null; } catch { return null; } };

self.addEventListener("install", () => { void self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener("message", (event) => {
  const msg = event.data;
  const source = event.source;
  if (!msg || typeof msg.askId !== "string" || !source) return;
  const from = pathOf(source);
  if (msg.t === "ceremony:offer") {
    const port = event.ports[0];
    if (!port || from === null || from === CEREMONY_PATH) return;
    let release = () => {};
    const kept = new Promise((resolve) => { release = resolve; });
    held.set(msg.askId, { port, release });
    // The offer keeps this worker standing until the ceremony claims its port; the platform's own cap ends a wait nobody claims.
    event.waitUntil(kept);
    return;
  }
  if (msg.t === "ceremony:claim") {
    const hand = from === CEREMONY_PATH ? held.get(msg.askId) : undefined;
    if (!hand) { source.postMessage({ t: "ceremony:absent", askId: msg.askId }); return; }
    held.delete(msg.askId);
    source.postMessage({ t: "ceremony:port", askId: msg.askId }, [hand.port]);
    hand.release();
  }
});
