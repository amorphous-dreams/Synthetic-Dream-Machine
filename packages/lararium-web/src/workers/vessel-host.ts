/**
 * vessel-host — the vessel worker's body: `openBrowserVessel`, unchanged, on this worker's own thread, served to one page
 * over its port (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices, slice 2). The messages read in
 * `../vessel-protocol.ts`; every key, store and ceremony stays on this thread, and the page receives public readings,
 * frames and port traffic alone.
 *
 * The islands (daemon, wiki) spawn nested from this worker. The shared holder (`?holder`) runs in a SharedWorker, which a
 * dedicated worker cannot construct, so this thread asks the page to build it (`spawn`) and bridges its transferred port;
 * the page never reads that port. The holder dissolves in slice 4.
 *
 * Every custody and ward ask rides the ceremony door (`ceremony-door.ts`): the page hears the ask's public words and opens
 * the ceremony document, and the answer arrives on the ceremony's own brokered port, never on the page's.
 */
declare const __LAR_WALK_DOOR__: boolean;
import {
  openBrowserVessel, standBrowserCustody, readBrowserCustody, readBrowserSeedWrap, loadBrowserActivePersona,
  parseAdmitCarriage, toAdmitCarriage, readBrowserCustodyPasskeys, browserWardSign,
  browserFleetJoinRequest, browserFleetJoinLand, browserFleetJoinSettle, browserFleetJoinAbandon, BrowserFleetJoinRefused,
  type BrowserVesselResult, type CustodyAnswer, type CustodyAsk, type PageLife,
} from "@lararium/browser";
import { didFromVerifyingKey, parseMeshPeer, type MeshPeer } from "@lararium/mesh";
import type { PageToVessel, SeedRest, VesselError, VesselStatus, VesselToPage } from "../vessel-protocol.js";
import { CeremonyRefused, standCeremonyDoor } from "./ceremony-door.js";

export interface VesselScope {
  postMessage(msg: VesselToPage, transfer?: Transferable[]): void;
}

const errorOf = (err: unknown): VesselError => ({
  name: err instanceof Error ? err.name : "Error",
  message: err instanceof Error ? err.message : String(err),
  ...(err instanceof BrowserFleetJoinRefused || err instanceof CeremonyRefused ? { refusal: err.refusal } : {}),
});

