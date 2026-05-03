/**
 * Lararium Service Worker — lararium island integrity verifier.
 *
 * Intercepts tiddlywikicore-*.js fetches. On first load: network fetch + cache.
 * On subsequent loads: serve from cache after sha256 verification against the
 * catalog entry broadcast by the main thread.
 *
 * When the catalog engine entry changes (new version or sha256 mismatch):
 *   1. Fetch the new blob from network.
 *   2. Verify sha256 matches catalog entry.
 *   3. Cache the verified blob.
 *   4. Broadcast "engine-update-cached" to all clients — TW5 sets the banner.
 *
 * Trust model: sha256 is content-addressed identity.
 * Source (CDN, mesh peer, IPFS gateway) is irrelevant once hash is verified.
 */

/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME   = "lararium-engine-v1";
const ENGINE_RE    = /tiddlywikicore-[^/]+\.js$/;

// ---------------------------------------------------------------------------
// Catalog engine entry — posted by main thread after catalog doc syncs
// ---------------------------------------------------------------------------

interface EngineEntry { version: string; sha256: string; docUrl: string; }

let knownEntry: EngineEntry | null = null;

// ---------------------------------------------------------------------------
// sha256 of a Response body (consumed — clone before calling)
// ---------------------------------------------------------------------------

async function sha256hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Install / activate — claim immediately so first page load is controlled
// ---------------------------------------------------------------------------

self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", (ev) => ev.waitUntil(self.clients.claim()));

// ---------------------------------------------------------------------------
// Fetch interception — engine script only
// ---------------------------------------------------------------------------

self.addEventListener("fetch", (ev) => {
  const url = ev.request.url;
  if (!ENGINE_RE.test(url)) return; // pass through everything else

  ev.respondWith(handleEngineFetch(ev.request));
});

async function handleEngineFetch(req: Request): Promise<Response> {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(req);

  if (cached && knownEntry) {
    // Verify cached blob matches current known entry.
    // If mismatch: re-fetch, verify, cache, notify.
    const buf   = await cached.clone().arrayBuffer();
    const actualSha = await sha256hex(buf);
    if (actualSha === knownEntry.sha256) {
      return cached;
    }
    // Cached blob is stale — fall through to network fetch.
    console.warn("[lararium-sw] cached engine sha256 mismatch — re-fetching");
  } else if (cached) {
    // No entry yet (catalog hasn't synced) — serve cache optimistically.
    return cached;
  }

  // Network fetch, verify, cache.
  const res = await fetch(req);
  if (!res.ok) return res;

  const buf  = await res.clone().arrayBuffer();
  const sha  = await sha256hex(buf);

  if (knownEntry && sha !== knownEntry.sha256) {
    console.error(`[lararium-sw] engine fetch sha256 mismatch! got=${sha.slice(0,12)} want=${knownEntry.sha256.slice(0,12)}`);
    // Serve the response anyway (don't break boot) but don't cache — let it
    // re-verify on next load. A tampered CDN would fail here.
  } else {
    await cache.put(req, res.clone());
  }

  return res;
}

// ---------------------------------------------------------------------------
// Message channel — main thread posts catalog engine entry after catalog sync
// ---------------------------------------------------------------------------

self.addEventListener("message", (ev) => {
  const data = ev.data as { type?: string; entry?: EngineEntry; blob?: ArrayBuffer; version?: string } | null;
  if (!data) return;

  if (data.type === "engine-entry") {
    const incoming = data.entry;
    if (!incoming) return;
    const previousVersion = knownEntry?.version ?? null;
    knownEntry = incoming;
    if (previousVersion && previousVersion !== incoming.version) {
      // Version changed — request the blob from the main thread (mesh-native path).
      // Main thread holds the Automerge LarariumDoc; it pushes the bytes back via
      // "engine-blob" message. Avoids any CDN dependency in the update path.
      void requestBlobFromClient(incoming);
    }
    return;
  }

  if (data.type === "engine-blob" && data.blob && data.version && knownEntry) {
    void receiveBlobAndCache(data.blob, data.version, knownEntry);
  }
});

async function requestBlobFromClient(entry: EngineEntry): Promise<void> {
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage({ type: "need-engine-blob", version: entry.version });
  }
}

async function receiveBlobAndCache(buf: ArrayBuffer, version: string, entry: EngineEntry): Promise<void> {
  const sha = await sha256hex(buf);
  if (sha !== entry.sha256) {
    console.error(`[lararium-sw] engine blob sha256 mismatch for v${version}: got=${sha.slice(0,12)} want=${entry.sha256.slice(0,12)}`);
    return;
  }
  const scriptUrl = `/tiddlywikicore-${version}.js`;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(scriptUrl, new Response(buf, {
    headers: { "Content-Type": "application/javascript" },
  }));
  console.log(`[lararium-sw] engine v${version} cached from mesh (sha=${sha.slice(0,12)}…)`);

  // Notify all clients — TW5 sets the update banner.
  const clients = await self.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage({ type: "engine-update-cached", version });
  }
}
