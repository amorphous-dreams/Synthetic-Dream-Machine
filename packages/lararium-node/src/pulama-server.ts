/**
 * pulama-server — THE PŪLAMA: the keeper that holds a vessel's custody through the vessel's rebuild.
 *
 * The pūlama owns the one custody holder (`custody-holder`) over the hearth's homes. The operator lights it by their own
 * hand; each rebuilt vessel (a kūkulu) then dials it and asks record operations and derivations (`pulama-wire`). The keys
 * stay in the holder's closure: no frame this server writes carries the vessel key, the serving key, the custody root, a
 * face's custody key or a ward key.
 *
 * ── A HELLO PASSES THE GATE BEFORE ANYTHING SERVES ──────────────────────────────────────────────
 * A channel's first frame carries its offer. An unlit pūlama refuses `pulama-locked` and asks the gate nothing. Lit, the
 * gate (`PulamaGate`, the kūkulu gate in the product) reads the offer and answers the session's scope or a refusal by
 * reading. The gate claims the lei's return before it answers, so nothing serves ahead of the claim.
 *
 * ── THE SESSION SERVES A WORKING VESSEL AND NOTHING A HUMAN ROUTE GUARDS ────────────────────────
 *   hot rows       read, write, update, move, remove, and the two claims (`withRecords`, `exclusive`)
 *   face rows      of the faces the pūlama lends this vessel (`LentFaces`, the lend); a face outside the set refuses
 *                  `outside-the-lei`, naming the set. The standing a session carries names open only the lent faces that
 *                  stand lit and names the lent faces still dark as waiting, so a vessel walking its open faces asks no
 *                  row outside the lend. A lend always names its faces: a scope with no set refuses the hello by name.
 *   cold rows      refuse `needs-the-human`, but for a READ of a row the scope's `coldReads` names (the rows a boot to
 *                  composition reads unattended); a cold write, a cold removal and every other cold row refuse
 *   warded rows    refuse `needs-the-human`: a ward opens only fresh from a human route
 *   derivations    the children under the domains `derives` names, carried in the session frame; no other domain derives
 *   `rite.land`    the vessel says it composed over its session; the pūlama rests the host half of the tessera the gate
 *                  began, once (the scope's `land`), and answers whether the pair reads par
 *   `face.worn`    the vessel's wear door names the face it now wears, by ordinal and nothing beside it: the pūlama keeps
 *                  that one ordinal in its own memory (never on disk) and hands it back in the standing of every session
 *                  it serves after, so a vessel that restarts wears the face again. An ordinal outside the session's lend
 *                  refuses `outside-the-lei`. The lock forgets it, as a restart does: a fresh light remembers no wear.
 *   `face.closed`  THE VESSEL'S HALF OF A TWO-PHASE CLOSE: it names the face (by custody id) and the opening the pūlama's
 *                  `closing` named, once its face actor stopped serving that face. The pūlama locks the key when every
 *                  session it told has answered. The answer names nothing: a face outside the lend, an unknown id, a face
 *                  not closing and a stale opening all answer `null` alike.
 *   everything else (an unlock, a proof for a backup, an adoption, a founding, a ward act, a lock) holds no
 *                  operation here and refuses `needs-the-human`
 *
 * ── A FACE CLOSES IN TWO PHASES ─────────────────────────────────────────────────────────────────
 * No global now: a vessel cannot learn of a lock by sampling, since every sample arrives old. So the pūlama never locks a lent
 * face first. `closeFace` sends `{t:"closing", fcid, opening}` to every session that lends it, keeps the key (its rows still
 * serve the vessel's drain) and names the face closing in every standing; each vessel answers `face.closed` once its face actor
 * stopped admitting, refused its undelivered visits, drained its saves and told its island. Only then does the key lock. A
 * face no session lends locks at once. A vessel that never answers leaves the face closing with no clock: `closing()` names it
 * ("the vessel has not answered its close") with its clearing line: a close asked again tells each unanswered session again (a
 * vessel whose drain faulted drains again) and every live session that lends the face, a late one included; a session that ends
 * unanswered counts dropped, and a close any session dropped locks only by the operator's hand; and the operator's hand confirms a
 * forced lock (`closeFace(face, {force})`). The
 * forced lock's window runs from the `closing` to the moment that vessel hears it: the causal-islands residue, named in
 * sealed-store#/the-lit-set. A whole-holder `lock` drops every session at once, and acts as the operator's hand.
 *
 * ── THE SESSION DROPS WITH ITS CHANNEL ──────────────────────────────────────────────────────────
 * A closed channel ends its session: every claim it held releases, and nothing it asked afterwards answers. `lock` drops
 * every session, then locks the holder, which waits out the work in flight and zero-fills every key. The process's exit
 * runs the same lock.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { isLent, lentFacesOf, lentFacesWire, renderLentFaces, servedOf, type LentFaces } from "@lararium/mesh";
import type { CustodyHolder, FaceRef, RecordReading } from "./custody-holder.js";
import { readFaceIndexSync } from "./face-index.js";
import { PulamaRefused, copyReading, packRefusal, readingOf, sameBytes, sameReading, type PulamaChannel, type PulamaFrame } from "./pulama-wire.js";
import { carrierTable, type CustodyHome, type FaceSelector } from "./vault-carriers.js";

/** What one session serves. */
export interface PulamaScope {
  /** The faces the pūlama lends this vessel: never empty, so no scope serves every face. A face named by custody id
   *  serves only while the face index names that id at its ordinal. */
  readonly faces: LentFaces;
  /** The faces the gate read and left out of the lend, each with its reading (a face whose lei is missing waits by name). */
  readonly unlent?: ReadonlyArray<{ readonly ordinal: number; readonly reading: string }>;
  /** The carrier rows (by row name) whose COLD plaintext the session may read; every other cold row refuses. */
  readonly coldReads: readonly string[];
  /** Rest the host half of the tessera this session began under, once the vessel composed; absent where the gate began no rite. */
  readonly land?: () => Promise<{ readonly par: boolean }>;
}

