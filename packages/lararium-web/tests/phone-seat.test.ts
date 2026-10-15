/**
 * phone-seat.test — THE PHONE SEAT EXPLAINS AND OFFERS (basket-one #/the-phone-seat, ruled 2026-09-11: "the phone
 * seat explains and offers the install, projection stays the node's"). ONE line renders — only on a secure
 * context, only when the page does NOT already stand installed, only when the eviction class reads WebKit's
 * seven-day best-effort. Never a demand. CONTROLS: a persisted origin, a standalone (installed) page, a
 * non-WebKit engine, an insecure context — each renders NOTHING.
 */
import { describe, test, expect } from "vitest";
import { phoneSeatExplanation, readsWebKitSevenDay, type PhoneSeatHost } from "../src/phone-seat.js";

const safariPhone: PhoneSeatHost = {
  isSecureContext: true, standalone: false, displayModeStandalone: false,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1",
  persistence: "best-effort",
};

describe("phoneSeatExplanation — one explaining line, or nothing", () => {
  test("Safari on a phone, secure, not installed, best-effort → the line explains the seven-day clock and OFFERS the install", () => {
    const line = phoneSeatExplanation(safariPhone);
    expect(line).not.toBeNull();
    expect(line).toMatch(/seven days/);
    expect(line).toMatch(/install/i);
    expect(line).not.toMatch(/must|required|cannot continue/i);   // an offer, never a demand
  });
  test("CONTROL: an installed (standalone) page renders nothing — by navigator.standalone or by display-mode", () => {
    expect(phoneSeatExplanation({ ...safariPhone, standalone: true })).toBeNull();
    expect(phoneSeatExplanation({ ...safariPhone, displayModeStandalone: true })).toBeNull();
  });
  test("CONTROL: a persisted origin renders nothing (no clock stands)", () => {
    expect(phoneSeatExplanation({ ...safariPhone, persistence: "persistent" })).toBeNull();
  });
  test("CONTROL: a desktop Chromium (no seven-day clock) and an insecure context each render nothing", () => {
    expect(phoneSeatExplanation({ ...safariPhone, userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36" })).toBeNull();
    expect(phoneSeatExplanation({ ...safariPhone, isSecureContext: false })).toBeNull();
  });
  test("readsWebKitSevenDay reads Safari/WebKit and not the Blink browsers wearing 'AppleWebKit'", () => {
    expect(readsWebKitSevenDay(safariPhone.userAgent)).toBe(true);
    expect(readsWebKitSevenDay("Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15")).toBe(true);
    expect(readsWebKitSevenDay("Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36")).toBe(false);
    expect(readsWebKitSevenDay("Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Edg/140.0")).toBe(false);
    expect(readsWebKitSevenDay("Mozilla/5.0 (X11; Linux) Gecko/20100101 Firefox/140.0")).toBe(false);
  });
});

describe("the seed-at-rest line — one status line, two spellings", () => {
  test("no wrap → 'seed: cleartext at rest'; a cloud-synced wrap names its class", async () => {
    const { seedRestStatus } = await import("../src/phone-seat.js");
    expect(seedRestStatus(undefined)).toBe("seed: cleartext at rest");
    expect(seedRestStatus({ keyClass: "cloud-synced" })).toBe("seed: wrapped under a passkey (cloud-synced)");
    expect(seedRestStatus({ keyClass: "device-minted" })).toBe("seed: wrapped under a passkey (device-minted)");
  });
});
