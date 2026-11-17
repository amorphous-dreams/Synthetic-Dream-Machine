/**
 * pulama-holder — THE VESSEL'S SIDE of a custody a pūlama holds: a `CustodyHolder` that keeps no key.
 *
 * A vessel that finds a pūlama seats this holder where the in-process one would sit (`custody-seat`), so every sealed-row
 * caller reads and writes as before. Each operation crosses the channel (`pulama-wire`); the pūlama opens and seals under
 * the keys it holds and answers plaintext records and derived children. This side holds a session, a copy of the holder's
 * standing, and the children the session derives. It holds no vessel key, no custody root, no face key and no ward key.
 *
 * ── THE SESSION STANDS IN FOR THE KEY ───────────────────────────────────────────────────────────
 * `isUnlocked` reads true while a session stands. `unlock` dials the pūlama and offers what this kūkulu wears (its lei and
 * its vouch); it sends no credential, and the credentials handed to it reach no frame. A hello the pūlama refuses raises
 * `PulamaRefused` by its reading. The session drops with the channel: every row then refuses `CustodyLocked`, and the
 * listeners `onClosed` seats hear it, so the vessel stands back at the floor.
 *
 * ── ONLY THE OPERATOR'S HAND LIGHTS THE PŪLAMA ──────────────────────────────────────────────────
 * No door here opens a key. A face's unlock answers what already stands open at the pūlama; a proof, an adoption, a
 * founding, a ward act and a rewrap refuse `needs-the-human`: each asks a human route, and that route belongs at the
 * pūlama's own hand door. `lock` leaves the session and never dims the pūlama.
 *
 * ── A DECISION RUNS HERE, THE WRITE LANDS THERE ─────────────────────────────────────────────────
 * `updateRecord` reads the row's standing, decides on this side, and asks the pūlama to write only where the row still
 * stands as decided over; a row that moved meanwhile decides again. So no writer lands between the reading a decision
 * saw and its write, as one holder's claim gives the in-process holder. `withRecords` and `exclusive` hold the pūlama's
 * claim across the act and release it when the act settles or the channel drops.
 *
 * ── THE SESSION NAMES ITS LEND ──────────────────────────────────────────────────────────────────
 * The session frame carries the faces the pūlama lends this vessel (`scope.faces`); the standing names the lent faces that
 * stand lit as open and the lent faces still dark as waiting. A session frame whose lent set reads empty, malformed or
 * doubled refuses by the set's own reading (`lent-faces-empty`, `lent-faces-malformed`, `lent-faces-duplicate`) and no
 * session stands: no set never reads as a lend of every face.
 *
 * `derive` answers synchronously from the children the session carried, under the domains the pūlama serves a session.
 * The holder names no host: `dial` hands it a channel.
 * Meme: lar:///ha.ka.ba/lares/docs/pono/the-worn-house#/the-pulama
 */
import { lentFacesOf, type LentFaces } from "@lararium/mesh";
import {
  CustodyLocked, CustodyRecordUnavailable,
  type CustodyHolder, type FaceRef, type FaceUnlock, type HolderUnlock, type RecordReading, type RecordUpdate,
} from "./custody-holder.js";
import { PulamaRefused, copyReading, readingOf, unpackRefusal, type PulamaChannel, type PulamaFrame } from "./pulama-wire.js";
import type { CustodyHome, CustodyHomes } from "./vault-carriers.js";

/** The holder's standing as a session carries it. */
export interface PulamaStanding {
  readonly slot: string | null; readonly attemptsLeft: number;
  /** The lent faces that stand lit, by custody id. */
  readonly faces: readonly string[];
  /** The lent faces still dark at the pūlama, by ordinal. */
  readonly waiting: readonly number[];
}

/** What a session serves: the faces the pūlama lends this vessel. */
export interface PulamaSessionScope { readonly faces: LentFaces }

export interface PulamaHolder extends CustodyHolder {
  /** Hear the session drop (the channel closed, the pūlama locked, this side left). Returns the unsubscribe. */
  onClosed(listener: () => void): () => void;
  /** The ordinals the standing session's lend names, lit or waiting; empty with no session. */
  lends(): readonly number[];
  /** The lent faces still dark at the pūlama, by ordinal; empty with no session. */
  waiting(): readonly number[];
  /** Tell the pūlama this vessel composed over its session: it rests the host half of the tessera the session began under. */
  landRite(): Promise<{ readonly par: boolean }>;
  /** What the pūlama answered this side's last hello, where it refused one and no session stood since; null otherwise. */
  waits(): string | null;
}

