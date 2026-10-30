export function readyWorker(url: URL): Promise<Worker> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(url, { type: "module" });
    const cleanup = () => { worker.removeEventListener("message", onMessage); worker.removeEventListener("error", onError); worker.removeEventListener("messageerror", onError); };
    const onMessage = (event: MessageEvent) => { if (event.data?.type === "ready") { cleanup(); resolve(worker); } };
    const onError = (event: Event) => { cleanup(); worker.terminate(); reject(new Error(`the tab worker faulted (${(event as ErrorEvent).message || event.type})`)); };
    worker.addEventListener("message", onMessage);
    worker.addEventListener("error", onError);
    worker.addEventListener("messageerror", onError);
  });
}
