/**
 * The relay address a device admit carries by default: the vessel's declared reach face, never a loopback one.
 */
import { afterEach, describe, expect, test } from "vitest";
import { deviceAdmitSyncUrl } from "../src/commands/device-admit.js";

const priorPublicUrl = process.env.LAR_PUBLIC_URL;
afterEach(() => {
  if (priorPublicUrl === undefined) delete process.env.LAR_PUBLIC_URL;
  else process.env.LAR_PUBLIC_URL = priorPublicUrl;
});

describe("device-admit relay address", () => {
  test("unset LAR_PUBLIC_URL leaves the admit address null", () => {
    delete process.env.LAR_PUBLIC_URL;
    expect(deviceAdmitSyncUrl(undefined)).toBeNull();
  });

  test("an HTTPS reach face carries WSS", () => {
    process.env.LAR_PUBLIC_URL = "https://hearth.home.example.test";
    expect(deviceAdmitSyncUrl(undefined)).toBe("wss://hearth.home.example.test/ws");
  });

  test("an HTTP reach face carries WS", () => {
    process.env.LAR_PUBLIC_URL = "http://192.168.1.20:4321";
    expect(deviceAdmitSyncUrl(undefined)).toBe("ws://192.168.1.20:4321/ws");
  });

  test("a loopback reach face never rides an admit: on the joining device it names that device", () => {
    for (const face of ["http://localhost:4321", "http://127.0.0.1:4321", "http://[::1]:4321"]) {
      process.env.LAR_PUBLIC_URL = face;
      expect(deviceAdmitSyncUrl(undefined), face).toBeNull();
    }
  });

  test("a declaration that parses as no URL leaves the address null", () => {
    process.env.LAR_PUBLIC_URL = "not a url";
    expect(deviceAdmitSyncUrl(undefined)).toBeNull();
  });

  test("an explicit sync URL wins", () => {
    process.env.LAR_PUBLIC_URL = "https://hearth.home.example.test";
    expect(deviceAdmitSyncUrl("wss://manual.example.test/ws")).toBe("wss://manual.example.test/ws");
  });
});
