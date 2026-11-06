/**
 * vessel-host — the vessel worker's body: `openBrowserVessel`, unchanged, on this worker's own thread, served to one page
 * over its port (lar:///ha.ka.ba/lares/docs/pono/browser-vessel-lift#/the-slices). The messages read in
 * `../vessel-protocol.ts`; every key, store and ceremony stays on this thread, and the page receives public readings,
 * frames and port traffic alone.
 *
 * The islands (daemon, wiki) spawn nested from this worker. The shared holder (`?holder`) runs in a SharedWorker, which a
 * dedicated worker cannot construct, so this thread asks the page to build it (`spawn`) and bridges its transferred port;
 * the page never reads that port.
 *
 * Every custody and ward ask rides the ceremony door (`ceremony-door.ts`): the page hears the ask's public words and opens
 * the ceremony document, and the answer arrives on the ceremony's own brokered port, never on the page's.
 *
 * EACH PORT OPENS A SESSION (`@lararium/browser` vessel-sessions.ts, slice 3). The host stands one house per store: it takes
 * the store's owner lock (a second worker refuses `store-owned`), opens a session at each port's `hello`, and admits that
 * session by its own unlock through the ceremony. The face's first admitted session lights the vessel; every request waits
 * on its own session's admission and answers by name where none stands (`session-unadmitted`) or where the vessel rests at
 * its floor (`signer-unavailable`). The face's last admitted session closing (`pagehide`, a lost port, the house's liveness
 * budget) runs the lock and the vessel returns to its floor. Surface traffic (frames, phases, port messages) reaches the
 * surface session alone: the session that lit the vessel, then the oldest admitted session after it.
 *
 * EVERY ASK NAMES ITS FACE (slice 3 part ii): each custody and ward ask carries the face its session wears to the ceremony
 * (the PersonaGroup; null names this browser itself, the place custody a fresh browser binds at its founding), and the door
 * refuses an ask that names none.
 *
 * EACH SESSION WEARS THE FACE ITS HELLO NAMES: the tab's own selection (a PersonaGroup), or, with none named, the one face the
 * store names (none on a fresh browser, whose founding session then wears the face it founds). A hint grants nothing: the
 * session admits by that face's own unlock, whose one route also opens the place tree. The face's first admitted session
 * lights its provider through the lit vessel's provider door, and its last drops it. A fleet join binds the joinee face's own
 * tree (or opens it) before the join mints its first secret, and the landed answer names the face the tab selects next.
 */
declare const __LAR_WALK_DOOR__: boolean;
import {
  openBrowserVessel, readBrowserCustody, readBrowserSeedWrap, loadBrowserActivePersona,
  parseAdmitCarriage, toAdmitCarriage, readBrowserCustodyPasskeys, readFaceCustodyPasskeys, browserWardSign,
  browserFleetJoinRequest, browserFleetJoinLand, browserFleetJoinSettle, browserFleetJoinAbandon, BrowserFleetJoinRefused,
  standVesselHouse, sessionLifetimeLock, VesselSessionRefused, readBrowserVesselFaces, readFaceCustody, bindFirstFaceSlot, unlockFaceCustody,
  type BrowserVesselResult, type CustodyAnswer, type CustodyAsk, type HouseAsk, type PageLife, type VesselHouse, type VesselSession, type LockHost,
} from "@lararium/browser";
import { didFromVerifyingKey, parseMeshPeer, type MeshPeer } from "@lararium/mesh";
import type { PageToVessel, SeedRest, VesselBoot, VesselError, VesselStatus, VesselToPage } from "../vessel-protocol.js";
import { CeremonyRefused, standCeremonyDoor } from "./ceremony-door.js";

export interface VesselScope {
  postMessage(msg: VesselToPage, transfer?: Transferable[]): void;
}

const errorOf = (err: unknown): VesselError => ({
  name: err instanceof Error ? err.name : "Error",
  message: err instanceof Error ? err.message : String(err),
  ...(err instanceof BrowserFleetJoinRefused || err instanceof CeremonyRefused || err instanceof VesselSessionRefused ? { refusal: err.refusal } : {}),
});

