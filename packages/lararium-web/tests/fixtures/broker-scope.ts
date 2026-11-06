/**
 * broker-scope — THE BROKER'S OWN SERVED BYTES (`public/ceremony-broker.js`) over a stand-in service-worker scope.
 *
 * `standBroker(clients)` evaluates the real broker against a scope whose `clients` reads the live `clients` array (splice a
 * client out to read it gone). `send` delivers one message from a client as the platform does; every `event.data` the broker
 * receives lands in `seen` (the broker's whole view of its traffic), and every promise it hands `waitUntil` lands in `kept`,
 * with `settled(p)` reading whether that wait has ended.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift
 */
import brokerSource from "../../public/ceremony-broker.js?raw";

export const ORIGIN = "https://hearth.test";

export interface Posted { readonly msg: unknown; readonly ports: readonly MessagePort[] }
export interface Client { readonly id: string; readonly url: string; readonly type: "window"; readonly posted: Posted[]; postMessage(msg: unknown, transfer?: Transferable[]): void }

export function client(id: string, path: string): Client {
  const posted: Posted[] = [];
  return { id, url: `${ORIGIN}${path}`, type: "window", posted, postMessage: (msg, transfer = []) => { posted.push({ msg, ports: transfer as MessagePort[] }); } };
}

export function standBroker(clients: Client[]) {
  const listeners = new Map<string, Array<(event: unknown) => void>>();
  const seen: unknown[] = [];
  const kept: Promise<unknown>[] = [];
  const done = new WeakSet<Promise<unknown>>();
  const scope = {
    location: { origin: ORIGIN },
    skipWaiting: () => Promise.resolve(),
    clients: {
      claim: () => Promise.resolve(),
      get: (id: string) => Promise.resolve(clients.find((c) => c.id === id)),
      matchAll: () => Promise.resolve(clients.slice()),
    },
    addEventListener: (type: string, l: (event: unknown) => void) => { listeners.set(type, [...(listeners.get(type) ?? []), l]); },
  };
  new Function("self", brokerSource)(scope);
  const settle = async (): Promise<void> => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
  const send = async (from: Client, msg: unknown, ports: MessagePort[] = []): Promise<void> => {
    seen.push(msg);
    for (const l of listeners.get("message") ?? []) {
      l({ data: msg, source: from, ports, waitUntil: (p: Promise<unknown>) => { kept.push(p); void p.then(() => done.add(p), () => done.add(p)); } });
    }
    // barrier: the broker's own async hand (its clients reads) settles before the test reads what it posted.
    await settle();
  };
  return { send, seen, kept, settled: (p: Promise<unknown>) => done.has(p), settle };
}