/** Serve one page: the caller feeds every page message, in order, to the returned `receive`. */
export function serveVessel(scope: VesselScope): { receive(msg: PageToVessel): void } {
  const post = (msg: VesselToPage, transfer: Transferable[] = []): void => scope.postMessage(msg, transfer);
  const spawns = new Map<string, (answer: Extract<PageToVessel, { t: "spawned" }>) => void>();
  const lifeListeners = new Set<(life: PageLife) => void>();
  let opened: (result: BrowserVesselResult) => void;
  const vessel = new Promise<BrowserVesselResult>((resolve) => { opened = resolve; });
  let booted = false;

  let idbName = "lares:vessel";
  const door = standCeremonyDoor(post);
  const wordsOf = (question: CustodyAsk | { readonly kind: "clear" }): string =>
    question.kind === "unlock" ? `attempt ${String(question.attempt)} of ${String(question.of)}${question.notes.length ? ` — ${question.notes.join("; ")}` : ""}` : "";
  /** A custody ask: the ceremony offers a passkey route beside the passphrase wherever a passkey pin stands. */
  const askCustody = (act: string) => async (question: CustodyAsk | { readonly kind: "clear" }): Promise<CustodyAnswer> =>
    door.ask({ kind: question.kind, act, words: wordsOf(question), passkeys: question.kind === "bind-first" ? [] : await readBrowserCustodyPasskeys(idbName) });
  /** A ward ask: a passphrase alone, for one act. A declined ask answers empty, and the ward then refuses `ward-needs-fresh-unlock`. */
  const askWard = async (act: string): Promise<string> => {
    const route = await door.ask({ kind: "ward", act });
    return route?.kind === "passphrase" ? route.passphrase : "";
  };
  const status = (s: VesselStatus): void => post({ t: "status", status: s });
  const reply = (callId: string, work: () => Promise<unknown>): void => {
    void work().then((value) => post({ t: "reply", callId, ok: true, value }), (err: unknown) => post({ t: "reply", callId, ok: false, error: errorOf(err) }));
  };

  /** A SharedWorker the page builds for this thread: the port it transfers back bridges to the one the holder door reads. */
  const standHolderSpawn = (): void => {
    if (typeof (globalThis as { SharedWorker?: unknown }).SharedWorker === "function") return;
    class PageBuiltSharedWorker {
      readonly port: MessagePort;
      readonly #errors = new Set<(e: unknown) => void>();
      constructor(url: string | URL, opts?: { name?: string }) {
        const channel = new MessageChannel();
        this.port = channel.port1;
        const spawnId = crypto.randomUUID();
        spawns.set(spawnId, (answer) => {
          if (!answer.port) { for (const listener of this.#errors) listener(new Error(answer.refused ?? "spawn-refused")); return; }
          const near = channel.port2, far = answer.port;
          near.onmessage = (e) => far.postMessage(e.data, [...e.ports]);
          far.onmessage = (e) => near.postMessage(e.data, [...e.ports]);
        });
        post({ t: "spawn", spawnId, role: "holder", url: String(url), name: opts?.name ?? "" });
      }
      addEventListener(type: string, listener: (e: unknown) => void): void { if (type === "error") this.#errors.add(listener); }
    }
    (globalThis as { SharedWorker?: unknown }).SharedWorker = PageBuiltSharedWorker;
  };

  const seedRestOf = async (idbName: string): Promise<{ seedRest: SeedRest; seedWrapClass?: string }> => {
    const custody = await readBrowserCustody(idbName);
    if (custody.reading === "sealed") return { seedRest: "wrapped-passphrase" };
    const wrap = await readBrowserSeedWrap(idbName, (await loadBrowserActivePersona()) ?? 0);
    return wrap ? { seedRest: "wrapped-prf", seedWrapClass: wrap.keyClass } : { seedRest: "open" };
  };

  const boot = async (hello: Extract<PageToVessel, { t: "hello" }>): Promise<void> => {
    const b = hello.boot;
    // THE BOOT'S CUSTODY STEP, before the vessel opens: a sealed keystore asks this tab's person for its unlock.
    const custody = await standBrowserCustody({ idbName: b.idbName, ask: askCustody("boot") });
    status({ custody: custody.reading });
    if (custody.reading === "declined" || custody.reading === "no-slot-opens" || custody.reading === "unreadable") {
      post({ t: "ended", why: `this browser's vessel stays locked (${custody.reading})`, stage: "custody" });
      return;
    }
    if (b.sharedHolderUrl) standHolderSpawn();
    const admit = b.admitCarriage ? parseAdmitCarriage(b.admitCarriage) : null;
    if (admit) console.log("[vessel] ADMIT taken from the fleet-join landing — this vessel JOINS an existing PersonaGroup.");
    let result: BrowserVesselResult;
    try {
      result = await openBrowserVessel({
        askCustody: askCustody("vessel"),
        askWardRoute: askWard,
        hostId: b.hostId,
        wikiId: b.wikiId,
        idbName: b.idbName,
        genesisSeed: b.genesisSeed,
        genesisCasBaseUrl: b.genesisCasBaseUrl,
        daemonWorkerUrl: new URL(b.daemonWorkerUrl),
        workerScriptUrl: new URL(b.workerScriptUrl),
        ...(b.sharedHolderUrl ? { sharedHolderUrl: new URL(b.sharedHolderUrl) } : {}),
        pageLife: (listener) => { lifeListeners.add(listener); return () => { lifeListeners.delete(listener); }; },
        onRest: (rest) => status({ rest }),
        onPhase: (phase) => post({ t: "phase", phase }),
        onFrame: (frame) => post({ t: "frame", frame }),
        onControlResult: (surface, result) => post({ t: "control-result", surface, result }),
        onCoherence: (frame) => post({ t: "coherence", frame }),
        onPortMessage: (binding, islandKey, msg) => post({ t: "port-msg", binding, islandKey, msg }),
        ...(b.relayUrl ? { relayUrl: b.relayUrl } : {}),
        ...(b.floorCard ? { floorCard: b.floorCard } : {}),
        ...(b.floorAnchor ? { floorAnchor: b.floorAnchor } : {}),
        ...(admit ? { admit } : {}),
        ...(b.meshLeaf ? { meshLeaf: { coordSeed: b.meshLeaf.coordSeed, peers: b.meshLeaf.peers.split(",").map((s) => parseMeshPeer(s.trim())).filter((p): p is MeshPeer => p !== null) } } : {}),
      });
    } catch (err) {
      post({ t: "ended", why: `boot failed: ${err instanceof Error ? err.message : String(err)}`, stage: "open" });
      return;
    }
    status({
      vessel: { verifyingKey: result.identity.verifyingKey, did: didFromVerifyingKey(result.identity.verifyingKey), activeWikiId: result.activeWikiId, wikiDocUrl: result.wikiDocUrl, oracleDocUrl: result.oracleDocUrl },
      connection: result.connectionState.getSnapshot(),
    });
    result.connectionState.subscribe((connection) => status({ connection }));
    // A landed fleet join leaves its pending row once the vessel stands on its admit.
    if (admit) void browserFleetJoinSettle().catch((err: unknown) => console.warn("[vessel] the landed fleet join did not settle:", err));
    void seedRestOf(b.idbName).then(status, () => { /* an unreadable slot reads its own refusal elsewhere */ });
    opened(result);
  };

  const join = {
    offer: async (text: string, abandonPending: boolean, idbName: string): Promise<unknown> => {
      // A JOIN MINTS FACE SECRETS (the face-scoped key, then the address secret): the slot binds first, in this tab.
      const custody = await standBrowserCustody({ idbName, ask: askCustody("fleet-join"), secretMintDue: true });
      if (custody.reading !== "bound" && custody.reading !== "opens" && custody.reading !== "held") {
        throw new Error(`this browser's custody reads ${custody.reading}; a fleet join mints a face's secrets only over a slot`);
      }
      if (abandonPending) await browserFleetJoinAbandon();
      const request = await browserFleetJoinRequest({ offer: JSON.parse(text) as unknown });
      return { kind: "request", text: JSON.stringify(request, null, 2) };
    },
    answer: async (text: string): Promise<unknown> => {
      const { admit } = await browserFleetJoinLand({ answer: JSON.parse(text) as unknown });
      return { kind: "landed", carriage: toAdmitCarriage(admit), signerDid: admit.signerDid };
    },
  };

  return {
    receive(msg: PageToVessel): void {
      switch (msg.t) {
        case "hello":
          if (booted) return;
          booted = true;
          idbName = msg.boot.idbName;
          void boot(msg).catch((err: unknown) => post({ t: "ended", why: `boot failed: ${err instanceof Error ? err.message : String(err)}`, stage: "open" }));
          return;
        case "ceremony:port": door.port(msg.askId, msg.port); return;
        case "ceremony:refused": door.refused(msg.askId, msg.refusal); return;
        case "spawned": { const settle = spawns.get(msg.spawnId); spawns.delete(msg.spawnId); settle?.(msg); return; }
        case "page:life": for (const listener of lifeListeners) listener(msg.life); return;
        case "control-event": void vessel.then((v) => v.sendControlEvent(msg.surface, msg.ev)); return;
        case "set-surface": void vessel.then((v) => v.setActiveSurface(msg.surface)); return;
        case "port:place":
          void vessel.then((v) => {
            const placed = v.ports.place(msg.surface, msg.binding, msg.msg);
            if (placed.ok) return;
            const m = msg.msg as { type?: unknown; portId?: unknown } | null;
            post({ t: "port:refused", binding: msg.binding, reason: placed.reason, opening: m?.type === "port:open",
              ...(typeof m?.portId === "string" ? { portId: m.portId } : {}) });
          });
          return;
        case "port:close": void vessel.then((v) => v.ports.close(msg.binding)); return;
        case "read:mirror-inputs": reply(msg.callId, async () => (await vessel).mirrorInputs(msg.surface)); return;
        case "read:floor": reply(msg.callId, async () => (await vessel).readFloor(msg.baseUrl)); return;
        case "join:offer": reply(msg.callId, async () => { await vessel; return join.offer(msg.text, msg.abandonPending, idbName); }); return;
        case "join:answer": reply(msg.callId, async () => { await vessel; return join.answer(msg.text); }); return;
        case "walk:restart":
          // A harness-only door, compiled out of every default build.
          if (!(typeof __LAR_WALK_DOOR__ !== "undefined" && __LAR_WALK_DOOR__)) { post({ t: "reply", callId: msg.callId, ok: false, error: { name: "Error", message: "walk-door-absent" } }); return; }
          reply(msg.callId, async () => { const v = await vessel; return { ...(await v.restartDaemonIsland(msg.reason)), leg: await v.daemon.syncLegReady() }; });
          return;
        case "walk:ward":
          // A harness-only door, compiled out of every default build: one ward act over the founding face's root, its
          // passphrase asked through the ceremony exactly as the promote board's acts ask it.
          if (!(typeof __LAR_WALK_DOOR__ !== "undefined" && __LAR_WALK_DOOR__)) { post({ t: "reply", callId: msg.callId, ok: false, error: { name: "Error", message: "walk-door-absent" } }); return; }
          reply(msg.callId, async () => { await vessel; return browserWardSign(idbName, 0, await askWard("a walk ward act"), msg.bytes); });
          return;
      }
    },
  };
}
