export function makeConnectBuffer<T>() {
  let handler: ((port: T) => void) | null = null;
  const pending: T[] = [];
  return {
    accept(port: T): void { if (handler) handler(port); else pending.push(port); },
    open(next: (port: T) => void): void {
      if (handler) return;
      handler = next;
      for (const port of pending.splice(0)) next(port);
    },
  };
}