/** The gate a hello passes: it reads the offer, claims what the offer spends, and answers the scope or a refusal's reading. */
export interface PulamaGate {
  admit(offer: unknown): Promise<{ readonly ok: true; readonly scope: PulamaScope } | { readonly ok: false; readonly reading: string; readonly why?: string }>;
}

export interface PulamaServer {
  /** Take one channel: its hello, then its session. */
  accept(channel: PulamaChannel): void;
  /** Drop every session, then lock the holder: its keys zero-fill. */
  lock(): Promise<void>;
  /** Tell every session the holder's standing moved (a face opened or shut at the hand door). */
  refresh(): void;
  /**
   * THE FIRST PHASE OF A FACE'S CLOSE: tell every session that lends face `ordinal` it closes, and lock the key once each one
   * answered `face.closed`. `force` (the operator's hand) locks now, whoever has not answered.
   */
  closeFace(ordinal: number, options?: { readonly force?: boolean }): Promise<FaceCloseAnswer>;
  /** The faces closing now, each with how many sessions have not answered its close. */
  closing(): ReadonlyArray<{ readonly face: number; readonly unanswered: number; readonly note: string }>;
  sessions(): number;
}

/** What a face's close answers: locked now, closing (sessions still to answer), already shut, or no such face. */
export type FaceCloseAnswer =
  | { readonly reading: "locked"; readonly face: number; readonly forced?: true }
  | { readonly reading: "closing"; readonly face: number; readonly unanswered: number }
  | { readonly reading: "face-locked" | "face-absent"; readonly face: number };

type RecordClass =
  | { readonly kind: "node"; readonly cold: boolean; readonly row: string }
  | { readonly kind: "face"; readonly cold: boolean; readonly row: string; readonly selector: Exclude<FaceSelector, null> }
  | { readonly kind: "warded" }
  | { readonly kind: "unknown" };

