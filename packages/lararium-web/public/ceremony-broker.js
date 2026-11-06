// ceremony-broker — THE SERVICE WORKER THAT BROKERS THE CEREMONY'S PORT (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-ceremony).
//
// The surface page mints a MessageChannel per ask: one end goes to the vessel worker, the other comes here (`ceremony:offer`).
// The ceremony document claims it (`ceremony:claim`) and this worker transfers it on. It holds a port only between the offer
// and the claim, never starts it and never reads it, and keeps no state past that hand. A claim from any document but the
// ceremony's own, or an offer from the ceremony document, answers `ceremony:absent`.
//
// An unanswered vessel claim ends on its claimant’s withdraw or a later event that finds its client gone.
// It imports nothing and handles no fetch: it carries no content key and serves no bytes.
const CEREMONY_PATH = "/ceremony.html";
const held = new Map();
const vesselClaims = new Map();
let nextVesselClaim = 0;

const pathOf = (client) => { try { const url = new URL(client.url); return url.origin === self.location.origin ? url.pathname : null; } catch { return null; } };

self.addEventListener("install", () => { void self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });
self.addEventListener("message", (event) => {
  event.waitUntil(self.clients.matchAll({ type: "window" }).then((clients) => {
    const live = new Set(clients.map((client) => client.id));
    for (const [claimId, claim] of vesselClaims) {
      if (!live.has(claim.clientId)) { vesselClaims.delete(claimId); claim.release(); }
    }
    return route(event);
  }));
});

const route = (event) => {
  const msg = event.data;
  const source = event.source;
  if (msg && source && msg.t === "vessel:claim" && typeof msg.tabSession === "string") {
    const from = pathOf(source);
    if (from === CEREMONY_PATH) { source.postMessage({ t: "vessel:absent", tabSession: msg.tabSession }); return; }
    if (from === null || typeof source.id !== "string") return;
    const claimId = String(++nextVesselClaim);
    let release = () => {};
    const kept = new Promise((resolve) => { release = resolve; });
    vesselClaims.set(claimId, { clientId: source.id, tabSession: msg.tabSession, release });
    return Promise.all([kept, self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        const path = pathOf(client);
        if (client.id !== source.id && path !== null && path !== CEREMONY_PATH) {
          client.postMessage({ t: "vessel:want", claimId, tabSession: msg.tabSession });
        }
      }
    })]);
  }
  if (msg && source && msg.t === "vessel:withdraw" && typeof msg.tabSession === "string") {
    for (const [claimId, claim] of vesselClaims) {
      if (claim.clientId === source.id && claim.tabSession === msg.tabSession) {
        vesselClaims.delete(claimId);
        claim.release();
      }
    }
    return;
  }
  if (msg && source && msg.t === "vessel:offer" && typeof msg.claimId === "string") {
    const from = pathOf(source);
    if (from === CEREMONY_PATH) { source.postMessage({ t: "vessel:absent", claimId: msg.claimId }); return; }
    const port = event.ports[0];
    const claim = vesselClaims.get(msg.claimId);
    if (from === null || !port || !claim) return;
    vesselClaims.delete(msg.claimId);
    return self.clients.get(claim.clientId).then((client) => {
      if (client) client.postMessage({ t: "vessel:port", tabSession: claim.tabSession }, [port]);
    }).finally(claim.release);
  }
  if (!msg || typeof msg.askId !== "string" || !source) return;
  const from = pathOf(source);
  if (msg.t === "ceremony:offer") {
    const port = event.ports[0];
    if (!port || from === null || from === CEREMONY_PATH) return;
    let release = () => {};
    const kept = new Promise((resolve) => { release = resolve; });
    held.set(msg.askId, { port, release });
    // The offer keeps this worker standing until the ceremony claims its port; the platform's own cap ends a wait nobody claims.
    return kept;
  }
  if (msg.t === "ceremony:claim") {
    const hand = from === CEREMONY_PATH ? held.get(msg.askId) : undefined;
    if (!hand) { source.postMessage({ t: "ceremony:absent", askId: msg.askId }); return; }
    held.delete(msg.askId);
    source.postMessage({ t: "ceremony:port", askId: msg.askId }, [hand.port]);
    hand.release();
  }
};
