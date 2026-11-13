// A slow module graph delays evaluation before the listener stands.
await new Promise((resolve) => setTimeout(resolve, 1500));
self.addEventListener("message", (event: MessageEvent) => {
  self.postMessage({ op: event.data.op, ok: true });
});
self.postMessage({ type: "ready" });
export {};
