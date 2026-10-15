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
  spawnIsland: (): HolderIsland => {
    const listeners = new Set<(message: unknown) => void>();
    return {
      post(message) {
        const request = message as { kind?: unknown; level?: unknown };
        if (request.kind === "change" && typeof request.level === "string") mountedWiki = { ...mountedWiki, level: request.level };
        if (request.kind === "read" || request.kind === "change") {
          for (const listener of listeners) listener({ kind: "wiki", ...mountedWiki });
        }
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