/** Which carrier row a `(home, file)` names, as the holder's own resolver reads the table. */
function classify(home: CustodyHome, file: string): RecordClass {
  const table = carrierTable();
  const node = table.find((r) => {
    if (r.home !== home || (r.custody !== "hot" && r.custody !== "cold")) return false;
    r.match.lastIndex = 0;
    return r.match.test(file);
  });
  if (node) return { kind: "node", cold: node.custody === "cold", row: node.row };
  if (home !== "identity") return { kind: "unknown" };
  if (table.some((r) => r.custody === "ward-cold" && r.faceRecord !== undefined && r.faceRecord.inner.test(file))) return { kind: "warded" };
  const face = table.find((r) => r.faceRecord !== undefined && r.faceRecord.select !== null && r.faceRecord.inner.test(file));
  const selector = face ? face.faceRecord!.select(face.faceRecord!.inner.exec(file)!) : null;
  if (!face || selector === null) return { kind: "unknown" };
  return { kind: "face", cold: face.custody === "face-cold", row: face.row, selector };
}

const HOMES: ReadonlySet<string> = new Set(["identity", "storage", "seal"]);

interface Claim { records: Parameters<Parameters<CustodyHolder["withRecords"]>[0]>[0] | null; readonly end: () => void; done: Promise<unknown> }
interface Session { readonly channel: PulamaChannel; readonly scope: PulamaScope; readonly claims: Map<number, Claim>; open: boolean }

