self.addEventListener("message", (event: MessageEvent) => {
  self.postMessage({ op: event.data.op, ok: true });
});
self.postMessage({ type: "ready" });
export {};
