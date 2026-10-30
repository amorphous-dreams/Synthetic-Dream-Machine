export interface ConnectBuffer<T> {
  accept(port: T): void;
  open(next: (port: T) => void): void;
}

export function makeConnectBuffer<T>(onError: (error: unknown) => void = (error) => {
  queueMicrotask(() => { throw error; });
}): ConnectBuffer<T> {
  let handler: ((port: T) => void) | null = null;
  const pending: T[] = [];
  const dispatch = (port: T): void => {
    try { handler!(port); }
    catch (error) { onError(error); }
  };
  return {
    accept(port: T): void { if (handler) dispatch(port); else pending.push(port); },
    open(next: (port: T) => void): void {
      if (handler) return;
      handler = next;
      for (const port of pending.splice(0)) dispatch(port);
    },
  };
}

/** A holder whose start failed answers each buffered and later port with a refusal the page already reads (and floors on). */
export function refuseBufferedPorts(buffer: ConnectBuffer<{ postMessage(message: unknown): void }>, storeName: string, error: unknown): void {
  const cause = `holder-unavailable: ${error instanceof Error ? error.message : String(error)}`;
  buffer.open((port) => port.postMessage({ kind: "holder:refused", storeName, cause }));
}