export interface VesselHostEnv {
  /** `navigator.locks` by default. */
  readonly locks?: LockHost | null;
  /** The house's liveness budget on its own clock; a session silent past it for three sweeps drops. Default 60 s. */
  readonly livenessBudgetMs?: number;
  /** The vessel the house lights (`openBrowserVessel` by default; a host witness hands a stand-in). */
  readonly openVessel?: typeof openBrowserVessel;
}

const BOOT_READING = { unlock: "opens", "bind-first": "bound", clear: "clear" } as const;

/** Stand the vessel host: one house per store, one session per connected port. */
export function standVesselHost(env: VesselHostEnv = {}) {
  type Conn = { readonly post: (msg: VesselToPage, transfer?: Transferable[]) => void; readonly door: ReturnType<typeof standCeremonyDoor>; session: VesselSession | null; pings: number };
  const conns = new Map<string, Conn>();
  const spawns = new Map<string, (answer: Extract<PageToVessel, { t: "spawned" }>) => void>();
  const lifeListeners = new Set<(life: PageLife) => void>();
  let house: Promise<VesselHouse<BrowserVesselResult>> | null = null;
  /** The lit vessel, for its provider door. */
  let litVessel: BrowserVesselResult | null = null;
  let firstBoot: VesselBoot | null = null;
  let idbName = "lares:vessel";
  /** The session whose page shows the vessel's surface. */
  let surface: string | null = null;

  const surfacePost = (msg: VesselToPage, transfer: Transferable[] = []): void => {
    const conn = surface ? conns.get(surface) : undefined;
    conn?.post(msg, transfer);
  };
  const statusTo = (conn: Conn | undefined, s: VesselStatus): void => conn?.post({ t: "status", status: s });
  const moveSurface = (): void => {
    if (surface && conns.get(surface)?.session?.admission === "admitted") return;
    surface = [...conns.entries()].find(([, c]) => c.session?.admission === "admitted")?.[0] ?? null;
  };

  const wordsOf = (question: CustodyAsk | HouseAsk | { readonly kind: "clear" }): string =>
    question.kind === "unlock" ? `attempt ${String(question.attempt)} of ${String(question.of)}${question.notes.length ? ` — ${question.notes.join("; ")}` : ""}` : "";
  /** A custody ask through one session's ceremony door: the ceremony offers a passkey route beside the passphrase wherever a passkey pin stands. */
  const askCustodyOf = (conn: Conn, act: string) => async (question: HouseAsk | CustodyAsk | { readonly kind: "clear" }): Promise<CustodyAnswer> => {
    // A house ask names its face; the vessel's own custody asks (its boot, the fleet join) speak for the session's face.
    const face = "face" in question ? question.face : conn.session?.face ?? null;
    const passkeys = question.kind === "bind-first" ? [] : face === null ? await readBrowserCustodyPasskeys(idbName) : await readFaceCustodyPasskeys(idbName, face);
    return conn.door.ask({ kind: question.kind, act, words: wordsOf(question), face, passkeys });
  };
  /** A ward ask: a passphrase alone, for one act. A declined ask answers empty, and the ward then refuses `ward-needs-fresh-unlock`. */
  const askWardOf = (conn: Conn) => async (act: string): Promise<string> => {
    const route = await conn.door.ask({ kind: "ward", act, face: conn.session?.face ?? null });
    return route?.kind === "passphrase" ? route.passphrase : "";
  };

  /** A SharedWorker the page builds for this thread: the port it transfers back bridges to the one the holder door reads. */
  const standHolderSpawn = (post: (msg: VesselToPage) => void): void => {
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

  const vesselStatus = (result: BrowserVesselResult): VesselStatus => ({
    vessel: { verifyingKey: result.identity.verifyingKey, did: didFromVerifyingKey(result.identity.verifyingKey), activeWikiId: result.activeWikiId, wikiDocUrl: result.wikiDocUrl, oracleDocUrl: result.oracleDocUrl },
    connection: result.connectionState.getSnapshot(),
  });

  /** Light the vessel for the face's first admitted session, on the first hello's public inputs. */
  const light = async (first: VesselSession): Promise<BrowserVesselResult> => {
    const conn = conns.get(first.sessionId);
    const b = firstBoot;
    if (!conn || !b) throw new VesselSessionRefused("unknown-session");
    surface = first.sessionId;
    if (b.sharedHolderUrl) standHolderSpawn((msg) => surfacePost(msg));
    const admit = b.admitCarriage ? parseAdmitCarriage(b.admitCarriage) : null;
    if (admit) console.log("[vessel] ADMIT taken from the fleet-join landing — this vessel JOINS an existing PersonaGroup.");
    const result = await (env.openVessel ?? openBrowserVessel)({
      face: first.face,
      askCustody: askCustodyOf(conn, "vessel"),
      askWardRoute: askWardOf(conn),
      hostId: b.hostId,
      wikiId: b.wikiId,
      idbName: b.idbName,
      genesisSeed: b.genesisSeed,
      genesisCasBaseUrl: b.genesisCasBaseUrl,
      daemonWorkerUrl: new URL(b.daemonWorkerUrl),
      workerScriptUrl: new URL(b.workerScriptUrl),
      ...(b.sharedHolderUrl ? { sharedHolderUrl: new URL(b.sharedHolderUrl) } : {}),
      pageLife: (listener) => { lifeListeners.add(listener); return () => { lifeListeners.delete(listener); }; },
      onRest: (rest) => surfacePost({ t: "status", status: { rest } }),
      onPhase: (phase) => surfacePost({ t: "phase", phase }),
      onFrame: (frame) => surfacePost({ t: "frame", frame }),
      onControlResult: (surfaceId, result) => surfacePost({ t: "control-result", surface: surfaceId, result }),
      onCoherence: (frame) => surfacePost({ t: "coherence", frame }),
      onPortMessage: (binding, islandKey, msg) => surfacePost({ t: "port-msg", binding, islandKey, msg }),
      ...(b.relayUrl ? { relayUrl: b.relayUrl } : {}),
      ...(b.floorCard ? { floorCard: b.floorCard } : {}),
      ...(b.floorAnchor ? { floorAnchor: b.floorAnchor } : {}),
      ...(admit ? { admit } : {}),
      ...(b.meshLeaf ? { meshLeaf: { coordSeed: b.meshLeaf.coordSeed, peers: b.meshLeaf.peers.split(",").map((s) => parseMeshPeer(s.trim())).filter((p): p is MeshPeer => p !== null) } } : {}),
    });
    litVessel = result;
    result.connectionState.subscribe((connection) => { for (const c of conns.values()) if (c.session?.admission === "admitted") statusTo(c, { connection }); });
    // A landed fleet join leaves its pending row once the vessel stands on its admit.
    if (admit) void browserFleetJoinSettle().catch((err: unknown) => console.warn("[vessel] the landed fleet join did not settle:", err));
    return result;
  };

  const houseFor = (b: VesselBoot): Promise<VesselHouse<BrowserVesselResult>> => {
    if (house) return house;
    firstBoot = b;
    idbName = b.idbName;
    house = standVesselHouse<BrowserVesselResult>({
      idbName: b.idbName,
      ...(env.locks !== undefined ? { locks: env.locks } : {}),
      livenessBudgetMs: env.livenessBudgetMs ?? 60_000,
      light,
      // THE PROVIDER DOOR: one Keyhive provider per face, through the lit vessel (K19).
      providers: {
        lit: async (face) => { if (!litVessel) throw new VesselSessionRefused("signer-unavailable"); return litVessel.faceProviders.lit(face); },
        drop: async (face, why) => litVessel?.faceProviders.drop(face, why),
      },
      onFloor: (s, floor) => { if (floor === "floor") litVessel = null; statusTo(conns.get(s.sessionId), { floor }); },
      onDrop: (s, why) => {
        const conn = conns.get(s.sessionId);
        if (conn) conn.session = null;
        if (surface === s.sessionId) { surface = null; moveSurface(); }
        console.log(`[vessel] session ${s.sessionId.slice(0, 8)} closed (${why})`);
      },
      ping: (s) => { const c = conns.get(s.sessionId); if (c) c.post({ t: "ping", n: ++c.pings }); },
    });
    return house;
  };

  /** One session's admission: its own unlock through its own ceremony door, then the lit vessel's public readings. */
  const admitSession = async (conn: Conn, h: VesselHouse<BrowserVesselResult>, session: VesselSession): Promise<BrowserVesselResult> => {
    let result: BrowserVesselResult;
    try {
      result = await h.admit(session.sessionId, { ask: askCustodyOf(conn, "boot") });
    } catch (err) {
      const refusal = err instanceof VesselSessionRefused ? err.refusal : null;
      const reading = refusal === "admission-declined" ? "declined" : refusal === "no-slot-opens" ? "no-slot-opens" : refusal === "custody-unreadable" ? "unreadable" : null;
      if (reading) {
        statusTo(conn, { custody: reading });
        conn.post({ t: "ended", why: `this browser's vessel stays locked (${reading})`, stage: "custody" });
      } else {
        conn.post({ t: "ended", why: `boot failed: ${err instanceof Error ? err.message : String(err)}`, stage: "open", ...(refusal ? { refusal } : {}) });
      }
      throw err;
    }
    statusTo(conn, { custody: session.admittedBy ? BOOT_READING[session.admittedBy] : "held", ...(session.face ? { face: session.face } : {}) });
    moveSurface();
    statusTo(conn, vesselStatus(result));
    void seedRestOf(idbName).then((s) => statusTo(conn, s), () => { /* an unreadable slot reads its own refusal elsewhere */ });
    return result;
  };

  /** The joinee face's tree, bound before the join's first secret or opened by this session's own route, asked naming the face. */
  const standJoineeFace = async (conn: Conn, face: string): Promise<void> => {
    const status = await readFaceCustody(idbName, face);
    if (status.reading === "unreadable") throw new Error(`the joinee face's tree does not read (${status.why})`);
    if (status.reading === "bound" && status.unlocked) return;
    const ask = askCustodyOf(conn, "fleet-join");
    if (status.reading === "absent") {
      const route = await ask({ kind: "bind-first", why: "face-secret-mint-due", face });
      if (route === null) throw new VesselSessionRefused("admission-declined");
      // A face's first slot binds a human route: a passkey binds beside one, never alone.
      if (route.kind === "passkey") throw new Error("keyslot: passkey-alone-refused");
      await bindFirstFaceSlot(idbName, face, route);
      return;
    }
    const route = await ask({ kind: "unlock", attempt: 1, of: 1, notes: [], face });
    if (route === null) throw new VesselSessionRefused("admission-declined");
    if ((await unlockFaceCustody(idbName, face, [route])).reading !== "opens") throw new VesselSessionRefused("no-slot-opens");
  };

  const join = {
    offer: async (conn: Conn, text: string, abandonPending: boolean): Promise<unknown> => {
      // A JOIN MINTS FACE SECRETS (the atom, the face-scoped key, then the address secret) under the JOINEE face's own tree:
      // that tree binds first (or opens), in this tab, before the join's first secret.
      const offer = JSON.parse(text) as unknown;
      const group = (offer as { personaGroup?: unknown } | null)?.personaGroup;
      if (typeof group !== "string" || group.length === 0) throw new Error("the offer names no face; a fleet join joins one PersonaGroup");
      await standJoineeFace(conn, group);
      if (abandonPending) await browserFleetJoinAbandon(idbName, group);
      const request = await browserFleetJoinRequest({ offer, idbName });
      return { kind: "request", text: JSON.stringify(request, null, 2) };
    },
    answer: async (text: string): Promise<unknown> => {
      const { admit } = await browserFleetJoinLand({ answer: JSON.parse(text) as unknown, idbName });
      return { kind: "landed", carriage: toAdmitCarriage(admit), signerDid: admit.signerDid, face: admit.personaGroupId };
    },
  };

  return {
    /** Connect one page port: its `hello` opens a session; the caller feeds every page message, in order, to `receive`. */
    connect(scope: VesselScope): { receive(msg: PageToVessel): void; lost(why: string): void } {
      const post = (msg: VesselToPage, transfer: Transferable[] = []): void => scope.postMessage(msg, transfer);
      const conn: Conn = { post, door: standCeremonyDoor(post), session: null, pings: 0 };
      let admitted: Promise<{ h: VesselHouse<BrowserVesselResult>; s: VesselSession }> | null = null;
      let helloed = false;

      /** This session's lit vessel, once its own admission stands; refused by name otherwise. */
      const vessel = async (): Promise<BrowserVesselResult> => {
        if (!admitted) throw new VesselSessionRefused("session-unadmitted");
        const { h, s } = await admitted.catch(() => { throw new VesselSessionRefused("session-unadmitted"); });
        return h.require(s.sessionId);
      };
      const reply = (callId: string, work: () => Promise<unknown>): void => {
        void work().then((value) => post({ t: "reply", callId, ok: true, value }), (err: unknown) => post({ t: "reply", callId, ok: false, error: errorOf(err) }));
      };
      const refusedQuietly = (what: string) => (err: unknown): void => { console.warn(`[vessel] ${what} refused:`, err instanceof Error ? err.message : err); };

      const hello = async (msg: Extract<PageToVessel, { t: "hello" }>): Promise<void> => {
        let h: VesselHouse<BrowserVesselResult>;
        try { h = await houseFor(msg.boot); } catch (err) {
          const refusal = err instanceof VesselSessionRefused ? err.refusal : undefined;
          post({ t: "ended", why: `this vessel worker cannot own the store: ${err instanceof Error ? err.message : String(err)}`, stage: "open", ...(refusal ? { refusal } : {}) });
          return;
        }
        let refused: string | undefined;
        let s: VesselSession;
        // THE FACE THE TAB SELECTED, or the one face the store names: a hint, which the face's own unlock decides.
        let face: string | null = typeof msg.face === "string" && msg.face.length > 0 ? msg.face : null;
        if (face === null) {
          const faces = await readBrowserVesselFaces(idbName);
          if (faces.length > 1) { post({ t: "ended", why: "this browser holds several faces; the tab names the one it wears", stage: "open", refusal: "face-not-named" }); return; }
          face = faces[0] ?? null;
        }
        try { s = h.open({ tabId: msg.tabSession, face, ...(msg.resume ? { resume: msg.resume } : {}) }); } catch (err) {
          if (err instanceof VesselSessionRefused && err.refusal !== "stale-owner-epoch" && err.refusal !== "unknown-session") {
            post({ t: "ended", why: `this session's face refuses: ${err.message}`, stage: "open", refusal: err.refusal });
            return;
          }
          // NO TAB TRUSTS AN EARLIER GREETING: the stale one refuses by name, and the tab opens afresh and asks again.
          refused = err instanceof VesselSessionRefused ? err.refusal : String(err);
          s = h.open({ tabId: msg.tabSession, face });
        }
        conn.session = s;
        conns.set(s.sessionId, conn);
        post({ t: "greeting", ownerEpoch: s.ownerEpoch, sessionId: s.sessionId, lifetimeLock: sessionLifetimeLock(s.sessionId), ...(refused ? { refused } : {}) });
        statusTo(conn, { floor: h.floor() });
        admitted = admitSession(conn, h, s).then(() => ({ h, s }));
        admitted.catch(() => { /* named to the page already */ });
      };

      const close = (why: string): void => {
        const s = conn.session;
        if (!s) return;
        void (house ?? Promise.reject(new Error("no house"))).then((h) => h.close(s.sessionId, why)).catch(refusedQuietly("the session's close"));
      };

      return {
        lost: close,
        receive(msg: PageToVessel): void {
          if (conn.session) void house?.then((h) => { if (conn.session) h.heard(conn.session.sessionId); });
          switch (msg.t) {
            case "hello":
              if (helloed) return;
              helloed = true;
              void hello(msg).catch((err: unknown) => post({ t: "ended", why: `boot failed: ${err instanceof Error ? err.message : String(err)}`, stage: "open" }));
              return;
            case "session:armed": {
              const s = conn.session;
              if (s && s.sessionId === msg.sessionId) void house?.then((h) => h.watch(s.sessionId, sessionLifetimeLock(s.sessionId)));
              return;
            }
            case "pong": return;
            case "ceremony:port": conn.door.port(msg.askId, msg.port); return;
            case "ceremony:refused": conn.door.refused(msg.askId, msg.refusal); return;
            case "spawned": { const settle = spawns.get(msg.spawnId); spawns.delete(msg.spawnId); settle?.(msg); return; }
            case "page:life":
              for (const listener of lifeListeners) listener(msg.life);
              // A LEAVING PAGE CLOSES ITS SESSION; the face's last one runs the lock. A hidden page keeps its session.
              if (msg.life === "pagehide") close("pagehide");
              return;
            case "control-event": void vessel().then((v) => v.sendControlEvent(msg.surface, msg.ev)).catch(refusedQuietly("a control event")); return;
            case "set-surface": void vessel().then((v) => v.setActiveSurface(msg.surface)).catch(refusedQuietly("a surface switch")); return;
            case "port:place":
              void vessel().then((v) => v.ports.place(msg.surface, msg.binding, msg.msg), (err: unknown) => ({ ok: false as const, reason: err instanceof VesselSessionRefused ? err.refusal : String(err) })).then((placed) => {
                if (placed.ok) return;
                const m = msg.msg as { type?: unknown; portId?: unknown } | null;
                post({ t: "port:refused", binding: msg.binding, reason: placed.reason, opening: m?.type === "port:open",
                  ...(typeof m?.portId === "string" ? { portId: m.portId } : {}) });
              });
              return;
            case "port:close": void vessel().then((v) => v.ports.close(msg.binding)).catch(refusedQuietly("a port close")); return;
            case "read:mirror-inputs": reply(msg.callId, async () => (await vessel()).mirrorInputs(msg.surface)); return;
            case "read:floor": reply(msg.callId, async () => (await vessel()).readFloor(msg.baseUrl)); return;
            case "join:offer": reply(msg.callId, async () => { await vessel(); return join.offer(conn, msg.text, msg.abandonPending); }); return;
            case "join:answer": reply(msg.callId, async () => { await vessel(); return join.answer(msg.text); }); return;
            case "walk:restart":
              // A harness-only door, compiled out of every default build.
              if (!(typeof __LAR_WALK_DOOR__ !== "undefined" && __LAR_WALK_DOOR__)) { post({ t: "reply", callId: msg.callId, ok: false, error: { name: "Error", message: "walk-door-absent" } }); return; }
              reply(msg.callId, async () => { const v = await vessel(); return { ...(await v.restartDaemonIsland(msg.reason)), leg: await v.daemon.syncLegReady() }; });
              return;
            case "walk:ward":
              // A harness-only door, compiled out of every default build: one ward act over the founding face's root, its
              // passphrase asked through the ceremony exactly as the promote board's acts ask it.
              if (!(typeof __LAR_WALK_DOOR__ !== "undefined" && __LAR_WALK_DOOR__)) { post({ t: "reply", callId: msg.callId, ok: false, error: { name: "Error", message: "walk-door-absent" } }); return; }
              reply(msg.callId, async () => { const v = await vessel(); return browserWardSign(idbName, conn.session?.face ?? v.face, await askWardOf(conn)("a walk ward act"), msg.bytes); });
              return;
          }
        },
      };
    },
  };
}

/** Serve one page: the caller feeds every page message, in order, to the returned `receive`. */
export function serveVessel(scope: VesselScope, env: VesselHostEnv = {}): { receive(msg: PageToVessel): void } {
  return standVesselHost(env).connect(scope);
}
