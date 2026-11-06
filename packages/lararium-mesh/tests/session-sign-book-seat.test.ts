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