interface Session {
  readonly channel: PulamaChannel;
  standing: PulamaStanding;
  derived: Readonly<Record<string, Uint8Array>>;
  readonly scope: PulamaSessionScope;
  readonly pending: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>;
}

const needsHuman = (what: string): Promise<never> =>
  Promise.reject(new PulamaRefused("needs-the-human", `${what} asks a human route, and a pūlama session carries none: ask it at the pūlama's own hand door`));

const standingOf = (raw: unknown): PulamaStanding => {
  const s = (raw ?? {}) as { slot?: unknown; attemptsLeft?: unknown; faces?: unknown; waiting?: unknown };
  return {
    slot: typeof s.slot === "string" ? s.slot : null,
    attemptsLeft: typeof s.attemptsLeft === "number" ? s.attemptsLeft : 0,
    faces: Array.isArray(s.faces) ? s.faces.filter((f): f is string => typeof f === "string") : [],
    waiting: Array.isArray(s.waiting) ? s.waiting.filter((o): o is number => Number.isSafeInteger(o) && o >= 0) : [],
  };
};
const derivedOf = (raw: unknown): Record<string, Uint8Array> => {
  const out: Record<string, Uint8Array> = {};
  if (typeof raw === "object" && raw !== null) for (const [k, v] of Object.entries(raw)) if (v instanceof Uint8Array) out[k] = v;
  return out;
};

