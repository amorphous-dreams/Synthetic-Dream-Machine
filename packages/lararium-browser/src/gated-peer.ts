/** Let a tab send to its Repo while the house gate holds Repo frames until clearance. */
export function attachGatedPeer(
  attachRepoSide: (port: MessagePort) => void,
  tab: MessagePort,
  serving: Promise<void>,
): void {
  const relay = new MessageChannel();
  attachRepoSide(relay.port1);
  let open = false;
  let ended = false;
  const held: unknown[] = [];
  relay.port2.onmessage = (event: MessageEvent) => {
    if (ended) return;
    if (open) tab.postMessage(event.data);
    else held.push(event.data);
  };
  tab.onmessage = (event: MessageEvent) => {
    if (!ended) relay.port2.postMessage(event.data);
  };
  void serving.then(() => {
    if (ended) return;
    open = true;
    for (const frame of held.splice(0)) tab.postMessage(frame);
  }, () => {
    ended = true;
    held.length = 0;
    relay.port2.onmessage = null;
    tab.onmessage = null;
    relay.port1.close();
    relay.port2.close();
  });
}
