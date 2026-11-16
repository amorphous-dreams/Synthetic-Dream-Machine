/**
 * pulama-server — THE PŪLAMA: the keeper that holds a vessel's custody through the vessel's rebuild.
 *
 * The pūlama owns the one custody holder (`custody-holder`) over the hearth's homes. The operator lights it by their own
 * hand; each rebuilt vessel (a kūkulu) then dials it and asks row operations and derivations (`pulama-wire`). The keys
 * stay in the holder's closure: no frame this server writes carries the vessel key, the serving key, the custody root, a
 * face's custody key or a ward key.
 *
 * ── A HELLO PASSES THE GATE BEFORE ANYTHING SERVES ──────────────────────────────────────────────
 * A channel's first frame carries its offer. An unlit pūlama refuses `pulama-locked` and asks the gate nothing. Lit, the
 * gate (`PulamaGate`, the kūkulu gate in the product) reads the offer and answers the session's scope or a refusal by
 * reading. The gate claims the lei's return before it answers, so nothing serves ahead of the claim.
 *
 * ── THE SESSION SERVES A WORKING VESSEL AND NOTHING A HUMAN ROUTE GUARDS ────────────────────────
 *   hot rows       read, write, update, move, remove, and the two claims (`withRows`, `exclusive`)
 *   face rows      of the face the lei names; another face's rows refuse `outside-the-lei`
 *   cold rows      refuse `needs-the-human`, but for a READ of a row the scope's `coldReads` names (the rows a boot to
 *                  composition reads unattended); a cold write, a cold removal and every other cold row refuse
 *   warded rows    refuse `needs-the-human`: a ward opens only fresh from a human route
 *   derivations    the children under the domains `derives` names, carried in the session frame; no other domain derives
 *   `rite.land`    the vessel says it composed over its session; the pūlama rests the host half of the tessera the gate
 *                  began, once (the scope's `land`), and answers whether the pair reads par
 *   everything else (an unlock, a proof for a backup, an adoption, a founding, a ward act, a rewrap, a lock) holds no
 *                  operation here and refuses `needs-the-human`
 *
 * ── THE SESSION DROPS WITH ITS CHANNEL ──────────────────────────────────────────────────────────
 * A closed channel ends its session: every claim it held releases, and nothing it asked afterwards answers. `lock` drops
 * every session, then locks the holder, which waits out the work in flight and zero-fills every key. The process's exit
 * runs the same lock.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import type { CustodyHolder, FaceRef, RowReading } from "./custody-holder.js";
import { readFaceIndexSync } from "./face-index.js";
import { PulamaRefused, copyReading, packRefusal, readingOf, sameBytes, sameReading, type PulamaChannel, type PulamaFrame } from "./pulama-wire.js";
import { carrierTable, type CustodyHome, type FaceSelector } from "./vault-carriers.js";

/** What one session serves. */
export interface PulamaScope {
  /** The face the lei names, by custody id and ordinal; null serves no face's rows apart. */
  readonly face: { readonly fcid: string; readonly ordinal: number } | null;
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
  sessions(): number;
}

type RowClass =
  | { readonly kind: "node"; readonly cold: boolean; readonly row: string }
  | { readonly kind: "face"; readonly cold: boolean; readonly row: string; readonly selector: Exclude<FaceSelector, null> }
  | { readonly kind: "warded" }
  | { readonly kind: "unknown" };

/** Which carrier row a `(home, file)` names, as the holder's own resolver reads the table. */
function classify(home: CustodyHome, file: string): RowClass {
  const table = carrierTable();
  const node = table.find((r) => {
    if (r.home !== home || (r.custody !== "hot" && r.custody !== "cold")) return false;
    r.match.lastIndex = 0;
    return r.match.test(file);
  });
  if (node) return { kind: "node", cold: node.custody === "cold", row: node.row };
  if (home !== "identity") return { kind: "unknown" };
  if (table.some((r) => r.custody === "ward-cold" && r.faceRow !== undefined && r.faceRow.inner.test(file))) return { kind: "warded" };
  const face = table.find((r) => r.faceRow !== undefined && r.faceRow.select !== null && r.faceRow.inner.test(file));
  const selector = face ? face.faceRow!.select(face.faceRow!.inner.exec(file)!) : null;
  if (!face || selector === null) return { kind: "unknown" };
  return { kind: "face", cold: face.custody === "face-cold", row: face.row, selector };
}

const HOMES: ReadonlySet<string> = new Set(["identity", "storage", "seal"]);

