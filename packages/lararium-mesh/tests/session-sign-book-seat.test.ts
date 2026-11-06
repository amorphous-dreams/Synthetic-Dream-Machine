/**
 * session-sign-book-seat — the book seats each session for its signer's life, not only for one call's (P2-4): a change
 * the wiki island writes while a face's session stands open, with no call in flight, books that session, so its save
 * seals and never waits for the next call.
 * Canon: lar:///ha.ka.ba/lararium/mesh/sealed-store#/owed
 */
import { describe, expect, it } from "vitest";
import { SessionSignBook, type BookedSession } from "../src/session-sign-book.js";

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
