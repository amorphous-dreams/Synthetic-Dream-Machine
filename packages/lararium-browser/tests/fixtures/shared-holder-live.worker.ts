import { makeSharedHolderCore, type HolderIsland } from "../../src/shared-holder-core.js";

const scope = globalThis as unknown as {
  location: { href: string };
  navigator?: { locks?: ConstructorParameters<typeof makeSharedHolderCore>[0]["locks"] };
  addEventListener(type: "connect", callback: (event: MessageEvent) => void): void;
};
const params = new URL(scope.location.href).searchParams;
const lockName = params.get("lock") ?? "lares:vessel:shared-holder-live";

let mountedWiki = { title: "Lady Aki", level: "2" };
const core = makeSharedHolderCore({
  lockName,
  locks: scope.navigator?.locks ?? null,
  spawnIsland: (_group, personaRoot, edgeDigest): HolderIsland => {
    const listeners = new Set<(message: unknown) => void>();
    // The fixture island's Binding Gate clears for the edge the first session presented.
    queueMicrotask(() => { for (const listener of listeners) listener({ type: "gate:clear", edgeDigest, personaRoot }); });
    return {
      // The fixture island answers each verb with its result under the asker's request id, as the daemon does; the
      // holder routes that answer to the asking tab alone.
      post(message) {
        const request = message as { type?: unknown; requestId?: unknown; verb?: unknown; args?: { level?: unknown } };
        if (request.type !== "wiki:place-verb" || typeof request.requestId !== "string") return;
        if (request.verb === "change" && typeof request.args?.level === "string") mountedWiki = { ...mountedWiki, level: request.args.level };
        for (const listener of listeners) listener({ type: "wiki:verb-result", requestId: request.requestId, output: { kind: "wiki", ...mountedWiki } });
      },
      listen(listener) { listeners.add(listener); return () => listeners.delete(listener); },
      onError() { return () => {}; },
      terminate() {},
    };
  },
});

scope.addEventListener("connect", (event) => {
  const port = event.ports[0];
  if (port) void core.connect(port);
});
