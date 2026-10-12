/* SharedWorker: one instance serves every tab of the origin. Invariants:
 *   - instanceId is minted once, from crypto.getRandomValues, when the script first runs;
 *   - ownerEpoch is an IndexedDB counter this worker increments once, while holding the Web Lock
 *     "probe-owner-lifetime" for the rest of its life; a new instance cannot count until the old one released it;
 *   - `ticks` counts setInterval firings (a counter, never a clock);
 *   - `events` is a sequence-numbered log posted by pages. */
"use strict";
importScripts("worker-common.js");
const instanceId = PCHex(crypto.getRandomValues(new Uint8Array(8)));
let ticks = 0, connects = 0, open = 0, seq = 0;
const events = [];
setInterval(() => { ticks++; }, 1000);
let lastBroadcast = null;
try { const bc = new BroadcastChannel("probe-bc"); bc.onmessage = (e) => { lastBroadcast = e.data; }; } catch (e) { lastBroadcast = "BroadcastChannel refused: " + e.name; }

let epoch = null, epochError = null;
const epochReady = new Promise((resolve) => {
  navigator.locks.request("probe-owner-lifetime", async () => {
    try { epoch = (await PC.bumpCounter("owner-epoch")).evidence.value; } catch (e) { epochError = e.name + ": " + e.message; }
    resolve(epoch);
    await new Promise(() => {}); // the lock lasts as long as this worker
  }).catch((e) => { epochError = e.name + ": " + e.message; resolve(null); });
});
const ownerEpoch = () => Promise.race([epochReady, new Promise((r) => setTimeout(() => r(null), 1500))]);

self.onconnect = (ev) => {
  const port = ev.ports[0]; connects++; open++;
  port.onmessage = async (e) => {
    const m = e.data;
    const reply = (o) => port.postMessage({ id: m.id, ...o });
    switch (m.cmd) {
      case "ping": return reply({ ok: true, instanceId, ownerEpoch: await ownerEpoch(), epochError, connectedPorts: open, connects, ticks, scope: "SharedWorkerGlobalScope" in self });
      case "echo": return reply({ ok: true, nonce: m.nonce, instanceId, ownerEpoch: await ownerEpoch(), ticks });
      case "kill": reply({ ok: true, instanceId }); setTimeout(() => self.close(), 50); return;
      case "bye": open = Math.max(0, open - 1); return reply({ ok: true });
      case "back": open++; return reply({ ok: true });
      case "event": events.push({ seq: ++seq, tab: m.tab, name: m.name, detail: m.detail ?? null }); return reply({ ok: true, seq });
      case "lifecycle": return reply({ ok: true, instanceId, ownerEpoch: await ownerEpoch(), connectedPorts: open, connects, ticks, events });
      case "chain": m.toD.postMessage({ cmd: "adopt", port: m.pagePort }, [m.pagePort]); return reply({ ok: true });
      case "broadcastSeen": return reply({ ok: true, last: lastBroadcast });
      default: return reply(await PCRun(m.cmd, m.args));
    }
  };
  port.start?.();
};