interface Claim { rows: Parameters<Parameters<CustodyHolder["withRows"]>[0]>[0] | null; readonly end: () => void; done: Promise<unknown> }
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

  const standing = () => ({ slot: holder.openedSlot(), attemptsLeft: holder.attemptsLeft(), faces: holder.unlockedFaces() });
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
    if (c.kind === "face" && s.scope.face !== null) {
      const found = await holder.faceStanding(c.selector as FaceRef);
      if (found !== null && found.fcid !== s.scope.face.fcid) throw new PulamaRefused("outside-the-lei", "the lei names another face than this row's");
    }
  };

  const rowOf = (args: Record<string, unknown>, key = "file"): { home: CustodyHome; file: string } => {
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
  const inScope = (s: Session, found: { readonly fcid: string } | null): boolean => found === null || s.scope.face === null || found.fcid === s.scope.face.fcid;

  /** A row's standing reading through the holder's update door, which reads under the holder's own claim and writes nothing. */
  const standingRow = (home: CustodyHome, file: string, cold: boolean): Promise<RowReading> =>
    cold ? holder.updateColdRow(home, file, (r) => ({ plaintext: null, value: copyReading(r) }))
      : holder.updateRow(home, file, (r) => ({ plaintext: null, value: copyReading(r) }));

  const run = async (s: Session, op: string, args: Record<string, unknown>): Promise<unknown> => {
    switch (op) {
      case "row.read": { const { home, file } = rowOf(args); await guard(s, home, file, "hot"); return holder.readRow(home, file); }
      case "row.write": { const { home, file } = rowOf(args); await guard(s, home, file, "cold-write"); return holder.writeRow(home, file, bytesOf(args["plaintext"])); }
      case "row.standing": {
        const { home, file } = rowOf(args), cold = args["cold"] === true;
        await guard(s, home, file, cold ? "cold-read" : "hot");
        return standingRow(home, file, cold);
      }
      case "row.swap": {
        const { home, file } = rowOf(args), cold = args["cold"] === true;
        await guard(s, home, file, cold ? "cold-write" : "hot");
        const expect = readingOf(args["expect"]), plaintext = bytesOf(args["plaintext"]);
        if (expect === null) throw new PulamaRefused("pulama-frame-malformed", "a swap names the reading it decided over");
        const decide = (r: RowReading) => sameReading(r, expect) ? { plaintext, value: true } : { plaintext: null, value: false };
        return cold ? holder.updateColdRow(home, file, decide) : holder.updateRow(home, file, decide);
      }
      case "row.remove": {
        const { home, file } = rowOf(args), cold = args["cold"] === true;
        await guard(s, home, file, cold ? "cold-write" : "hot");
        if (args["expect"] === undefined) return cold ? holder.removeColdRow(home, file) : holder.removeRow(home, file);
        const expect = bytesOf(args["expect"]);
        let stood = false;
        const when = (bytes: Uint8Array): boolean => { stood = true; return sameBytes(bytes, expect); };
        const removed = cold ? await holder.removeColdRow(home, file, when) : await holder.removeRow(home, file, when);
        return { removed, stood };
      }
      case "row.cold-open": {
        const { home, file } = rowOf(args);
        await guard(s, home, file, "cold-read");
        return holder.openColdRow(home, file, (plaintext) => Uint8Array.from(plaintext));
      }
      case "row.move": {
        const { home, file: source } = rowOf(args, "source"), { file: destination } = rowOf(args, "destination");
        await guard(s, home, source, "cold-write");
        await guard(s, home, destination, "cold-write");
        return holder.moveRow(home, source, destination, bytesOf(args["expected"]));
      }
      case "claim.begin": {
        const kind = args["kind"], id = nextClaim++;
        if (kind !== "rows" && kind !== "exclusive") throw new PulamaRefused("pulama-frame-malformed", "a claim names its kind");
        return new Promise((entered, refused) => {
          let release!: () => void;
          const until = new Promise<void>((resolve) => { release = resolve; });
          // The claim's record stands before the holder runs anything, so an act the holder ran at once finds it whole.
          const claim: Claim = { rows: null, end: release, done: Promise.resolve() };
          const hold = async (rows: Claim["rows"]): Promise<void> => {
            if (!s.open) return;
            claim.rows = rows;
            s.claims.set(id, claim);
            entered({ claim: id });
            await until;
          };
          claim.done = (kind === "rows" ? holder.withRows((rows) => hold(rows)) : holder.exclusive(() => hold(null)))
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
      case "rows.read": case "rows.remove": {
        const claim = s.claims.get(args["claim"] as number);
        if (!claim || claim.rows === null) throw new PulamaRefused("pulama-claim-absent", "no rows claim stands under that name");
        const { home, file } = rowOf(args);
        await guard(s, home, file, "hot");
        // The claim may have ended while the scope read: a row touched after it would move outside any claim.
        if (s.claims.get(args["claim"] as number) !== claim) throw new PulamaRefused("pulama-claim-absent", "that claim ended before this row was reached");
        return op === "rows.read" ? claim.rows.read(home, file) : claim.rows.remove(home, file);
      }
      case "face.standing": { const found = await holder.faceStanding(faceOf(args["face"])); return inScope(s, found) ? found : null; }
      case "face.ward-key": {
        const face = faceOf(args["face"]);
        if (!inScope(s, await holder.faceStanding(face))) throw new PulamaRefused("outside-the-lei", "the lei names another face");
        return holder.wardPublicKey(face);
      }
      case "faces": {
        const open = new Set(holder.unlockedFaces());
        const out: Array<{ ordinal: number; fcid: string; unlocked: boolean }> = [];
        readFaceIndexSync(holder.homes.identity).faces.forEach((f, ordinal) => {
          if ("fcid" in f && inScope(s, f)) out.push({ ordinal, fcid: f.fcid, unlocked: open.has(f.fcid) });
        });
        return out;
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

  holder.onOpened?.(() => { for (const s of live) withDerived((derived) => s.channel.send({ t: "ev", standing: standing(), derived })); });

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
          if (!holder.isUnlocked()) { refuse("pulama-locked"); return; }
          // A CHANNEL THAT LEFT WHILE THE GATE READ gets no session: whatever the gate claimed stays claimed, and nothing serves.
          if (gone) { log("the channel left before its hello passed; no session stands"); return; }
          const s: Session = { channel, scope: admitted.scope, claims: new Map(), open: true };
          session = s;
          live.add(s);
          withDerived((derived) => channel.send({ t: "session", scope: { ordinal: s.scope.face?.ordinal ?? null }, standing: standing(), derived }));
          log("session opened");
        }, () => refuse("pulama-gate-faulted"));
      });
    },
    async lock() {
      for (const s of [...live]) end(s);
      await holder.lock();
      log("locked: every key zero-filled");
    },
    refresh() { for (const s of live) withDerived((derived) => s.channel.send({ t: "ev", standing: standing(), derived })); },
    sessions: () => live.size,
  };
}
