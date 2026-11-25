/**
 * session-sign-book-seat — the book seats each session for its signer's life, not only for one call's (P2-4): a change
 * the wiki island writes while a face's session stands open, with no call in flight, books that session, so its save
 * seals and never waits for the next call.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed
 */
import { describe, expect, it } from "vitest";
import { SessionSignBook, standingSessionSeat, type BookedSession } from "../src/session-sign-book.js";

const sessionOf = (subject: string): BookedSession => ({
  signer: { dropped: false, certificate: {}, sign: async () => ({ refusal: "not-in-this-vector" }) },
  anchor: { kind: "nexus" }, subject,
});

describe("the book seats a session while its signer stands", () => {
  it("a seated session reads seated with no call booked, hears its seat as a hold, and leaves at its unseat; a call alone seats nothing (control)", () => {
    const heard: string[] = [];
    const book = new SessionSignBook({ onHold: (s, verb) => heard.push(`${s.subject}:${verb}`) });
    const a = sessionOf("face-a");
    expect(book.seated()).toEqual([]);
    const unseat = book.seat(a);
    expect(book.seated()).toEqual([a]);
    expect(book.standing()).toEqual([]);           // no call stands
    expect(heard).toEqual(["face-a:session:seat"]);
    book.seat(a);                                  // a second seat of one session seats it once
    expect(book.seated()).toEqual([a]);
    unseat();
    expect(book.seated()).toEqual([]);
    // CONTROL: a call books for its own life and seats nothing.
    const release = book.hold("req-1", "docstore-seal", sessionOf("face-b"));
    expect(book.seated()).toEqual([]);
    release();
  });
});

describe("V6: the vessel's own standing session seats in each book a lift stands", () => {
  it("the dial's session seats in the book standing now and in one a later lift stands, a new dial's session replaces it, and a dial that clears unseats it; a book stood with no session standing seats none (control)", () => {
    const seat = standingSessionSeat();
    const first = new SessionSignBook();
    seat.book(first);
    expect(first.seated()).toEqual([]);            // CONTROL: no session stands yet
    const dial = sessionOf("face-a");
    seat.stand(dial);
    expect(first.seated()).toEqual([dial]);
    const relift = new SessionSignBook();
    seat.book(relift);
    expect(relift.seated()).toEqual([dial]);
    expect(first.seated()).toEqual([]);            // the book the lift left seats nothing more
    const redial = sessionOf("face-a");
    seat.stand(redial);
    expect(relift.seated()).toEqual([redial]);
    seat.stand(null);
    expect(relift.seated()).toEqual([]);
  });
});

describe("each hat its own chain: a booked face reads ITS chain and ITS fold, never the worn face's", () => {
  const chainA = { place: { atomKey: "atom-a", place: "place-one" } } as const;
  const chainB = { place: { atomKey: "atom-b", place: "place-one" } } as const;
  const readable = (subject: string, face?: string): BookedSession => ({
    signer: { dropped: false, certificate: { subject }, sign: async () => ({ signature: `sig-${subject}` }) },
    anchor: { kind: "place" }, subject, ...(face !== undefined ? { face } : {}),
  });
  const door = () => {
    const book = new SessionSignBook();
    const asked: Array<string | null> = [];
    const signDoor = book.door(
      (face) => { asked.push(face); return face === "atom-b" ? chainB : face == null ? chainA : null; },
      async (face) => ({ read: true, counted: [face === "atom-b" ? "raise-of-b" : "raise-of-a"], unanswered: [] }),
    );
    return { book, signDoor, asked };
  };

  it("B's booking reads B's chain and B's counted raises; A's booking beside it reads A's (the worn default)", async () => {
    const { book, signDoor } = door();
    book.hold("req-a", "docstore-seal", readable("face-a"));
    book.hold("req-b", "docstore-seal", readable("face-b", "atom-b"));
    const b = await signDoor({ op: "read", ask: "req-b", verb: "docstore-seal" });
    expect(b).toMatchObject({ subject: "face-b", chain: chainB, counted: ["raise-of-b"], face: "atom-b" });
    const a = await signDoor({ op: "read", ask: "req-a", verb: "docstore-seal" });
    expect(a).toMatchObject({ subject: "face-a", chain: chainA, counted: ["raise-of-a"] });
    expect("face" in a).toBe(false);
  });

  it("the own reading names the face it asks for: B's own reads B's chain; with none named it reads the worn face's", async () => {
    const { signDoor } = door();
    expect(await signDoor({ op: "own", ask: "", verb: "", face: "atom-b" })).toMatchObject({ own: true, chain: chainB, counted: ["raise-of-b"] });
    expect(await signDoor({ op: "own", ask: "", verb: "" })).toMatchObject({ own: true, chain: chainA, counted: ["raise-of-a"] });
  });

  it("B shut: a face the vessel holds no chain for refuses on its own, and A keeps reading", async () => {
    const { book, signDoor } = door();
    book.hold("req-a", "docstore-seal", readable("face-a"));
    book.hold("req-c", "docstore-seal", readable("face-c", "atom-c"));
    expect(await signDoor({ op: "read", ask: "req-c", verb: "docstore-seal" })).toEqual({ refusal: "signer-unavailable" });
    expect(await signDoor({ op: "read", ask: "req-a", verb: "docstore-seal" })).toMatchObject({ chain: chainA });
  });
});
