/* Dedicated worker: one per tab. RPC over postMessage: {id, cmd, args} -> {id, ...result}. Also adopts ports. */
"use strict";
importScripts("worker-common.js");
self.onmessage = async (e) => {
  const m = e.data;
  if (m.cmd === "hold") { m.port.onmessage = (ev) => { if (ev.data?.cmd === "adopt") ev.data.port.postMessage({ from: "dedicated-worker", scope: "DedicatedWorkerGlobalScope" in self }); }; m.port.start?.(); self.postMessage({ id: m.id, ok: true }); return; }
  self.postMessage({ id: m.id, ...(await PCRun(m.cmd, m.args)) });
};
