/**
 * The weld's worker trace: what crosses the page's worker boundary, summarized to protocol identifiers alone
 * (never projection bodies or input values).
 *
 * The page's one Worker stands the vessel (main.ts), so the trace reads the vessel's envelope and the wire message inside it;
 * dispatch and frame pair by the surface the envelope names.
 *
 * `summarizeWireMessage` stands self-contained (no closure, no import) because the init script carries it into the
 * page by its source text.
 */
export function summarizeWireMessage(data) {
  if (!data || typeof data !== "object") return { type: typeof data };
  // The page's one Worker stands the vessel: an act goes up as { t: "control-event", surface, ev }, a frame comes back
  // as { t: "frame", frame } (vessel-protocol.ts). The wire message rides inside; the envelope names the surface.
  const envelope = typeof data.t === "string" ? data.t : "";
  const inner = envelope === "control-event" ? data.ev : envelope === "frame" ? data.frame : envelope === "control-result" ? data.result : null;
  const msg = inner && typeof inner === "object" ? inner : data;
  const surface = typeof data.surface === "string" ? data.surface : typeof msg.surface === "string" ? msg.surface : "";
  const payload = msg.payload && typeof msg.payload === "object" ? msg.payload : null;
  return {
    envelope,
    surface,
    type: typeof msg.type === "string" ? msg.type : "",
    renderId: typeof msg.renderId === "string" ? msg.renderId : "",
    action: typeof msg.action === "string" ? msg.action : "",
    listenable: typeof msg.listenable === "string" ? msg.listenable : "",
    wikiUri: typeof msg.wikiUri === "string" ? msg.wikiUri : "",
    mountEpoch: typeof msg.mountEpoch === "number" ? msg.mountEpoch : null,
    rev: typeof payload?.rev === "number" ? payload.rev : null,
  };
}

/**
 * The init script, installed before navigation: every Worker the page builds records what it carries each way.
 * `dropDomEventRenderId` drops one known click at that boundary, so W3 can prove its positive result depends on
 * the return leg.
 */
export function workerTraceInitScript() {
  return `(() => {
  const summarize = ${summarizeWireMessage.toString()};
  const trace = { events: [], dropDomEventRenderId: null };
  window.__weldWorkerTrace = trace;
  const NativeWorker = window.Worker;
  let nextWorkerId = 0;
  function TracedWorker(...args) {
    const worker = new NativeWorker(...args);
    const url = String(args[0]);
    const workerId = "worker-" + (++nextWorkerId);
    let workerWikiUri = "";
    const note = (direction, data) => {
      const summary = summarize(data);
      if (summary.wikiUri) workerWikiUri = summary.wikiUri;
      trace.events.push({ direction, worker: url, workerId, ...summary, wikiUri: summary.wikiUri || workerWikiUri });
    };
    worker.addEventListener("message", (event) => { note("from-worker", event.data); });
    worker.addEventListener("error", (event) => {
      trace.events.push({ direction: "worker-error", worker: url, workerId, wikiUri: workerWikiUri, message: event.message || "" });
    });
    const post = worker.postMessage.bind(worker);
    worker.postMessage = (data, transfer) => {
      const before = trace.events.length;
      note("to-worker", data);
      const entry = trace.events[before];
      if (entry.type === "lar:control-event" && entry.renderId === trace.dropDomEventRenderId) {
        trace.events.push({ ...entry, direction: "dropped-to-worker" });
        return;
      }
      return transfer === undefined ? post(data) : post(data, transfer);
    };
    return worker;
  }
  TracedWorker.prototype = NativeWorker.prototype;
  Object.setPrototypeOf(TracedWorker, NativeWorker);
  window.Worker = TracedWorker;
})();`;
}