export function makePulamaHolder(a: {
  readonly homes: CustodyHomes;
  /** Open one channel to the pūlama. A pūlama that does not answer rejects. */
  readonly dial: () => Promise<PulamaChannel>;
  /** What this kūkulu wears into the hello: its lei and its vouch, as the pūlama's gate reads them. */
  readonly offer: () => unknown | Promise<unknown>;
}): PulamaHolder {
  let session: Session | null = null;
  let nextId = 1;
  let dialing: Promise<HolderUnlock> | null = null;
  /** Counts this side's leavings: a dial that began before a `lock` seats no session after it. */
  let left = 0;
  /** The reading of the last hello the pūlama refused; a session clears it. */
  let refused: string | null = null;
  const openedListeners = new Set<() => void>();
  const closedListeners = new Set<() => void>();
  const fire = (set: Set<() => void>): void => { for (const l of [...set]) { try { l(); } catch { /* a listener's fault never reaches the holder */ } } };

  const drop = (s: Session): void => {
    if (session !== s) return;
    session = null;
    for (const p of s.pending.values()) p.reject(new CustodyLocked("the pūlama session dropped, so this vessel's sealed rows stay shut"));
    s.pending.clear();
    for (const child of Object.values(s.derived)) child.fill(0);
    fire(closedListeners);
  };

  const call = (op: string, args: Readonly<Record<string, unknown>> = {}): Promise<unknown> => {
    const s = session;
    if (s === null) return Promise.reject(new CustodyLocked());
    const id = nextId++;
    return new Promise((resolve, reject) => {
      s.pending.set(id, { resolve, reject });
      s.channel.send({ t: "req", id, op, a: args });
    });
  };

  const onFrame = (s: Session, f: PulamaFrame): void => {
    if (f.t === "res" && typeof f["id"] === "number") {
      const p = s.pending.get(f["id"]);
      if (!p) return;
      s.pending.delete(f["id"]);
      if (f["ok"] === true) p.resolve(f["v"]); else p.reject(unpackRefusal(f["err"]));
    } else if (f.t === "ev") {
      for (const child of Object.values(s.derived)) child.fill(0);
      s.standing = standingOf(f["standing"]);
      s.derived = derivedOf(f["derived"]);
      fire(openedListeners);
    }
  };

  const doDial = async (): Promise<HolderUnlock> => {
    const began = left;
    const channel = await a.dial();
    const offer = await a.offer();
    const answered = await new Promise<PulamaFrame | null>((resolve) => {
      channel.onClose(() => resolve(null));
      channel.onFrame((f) => {
        const s = session;
        if (s !== null && s.channel === channel) onFrame(s, f); else resolve(f);
      });
      channel.send({ t: "hello", offer });
    });
    if (answered === null) throw new PulamaRefused("pulama-unreachable", "the pūlama closed the channel before it answered the hello");
    if (answered.t !== "session") {
      channel.close();
      throw new PulamaRefused(typeof answered["reading"] === "string" ? answered["reading"] : "pulama-refused", typeof answered["why"] === "string" ? answered["why"] : "");
    }
    if (left !== began) {
      channel.close();
      throw new CustodyLocked("this vessel left the pūlama while its dial ran, so no session stands");
    }
    const lent = lentFacesOf(((answered["scope"] ?? {}) as { faces?: unknown }).faces);
    if (!lent.ok) {
      channel.close();
      throw new PulamaRefused(lent.refusal, `the pūlama's session frame names no lent set this vessel reads (${lent.message})`);
    }
    const stood: Session = {
      channel, standing: standingOf(answered["standing"]), derived: derivedOf(answered["derived"]),
      scope: { faces: lent.faces }, pending: new Map(),
    };
    session = stood;
    refused = null;
    channel.onClose(() => drop(stood));
    fire(openedListeners);
    return { reading: "opens", slot: stood.standing.slot ?? "pulama" };
  };

  const reading = async (op: string, args: Readonly<Record<string, unknown>>): Promise<RecordReading> => {
    const r = readingOf(await call(op, args));
    if (r === null) throw new PulamaRefused("pulama-frame-malformed", "the pūlama answered no row reading");
    return r;
  };

  /** Read, decide here, write there only where the row still stands as decided over. */
  const update = async <T>(home: CustodyHome, file: string, cold: boolean, decide: (standing: RecordReading) => RecordUpdate<T>): Promise<T> => {
    for (;;) {
      const standing = await reading("record.standing", { home, file, cold });
      // The swap compares against what the pūlama read, held apart: a decision that writes into the bytes it was handed never moves it.
      const expect = copyReading(standing);
      const spent = (): void => {
        if (!cold) return;
        if (standing.reading === "opens") standing.plaintext.fill(0);
        if (expect.reading === "opens") expect.plaintext.fill(0);
      };
      let next: RecordUpdate<T>;
      let write: Uint8Array | null;
      try {
        next = decide(standing);
        write = next.plaintext === null ? null : Uint8Array.from(next.plaintext);
      } catch (err) { spent(); throw err; }
      if (write === null) { spent(); return next.value; }
      try {
        if (await call("record.swap", { home, file, cold, expect, plaintext: write }) === true) return next.value;
      } finally { if (cold) write.fill(0); spent(); }
    }
  };

  const remove = async (home: CustodyHome, file: string, cold: boolean, when?: (plaintext: Uint8Array) => boolean): Promise<boolean> => {
    if (!when) return await call("record.remove", { home, file, cold }) === true;
    for (;;) {
      const standing = await reading("record.standing", { home, file, cold });
      if (standing.reading === "absent") return false;
      if (standing.reading === "locked") throw new CustodyLocked();
      if (standing.reading === "unavailable") throw new CustodyRecordUnavailable(home, file, standing.why);
      const expect = Uint8Array.from(standing.plaintext);
      try {
        if (!when(standing.plaintext)) return false;
        const out = await call("record.remove", { home, file, cold, expect }) as { removed?: unknown; stood?: unknown };
        if (out.removed === true) return true;
        if (out.stood === false) return false;
      } finally { if (cold) { standing.plaintext.fill(0); expect.fill(0); } }
    }
  };

  /** Hold the pūlama's custody claim across `act`; the claim releases when the act settles or the channel drops. */
  const claimed = async <T>(kind: "records" | "exclusive", act: (claim: number) => Promise<T>): Promise<T> => {
    const claim = (await call("claim.begin", { kind }) as { claim: number }).claim;
    try { return await act(claim); }
    finally { await call("claim.end", { claim }).catch(() => undefined); }
  };

  const faceOf = async (face: FaceRef) => await call("face.standing", { face }) as Awaited<ReturnType<CustodyHolder["faceStanding"]>>;
  const faceUnlock = (f: { readonly ordinal: number; readonly fcid: string; readonly unlocked: boolean }): FaceUnlock =>
    f.unlocked ? { reading: "already-unlocked", fcid: f.fcid, ordinal: f.ordinal } : { reading: "attempts-spent", fcid: f.fcid };

  return {
    homes: a.homes,
    unlock() {
      if (session !== null) return Promise.resolve({ reading: "already-unlocked" });
      return dialing ??= doDial().catch((err: unknown) => {
        const reading = (err as { reading?: unknown }).reading;
        refused = typeof reading === "string" ? reading : "pulama-unreachable";
        throw err;
      }).finally(() => { dialing = null; });
    },
    proves: () => needsHuman("a proof of the vessel's route"),
    adopt: () => needsHuman("an adoption"),
    async lock() { left += 1; const s = session; if (s !== null) { s.channel.close(); drop(s); } },
    isUnlocked: () => session !== null,
    onOpened(listener) { openedListeners.add(listener); return () => { openedListeners.delete(listener); }; },
    onClosed(listener) { closedListeners.add(listener); return () => { closedListeners.delete(listener); }; },
    lends: () => session?.scope.faces.map((f) => f.ordinal) ?? [],
    waiting: () => session?.standing.waiting ?? [],
    waits: () => (session === null ? refused : null),
    async landRite() { return { par: (await call("rite.land") as { par?: unknown }).par === true }; },
    attemptsLeft: () => session?.standing.attemptsLeft ?? 0,
    openedSlot: () => session?.standing.slot ?? null,
    async readRecord(home, file) {
      if (session === null) return { reading: "locked" };
      return reading("record.read", { home, file });
    },
    async writeRecord(home, file, plaintext) { await call("record.write", { home, file, plaintext }); },
    updateRecord: (home, file, decide) => update(home, file, false, decide),
    async moveRecord(home, source, destination, expected) { await call("record.move", { home, source, destination, expected }); },
    withRecords(act) {
      return claimed("records", (claim) => act({
        async read(home, file) { return await call("records.read", { claim, home, file }) as Uint8Array | null; },
        async remove(home, file, when) {
          if (when) {
            const bytes = await call("records.read", { claim, home, file }) as Uint8Array | null;
            if (bytes === null || !when(bytes)) return false;
          }
          return await call("records.remove", { claim, home, file }) === true;
        },
      }));
    },
    removeRecord: (home, file, when) => remove(home, file, false, when),
    removeColdRecord: (home, file, when) => remove(home, file, true, when),
    async openColdRecord(home, file, act) {
      const plaintext = await call("record.cold-open", { home, file }) as Uint8Array;
      try { return await act(plaintext); } finally { plaintext.fill(0); }
    },
    updateColdRecord: (home, file, decide) => update(home, file, true, decide),
    exclusive: (act) => claimed("exclusive", () => act()),
    derive(domain) {
      if (session === null) throw new CustodyLocked();
      const child = session.derived[domain];
      if (!child) throw new PulamaRefused("derive-outside-session", `a pūlama session derives no child under ${JSON.stringify(domain)}`);
      return Uint8Array.from(child);
    },
    foundFace: () => needsHuman("a face's founding"),
    bindFace: () => needsHuman("a face's binding"),
    async unlockFace(face) {
      const found = await faceOf(face);
      return found === null ? { reading: "face-absent" } : faceUnlock(found);
    },
    async unlockFaces() {
      return (await call("faces") as Array<{ ordinal: number; fcid: string; unlocked: boolean }>).map(faceUnlock);
    },
    bindFaceAsk: () => needsHuman("a face's founding ask"),
    retireFaceAsk: () => needsHuman("a face's founding ask"),
    faceStanding: (face) => faceOf(face),
    lockFace: () => needsHuman("a face's lock"),
    unlockedFaces: () => session?.standing.faces ?? [],
    withWardKey: () => needsHuman("a ward act"),
    async wardPublicKey(face) { return await call("face.ward-key", { face }) as string | null; },
    rewrapWard: () => needsHuman("a ward rewrap"),
    watchWardKeys() { /* this side opens no ward key */ },
    async isFaceUnlocked(face) {
      if (session === null) return false;
      return (await faceOf(face))?.unlocked === true;
    },
  };
}
