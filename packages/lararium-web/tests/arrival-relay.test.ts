/**
 * arrival-relay -- a page whose own origin answers the arrival descriptor dials that origin's relay by default.
 *
 * The proof stands on a capability, never a host: the same-origin `/.well-known/lar` answers JSON whose
 * `format` reads `lar-arrival`. A Vite dev server answers every unknown path with index.html at 200, so the
 * status alone proves nothing; a file page has no origin to ask.
 */
import { describe, expect, test } from "vitest";
import { arrivalRelayUrl } from "../src/live-status.js";

const http = { protocol: "http:", host: "127.0.0.1:4321", origin: "http://127.0.0.1:4321" };
const answer = (body: string, init: ResponseInit = { status: 200 }) => async () => new Response(body, init);
const descriptor = JSON.stringify({ format: "lar-arrival", arrival: "/", routes: [], mirrors: [] });

describe("the default relay of a node-served page", () => {
  test("an origin that answers the arrival descriptor is dialled at its own /ws", async () => {
    expect(await arrivalRelayUrl(http, answer(descriptor))).toBe("ws://127.0.0.1:4321/ws");
    expect(await arrivalRelayUrl({ protocol: "https:", host: "hearth.example.test", origin: "https://hearth.example.test" }, answer(descriptor)))
      .toBe("wss://hearth.example.test/ws");
  });

  test("asks the descriptor's own well-known name on the page's origin", async () => {
    let asked = "";
    await arrivalRelayUrl(http, async (input) => { asked = String(input); return new Response(descriptor); });
    expect(asked).toBe("http://127.0.0.1:4321/.well-known/lar");
  });

  test("CONTROL: a Vite dev server's index.html at 200 keeps the local boot", async () => {
    expect(await arrivalRelayUrl(http, answer("<!doctype html><title>vite</title>"))).toBeUndefined();
  });

  test("CONTROL: another format, a 404 and a failed fetch keep the local boot", async () => {
    expect(await arrivalRelayUrl(http, answer(JSON.stringify({ format: "other" })))).toBeUndefined();
    expect(await arrivalRelayUrl(http, answer(descriptor, { status: 404 }))).toBeUndefined();
    expect(await arrivalRelayUrl(http, async () => { throw new TypeError("network"); })).toBeUndefined();
  });

  test("CONTROL: a page opened from a file asks nothing and keeps the local boot", async () => {
    let asked = false;
    const out = await arrivalRelayUrl({ protocol: "file:", host: "", origin: "null" }, async () => { asked = true; return new Response(descriptor); });
    expect(out).toBeUndefined();
    expect(asked).toBe(false);
  });
});