export function servePulama(a: {
  readonly holder: CustodyHolder;
  readonly gate: PulamaGate;
  /** The registered domains a session's children derive under. */
  readonly derives: readonly string[];
  readonly onLog?: (line: string) => void;
}): PulamaServer {
  const { holder } = a;
  const log = a.onLog ?? (() => {});
  const live = new Set<Session>();
  let nextClaim = 1;
  /** The face a vessel's wear door last wore, by ordinal: memory alone, forgotten at the lock. */
  let worn: number | undefined;
  /**
   * THE FACES CLOSING, by custody id: the opening the close names, the sessions still to answer it, and how many told sessions
   * ended unanswered (`dropped`). A dropped session's vessel may still hold a save it never sealed, and no later session proves
   * it the same vessel, so a close any session dropped locks only by the operator's hand (`force`), never by the others' answers.
   */
  const closings = new Map<string, { readonly ordinal: number; readonly opening: string | null; awaiting: Set<Session>; dropped: number; locking: Promise<void> | null }>();

  /** Whether the session's lend names this face: its ordinal in the set, and its custody id where the set names one. */
  /** Whether a face closes and `s` stands outside the sessions its close told: such a session reads the face shut. */
  const closedTo = (s: Session, fcid: string): boolean => { const held = closings.get(fcid); return held !== undefined && !held.awaiting.has(s); };
  const lends = (s: { readonly scope: PulamaScope }, face: { readonly ordinal: number; readonly fcid: string }): boolean =>
    isLent(s.scope.faces, face.ordinal) && s.scope.faces.every((f) => f.ordinal !== face.ordinal || f.fcid === undefined || f.fcid === face.fcid);
  /** The holder's standing as one session reads it: the lent faces that stand lit (by custody id) serve, the lent faces
   *  still dark wait (by ordinal), and a lit face outside the lend never shows. */
  const standing = (s: Session) => {
    const open = new Set(holder.unlockedFaces());
    const index = readFaceIndexSync(holder.homes.identity).faces;
    const fcidAt = (ordinal: number): string | null => { const f = index[ordinal]; return f !== undefined && "fcid" in f ? f.fcid : null; };
    // A FACE CLOSING SERVES ONLY THE SESSIONS ITS CLOSE TOLD (they drain under it); any other session, one admitted after the
    // close among them, reads it shut, so it never lights the face and never stands outside the close's answer set.
    const lit = s.scope.faces.flatMap((f) => { const fcid = fcidAt(f.ordinal); return fcid !== null && open.has(fcid) && !closedTo(s, fcid) && lends(s, { ordinal: f.ordinal, fcid }) ? [f.ordinal] : []; });
    const { served, waiting } = servedOf(s.scope.faces, lit);
    const faces = served.map((f) => fcidAt(f.ordinal)!);
    // EACH SERVED FACE'S OPENING, as this holder numbers it (`faceOpening`): a lock and re-lend here carries a new number, so the
    // vessel reads the opening from its source and never infers it from the membership it happened to observe.
    const openings = Object.fromEntries(faces.flatMap((fcid) => { const n = holder.faceOpening?.(fcid); return typeof n === "string" ? [[fcid, n]] : []; }));
    // A face closing still serves the told sessions' rows (each vessel drains under it), and the standing names it closing.
    const closingNow = s.scope.faces.flatMap((f) => { const fcid = fcidAt(f.ordinal); return fcid !== null && closings.has(fcid) ? [fcid] : []; });
    return { slot: holder.openedSlot(), attemptsLeft: holder.attemptsLeft(), faces, openings, waiting: waiting.map((f) => f.ordinal),
      ...(closingNow.length ? { closing: closingNow } : {}), ...(worn !== undefined ? { worn } : {}) };
  };
  /** The session's children, fresh; `send` encodes them before the copies zero-fill. */
  const withDerived = (send: (derived: Record<string, Uint8Array>) => void): void => {
    const derived: Record<string, Uint8Array> = {};
    try {
      for (const domain of a.derives) derived[domain] = holder.derive(domain);
      send(derived);
    } finally { for (const child of Object.values(derived)) child.fill(0); }
  };

  const end = (s: Session): void => {
    if (!s.open) return;
    s.open = false;
    live.delete(s);
    for (const claim of s.claims.values()) claim.end();
    s.claims.clear();
    // A SESSION THAT ENDS ANSWERS NO CLOSE: it leaves each close's unanswered set and counts dropped there, so the others'
    // answers never lock the key over a save its vessel may still hold; that close waits on the operator's hand.
    for (const held of closings.values()) if (held.awaiting.delete(s)) held.dropped += 1;
    try { s.channel.close(); } catch { /* already gone */ }
    log("session dropped");
  };

  /** THE SCOPE'S READING of one row, before the holder is asked: a refusal by name, or nothing. */
  const guard = async (s: Session, home: CustodyHome, file: string, use: "hot" | "cold-read" | "cold-write"): Promise<void> => {
    const c = classify(home, file);
    if (c.kind === "unknown") return;                      // the holder names what no row matches
    if (c.kind === "warded") throw new PulamaRefused("needs-the-human", "a warded row opens only fresh from the face's own route");
    if (c.cold) {
      if (use === "hot") return;                            // the holder refuses a cold row at a hot door by its own name
      if (use === "cold-write" || !s.scope.coldReads.includes(c.row)) {
        throw new PulamaRefused("needs-the-human", `a session ${use === "cold-write" ? "writes no cold row" : `reads no cold ${c.row} row`}`);
      }
    }
    if (c.kind === "face") {
      const found = await holder.faceStanding(c.selector as FaceRef);
      if (found !== null && closedTo(s, found.fcid)) throw new PulamaRefused("face-closing", `face h${found.ordinal} is closing, and this session stands outside its close`);
      if (found !== null && !lends(s, found)) {
        throw new PulamaRefused("outside-the-lei", `the pūlama lends this vessel ${renderLentFaces(s.scope.faces)}; this ${c.row} row selects ${JSON.stringify(c.selector)}, face h${found.ordinal}`);
      }
    }
  };

  const recordOf = (args: Record<string, unknown>, key = "file"): { home: CustodyHome; file: string } => {
    const home = args["home"], file = args[key];
    if (typeof home !== "string" || !HOMES.has(home) || typeof file !== "string" || file.length === 0) throw new PulamaRefused("pulama-frame-malformed", "an operation names a home and a file");
    return { home: home as CustodyHome, file };
  };
  const bytesOf = (v: unknown): Uint8Array => {
    if (!(v instanceof Uint8Array)) throw new PulamaRefused("pulama-frame-malformed", "an operation's bytes ride as bytes");
    return v;
  };
  const faceOf = (v: unknown): FaceRef => {
    const f = v as Record<string, unknown> | null;
    if (typeof f === "object" && f !== null) {
      if (typeof f["ordinal"] === "number") return { ordinal: f["ordinal"] };
      if (typeof f["group"] === "string") return { group: f["group"] };
      if (typeof f["fcid"] === "string") return { fcid: f["fcid"] };
      if (typeof f["ask"] === "string") return { ask: f["ask"] };
    }
    throw new PulamaRefused("pulama-frame-malformed", "a face rides by its ordinal, its group, its custody id or its ask");
  };
  const inScope = (s: Session, found: { readonly ordinal: number; readonly fcid: string } | null): boolean => found === null || lends(s, found);

  /** A row's standing reading through the holder's update door, which reads under the holder's own claim and writes nothing. */
  const standingRecord = (home: CustodyHome, file: string, cold: boolean): Promise<RecordReading> =>
    cold ? holder.updateColdRecord(home, file, (r) => ({ plaintext: null, value: copyReading(r) }))
      : holder.updateRecord(home, file, (r) => ({ plaintext: null, value: copyReading(r) }));

  const run = async (s: Session, op: string, args: Record<string, unknown>): Promise<unknown> => {
    switch (op) {
      case "record.read": { const { home, file } = recordOf(args); await guard(s, home, file, "hot"); return holder.readRecord(home, file); }
      case "record.write": { const { home, file } = recordOf(args); await guard(s, home, file, "cold-write"); return holder.writeRecord(home, file, bytesOf(args["plaintext"])); }
      case "record.standing": {
        const { home, file } = recordOf(args), cold = args["cold"] === true;
        await guard(s, home, file, cold ? "cold-read" : "hot");
        return standingRecord(home, file, cold);
      }
      case "record.swap": {
        const { home, file } = recordOf(args), cold = args["cold"] === true;
        await guard(s, home, file, cold ? "cold-write" : "hot");
        const expect = readingOf(args["expect"]), plaintext = bytesOf(args["plaintext"]);
        if (expect === null) throw new PulamaRefused("pulama-frame-malformed", "a swap names the reading it decided over");
        const decide = (r: RecordReading) => sameReading(r, expect) ? { plaintext, value: true } : { plaintext: null, value: false };
        return cold ? holder.updateColdRecord(home, file, decide) : holder.updateRecord(home, file, decide);
      }
      case "record.remove": {
        const { home, file } = recordOf(args), cold = args["cold"] === true;
        await guard(s, home, file, cold ? "cold-write" : "hot");
        if (args["expect"] === undefined) return cold ? holder.removeColdRecord(home, file) : holder.removeRecord(home, file);
        const expect = bytesOf(args["expect"]);
        let stood = false;
        const when = (bytes: Uint8Array): boolean => { stood = true; return sameBytes(bytes, expect); };
        const removed = cold ? await holder.removeColdRecord(home, file, when) : await holder.removeRecord(home, file, when);
        return { removed, stood };
      }
      case "record.cold-open": {
        const { home, file } = recordOf(args);
        await guard(s, home, file, "cold-read");
        return holder.openColdRecord(home, file, (plaintext) => Uint8Array.from(plaintext));
      }
      case "record.move": {
        const { home, file: source } = recordOf(args, "source"), { file: destination } = recordOf(args, "destination");
        await guard(s, home, source, "cold-write");
        await guard(s, home, destination, "cold-write");
        return holder.moveRecord(home, source, destination, bytesOf(args["expected"]));
      }
      case "claim.begin": {
        const kind = args["kind"], id = nextClaim++;
        if (kind !== "records" && kind !== "exclusive") throw new PulamaRefused("pulama-frame-malformed", "a claim names its kind");
        return new Promise((entered, refused) => {
          let release!: () => void;
          const until = new Promise<void>((resolve) => { release = resolve; });
          // The claim's record stands before the holder runs anything, so an act the holder ran at once finds it whole.
          const claim: Claim = { records: null, end: release, done: Promise.resolve() };
          const hold = async (records: Claim["records"]): Promise<void> => {
            if (!s.open) return;
            claim.records = records;
            s.claims.set(id, claim);
            entered({ claim: id });
            await until;
          };
          claim.done = (kind === "records" ? holder.withRecords((records) => hold(records)) : holder.exclusive(() => hold(null)))
            .catch((err: unknown) => { refused(err); });
        });
      }
      case "claim.end": {
        const claim = s.claims.get(args["claim"] as number);
        if (!claim) return false;
        s.claims.delete(args["claim"] as number);
        claim.end();
        await claim.done;
        return true;
      }
      case "records.read": case "records.remove": {
        const claim = s.claims.get(args["claim"] as number);
        if (!claim || claim.records === null) throw new PulamaRefused("pulama-claim-absent", "no records claim stands under that name");
        const { home, file } = recordOf(args);
        await guard(s, home, file, "hot");
        // The claim may have ended while the scope read: a row touched after it would move outside any claim.
        if (s.claims.get(args["claim"] as number) !== claim) throw new PulamaRefused("pulama-claim-absent", "that claim ended before this row was reached");
        return op === "records.read" ? claim.records.read(home, file) : claim.records.remove(home, file);
      }
      case "face.standing": {
        const found = await holder.faceStanding(faceOf(args["face"]));
        if (!inScope(s, found)) return null;
        // A session outside a closing face's close reads it locked: it never lights the face.
        return found !== null && closedTo(s, found.fcid) ? { ...found, unlocked: false } : found;
      }
      case "face.closed": {
        if (typeof args["fcid"] !== "string" || (args["opening"] !== null && typeof args["opening"] !== "string") || Object.keys(args).some((k) => k !== "fcid" && k !== "opening")) {
          throw new PulamaRefused("pulama-frame-malformed", "a closed names one custody id and the opening its closing named, and nothing beside them");
        }
        const held = closings.get(args["fcid"]);
        // NOTHING NAMED BACK: a face not closing, outside this session's lend, or under another opening answers null alike.
        if (held === undefined || !held.awaiting.has(s) || held.opening !== args["opening"]) return null;
        held.awaiting.delete(s);
        if (held.awaiting.size === 0 && held.dropped === 0 && held.locking === null) await lockClosed(args["fcid"]);
        return null;
      }
      case "face.ward-key": {
        const face = faceOf(args["face"]);
        const found = await holder.faceStanding(face);
        if (!inScope(s, found)) throw new PulamaRefused("outside-the-lei", `the pūlama lends this vessel ${renderLentFaces(s.scope.faces)}; this ward key belongs to face h${found!.ordinal}`);
        return holder.wardPublicKey(face);
      }
      case "faces": {
        const open = new Set(holder.unlockedFaces());
        const out: Array<{ ordinal: number; fcid: string; unlocked: boolean }> = [];
        readFaceIndexSync(holder.homes.identity).faces.forEach((f, ordinal) => {
          if ("fcid" in f && inScope(s, { ordinal, fcid: f.fcid })) out.push({ ordinal, fcid: f.fcid, unlocked: open.has(f.fcid) && !closedTo(s, f.fcid) });
        });
        return out;
      }
      case "face.worn": {
        const ordinal = args["ordinal"];
        if (Object.keys(args).some((k) => k !== "ordinal") || !Number.isSafeInteger(ordinal) || (ordinal as number) < 0) {
          throw new PulamaRefused("pulama-frame-malformed", "a worn face rides by its ordinal, a whole number from 0, and nothing beside it");
        }
        if (!isLent(s.scope.faces, ordinal as number)) throw new PulamaRefused("outside-the-lei", `the pūlama lends this vessel ${renderLentFaces(s.scope.faces)}; h${String(ordinal)} stands outside it`);
        worn = ordinal as number;
        log(`worn: h${worn}`);
        return null;
      }
      case "rite.land": {
        if (!s.scope.land) throw new PulamaRefused("rite-not-begun", "this session began under no rite, so no tessera waits on a host half");
        return s.scope.land();
      }
      default:
        throw new PulamaRefused("needs-the-human", `a pūlama session carries no ${JSON.stringify(op)}: that act asks the operator's own hand`);
    }
  };

  const serve = (s: Session, f: PulamaFrame): void => {
    if (f.t !== "req" || typeof f["id"] !== "number" || typeof f["op"] !== "string") { end(s); return; }
    const id = f["id"], op = f["op"], args = (typeof f["a"] === "object" && f["a"] !== null ? f["a"] : {}) as Record<string, unknown>;
    run(s, op, args).then(
      (v) => {
        if (!s.open) return;
        try { s.channel.send({ t: "res", id, ok: true, v: v === undefined ? null : v }); }
        finally { if (v instanceof Uint8Array) v.fill(0); else if (readingOf(v)?.reading === "opens") (v as { plaintext: Uint8Array }).plaintext.fill(0); }
      },
      (err: unknown) => {
        if (!s.open) return;
        // A refusal rides by its class name and its own fields; the holder's refusals name a row and a reading, never a key.
        s.channel.send({ t: "res", id, ok: false, err: packRefusal(err) });
      },
    );
  };

  /**
   * The second phase: every told session answered (or the operator's hand forced it), so the key locks. THE CLOSE STANDS UNTIL
   * THE KEY LOCKED: the holder's lock waits its turn (an unlock ahead of it, the rows in flight), and through that wait the face
   * still reads closing and shut to every session (its answer set stands empty), so no standing sent meanwhile (an open, a
   * refresh, a new session) shows it lit and no vessel relights it to take a save the key then locks over. One lock runs per close:
   * a second answer, a re-close or a force joins it. A lock that throws leaves the face closing, its key open.
   */
  const lockClosed = (fcid: string): Promise<void> => {
    const held = closings.get(fcid);
    if (held === undefined) return Promise.resolve();
    held.awaiting = new Set();
    held.locking ??= (async () => {
      try {
        await holder.lockFace(fcid);
      } catch (error) {
        held.locking = null;
        throw error;
      }
      if (closings.get(fcid) === held) closings.delete(fcid);
      // The close ends with the lock: every session's standing drops it from the closing set.
      for (const s of live) withDerived((derived) => s.channel.send({ t: "ev", standing: standing(s), derived }));
      log(`face h${held.ordinal} closed and locked`);
    })();
    return held.locking;
  };

  holder.onOpened?.(() => { for (const s of live) withDerived((derived) => s.channel.send({ t: "ev", standing: standing(s), derived })); });
  // A FACE THAT SHUTS HERE TELLS EVERY SESSION AT ONCE: the standing leaves the lent face's opening out the moment it locks, so a
  // vessel's window on a lock it has not heard stays the message's own latency, never a wait for a refresh.
  holder.onClosed?.(() => { for (const s of live) withDerived((derived) => s.channel.send({ t: "ev", standing: standing(s), derived })); });

  return {
    accept(channel) {
      let session: Session | null = null;
      let greeted = false;
      let gone = false;
      channel.onClose(() => { gone = true; if (session) end(session); });
      channel.onFrame((f) => {
        if (session) { serve(session, f); return; }
        // Anything but one hello, or a frame sent while the gate still reads, ends the channel (and, through `gone`, the admission).
        if (greeted || f.t !== "hello") { gone = true; channel.close(); return; }
        greeted = true;
        const refuse = (reading: string, why?: string): void => {
          log(`hello refused: ${reading}`);
          channel.send({ t: "refused", reading, ...(why ? { why } : {}) });
          channel.close();
        };
        if (!holder.isUnlocked()) { refuse("pulama-locked", "the pūlama rests unlit: the operator lights it by their own hand"); return; }
        a.gate.admit(f["offer"]).then((admitted) => {
          if (!admitted.ok) { refuse(admitted.reading, admitted.why); return; }
          // NO SET NEVER MEANS EVERY FACE: a scope that names no lent set refuses by the set's own reading.
          const lent = lentFacesOf((admitted.scope as { readonly faces?: unknown }).faces);
          if (!lent.ok) { refuse(lent.refusal, lent.message.slice(`${lent.refusal}: `.length)); return; }
          if (!holder.isUnlocked()) { refuse("pulama-locked"); return; }
          // A CHANNEL THAT LEFT WHILE THE GATE READ gets no session: whatever the gate claimed stays claimed, and nothing serves.
          if (gone) { log("the channel left before its hello passed; no session stands"); return; }
          const s: Session = { channel, scope: { ...admitted.scope, faces: lent.faces }, claims: new Map(), open: true };
          session = s;
          live.add(s);
          withDerived((derived) => channel.send({ t: "session", scope: { faces: lentFacesWire(s.scope.faces), ...(s.scope.unlent?.length ? { unlent: s.scope.unlent } : {}) }, standing: standing(s), derived }));
          log(`session opened: lends ${renderLentFaces(s.scope.faces)}${s.scope.unlent?.length ? `; ${s.scope.unlent.map((u) => `h${u.ordinal} waits (${u.reading})`).join(", ")}` : ""}`);
        }, () => refuse("pulama-gate-faulted"));
      });
    },
    async lock() {
      for (const s of [...live]) end(s);
      worn = undefined;
      closings.clear();
      await holder.lock();
      log("locked: every key zero-filled");
    },
    refresh() { for (const s of live) withDerived((derived) => s.channel.send({ t: "ev", standing: standing(s), derived })); },
    async closeFace(ordinal, options) {
      const at = readFaceIndexSync(holder.homes.identity).faces[ordinal];
      const fcid = at !== undefined && "fcid" in at ? at.fcid : null;
      if (fcid === null) return { reading: "face-absent", face: ordinal };
      if (!holder.unlockedFaces().includes(fcid)) return { reading: "face-locked", face: ordinal };
      if (options?.force === true) {
        // THE OPERATOR'S HAND: the lock lands now, whoever has not answered.
        if (!closings.has(fcid)) closings.set(fcid, { ordinal, opening: null, awaiting: new Set(), dropped: 0, locking: null });
        await lockClosed(fcid);
        log(`face h${ordinal}: a forced lock by the operator's hand`);
        return { reading: "locked", face: ordinal, forced: true };
      }
      const already = closings.get(fcid);
      if (already !== undefined && already.locking !== null) {
        // A close whose key already locks: this ask joins that lock.
        await already.locking;
        return { reading: "locked", face: ordinal };
      }
      if (already !== undefined) {
        // THE CLOSE ASKED AGAIN tells every live session that lends the face, a late one included (a vessel that came back under a
        // new session): each joins the close's answer set, its rows open to its drain, and a vessel whose drain faulted drains
        // again. With no live lender it locks only where no told session dropped; a dropped one waits on the operator's hand.
        const owed = [...live].filter((s) => lends(s, { ordinal, fcid }));
        if (owed.length === 0 && already.dropped === 0) {
          await lockClosed(fcid);
          log(`face h${ordinal} locked: no session lends it, and none dropped its close`);
          return { reading: "locked", face: ordinal };
        }
        already.awaiting = new Set(owed);
        for (const s of owed) s.channel.send({ t: "closing", fcid, opening: already.opening });
        for (const s of live) withDerived((derived) => s.channel.send({ t: "ev", standing: standing(s), derived }));
        log(`face h${ordinal} closing again: ${owed.length} session(s) told${already.dropped > 0 ? `; ${already.dropped} dropped unanswered, so only a forced lock locks it` : ""}`);
        return { reading: "closing", face: ordinal, unanswered: owed.length };
      }
      const told = [...live].filter((s) => lends(s, { ordinal, fcid }));
      if (told.length === 0) {
        await holder.lockFace(fcid);
        log(`face h${ordinal} locked: no session lends it`);
        return { reading: "locked", face: ordinal };
      }
      const opening = holder.faceOpening?.(fcid) ?? null;
      // A vessel whose session ended BEFORE this close stands outside it: no session names that vessel here, so the close tells the
      // live lenders alone (and, with none, locks). Its unsealed saves, if any, wait in its own memory for a session to seal them.
      closings.set(fcid, { ordinal, opening, awaiting: new Set(told), dropped: 0, locking: null });
      for (const s of told) s.channel.send({ t: "closing", fcid, opening });
      for (const s of live) withDerived((derived) => s.channel.send({ t: "ev", standing: standing(s), derived }));
      log(`face h${ordinal} closing: ${told.length} session(s) to answer`);
      return { reading: "closing", face: ordinal, unanswered: told.length };
    },
    // THE CLEARING LINE, NAMED: close the face again (the hand's `close`) to tell every live lender again, or to lock it once no
    // session lends it and none dropped; a close a session dropped locks by the operator's hand alone (`close` with `force`).
    closing: () => [...closings.values()].map((c) => ({ face: c.ordinal, unanswered: c.awaiting.size, ...(c.dropped > 0 ? { dropped: c.dropped } : {}),
      note: c.dropped > 0
        ? `face h${c.ordinal}: ${c.dropped} session(s) it told ended unanswered, and their vessel may still hold an unsealed save; close it again to tell every live vessel, and only a forced lock by hand locks it`
        : c.awaiting.size > 0
          ? `face h${c.ordinal}: the vessel has not answered its close; close it again to tell the vessel again, or force it by hand`
          : `face h${c.ordinal}: no session still owes its close; close it again to lock it, or force it by hand` })),
    sessions: () => live.size,
  };
}
