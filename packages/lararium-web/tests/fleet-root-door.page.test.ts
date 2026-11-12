/**
 * The root holder's fleet-join door on a page: offer, take the request, answer. The vessel's port stands faked; the
 * carriage (text, file, QR frames, the camera's named refusal) runs real in the browser.
 */
import { describe, expect, test } from "vitest";
import { mountFleetRootDoor, type FleetRootPort } from "../src/fleet/fleet-root-door.js";
import { CarriageAssembly, carriageFrames } from "../src/fleet/carriage-frames.js";
import { cameraReadRefusal, qrSvg } from "../src/fleet/carriage-qr.js";
import { takeCarriage } from "../src/fleet/carriage-panel.js";

const GROUP = "0xb7f1c2a9d4e60381";
const OFFER = JSON.stringify({ kind: "fleet-join-offer", personaGroup: GROUP, rootKey: "aa".repeat(32), nonce: "ab".repeat(32), scopes: [] });
const REQUEST = JSON.stringify({ kind: "fleet-join-request", nonce: "ab".repeat(32), atomKey: "cd".repeat(32), signature: "ef".repeat(64) });
const ANSWER = JSON.stringify({ kind: "fleet-join-answer", nonce: "ab".repeat(32), body: "0123456789abcdef".repeat(400) });

function rig(over: Partial<FleetRootPort> = {}) {
  const calls: Array<[string, ...unknown[]]> = [];
  const port: FleetRootPort = {
    faces: async () => [{ personaGroup: GROUP, label: "home" }],
    offer: async (group) => { calls.push(["offer", group]); return OFFER; },
    answer: async (group, request) => { calls.push(["answer", group, request]); return ANSWER; },
    ...over,
  };
  const host = document.createElement("div");
  document.body.append(host);
  const door = mountFleetRootDoor(host, port, { cameraHost: { isSecureContext: true, mediaDevices: undefined, BarcodeDetector: undefined } });
  return { host, port, calls, door };
}
const settle = async (host: HTMLElement, state: string): Promise<void> => { await expect.poll(() => host.dataset["larFleetState"]).toBe(state); };
const q = <T extends Element>(host: Element, selector: string): T => {
  const found = host.querySelector<T>(selector);
  if (!found) throw new Error(`the door painted no ${selector}`);
  return found;
};

describe("the root holder's fleet-join door", () => {
  test("RED: a face this browser holds a root for offers: the offer shows as text, a file and one QR code", async () => {
    const { host, calls } = rig();
    await expect.poll(() => host.dataset["larFleetFaces"]).toBe("1");
    q<HTMLButtonElement>(host, "[data-lar-fleet-offer]").click();
    await settle(host, "ok");
    expect(calls).toEqual([["offer", GROUP]]);
    const shown = q<HTMLElement>(host, "[data-lar-fleet-step='offer']");
    expect(q<HTMLTextAreaElement>(shown, "[data-lar-carriage-text]").value).toBe(OFFER);
    const save = q<HTMLAnchorElement>(shown, "[data-lar-carriage-save]");
    expect(save.download).toBe("offer.json");
    expect(await (await fetch(save.href)).text()).toBe(OFFER);
    const qr = q<HTMLElement>(shown, "[data-lar-carriage-qr]");
    expect(qr.dataset["larFrames"]).toBe("1");
    // The code on screen carries the offer's one frame: its module count equals the encoder's for that frame.
    expect(q<SVGSVGElement>(qr, "svg").dataset["larQrModules"]).toBe(qrSvg(carriageFrames(OFFER)[0]!).dataset["larQrModules"]);
    expect(q<SVGPathElement>(qr, "svg path").getAttribute("d")!.length).toBeGreaterThan(100);
  });

  test("RED: a pasted request answers through the vessel, and the answer shows as frames a person steps through", async () => {
    const { host, calls } = rig();
    await expect.poll(() => host.dataset["larFleetFaces"]).toBe("1");
    q<HTMLButtonElement>(host, "[data-lar-fleet-offer]").click();
    await settle(host, "ok");
    const take = q<HTMLElement>(host, "[data-lar-fleet-step='request']");
    q<HTMLTextAreaElement>(take, "[data-lar-carriage-paste]").value = REQUEST;
    q<HTMLButtonElement>(take, "[data-lar-carriage-take]").click();
    await expect.poll(() => host.querySelector("[data-lar-fleet-step='answer']")).not.toBeNull();
    expect(calls[1]).toEqual(["answer", GROUP, REQUEST]);
    const answer = q<HTMLElement>(host, "[data-lar-fleet-step='answer']");
    expect(q<HTMLTextAreaElement>(answer, "[data-lar-carriage-text]").value).toBe(ANSWER);
    expect(q<HTMLAnchorElement>(answer, "[data-lar-carriage-save]").download).toBe("answer.json");
    const qr = q<HTMLElement>(answer, "[data-lar-carriage-qr]");
    const frames = carriageFrames(ANSWER);
    expect(Number(qr.dataset["larFrames"])).toBe(frames.length);
    expect(frames.length).toBeGreaterThan(3);
    // Stepping walks every frame once round, and the frames join back into the answer.
    const seen: string[] = [];
    for (let i = 0; i < frames.length; i++) { seen.push(qr.dataset["larFrame"]!); q<HTMLButtonElement>(qr, "[data-lar-carriage-next]").click(); }
    expect(seen).toEqual(frames.map((_, i) => String(i + 1)));
    expect(qr.dataset["larFrame"]).toBe("1");
    const assembly = new CarriageAssembly();
    expect(frames.map((f) => assembly.take(f)).at(-1)).toEqual({ done: ANSWER });
  });

  test("RED: a request arrives as a picked file, or as a pasted run of frames", async () => {
    for (const road of ["file", "frames"] as const) {
      const { host, calls } = rig();
      await expect.poll(() => host.dataset["larFleetFaces"]).toBe("1");
      q<HTMLButtonElement>(host, "[data-lar-fleet-offer]").click();
      await settle(host, "ok");
      const take = q<HTMLElement>(host, "[data-lar-fleet-step='request']");
      if (road === "file") {
        const input = q<HTMLInputElement>(take, "[data-lar-carriage-file]");
        const files = new DataTransfer();
        files.items.add(new File([REQUEST], "request.json", { type: "application/json" }));
        input.files = files.files;
        input.dispatchEvent(new Event("change"));
      } else {
        q<HTMLTextAreaElement>(take, "[data-lar-carriage-paste]").value = carriageFrames(REQUEST, 80).reverse().join("\n");
        q<HTMLButtonElement>(take, "[data-lar-carriage-take]").click();
      }
      await expect.poll(() => calls.length).toBe(2);
      expect(calls[1]).toEqual(["answer", GROUP, REQUEST]);
      host.remove();
    }
  });

  test("RED: the vessel's refusal shows by its name and no answer paints; a browser that holds no root says so", async () => {
    const { host } = rig({ answer: async () => { throw new Error("request-unsigned: the request does not read against this face's offer as it stands now."); } });
    await expect.poll(() => host.dataset["larFleetFaces"]).toBe("1");
    q<HTMLButtonElement>(host, "[data-lar-fleet-offer]").click();
    await settle(host, "ok");
    const take = q<HTMLElement>(host, "[data-lar-fleet-step='request']");
    q<HTMLTextAreaElement>(take, "[data-lar-carriage-paste]").value = REQUEST;
    q<HTMLButtonElement>(take, "[data-lar-carriage-take]").click();
    await settle(host, "refused");
    expect(q<HTMLElement>(host, "[data-lar-fleet-status]").textContent).toContain("request-unsigned");
    expect(host.querySelector("[data-lar-fleet-step='answer']")).toBeNull();
    const none = rig({ faces: async () => [] });
    await expect.poll(() => none.host.dataset["larFleetFaces"]).toBe("0");
    expect(none.host.querySelector("[data-lar-fleet-offer]")).toBeNull();
    expect(q<HTMLElement>(none.host, "[data-lar-fleet-status]").textContent).toContain("holds no face's root");
  });

  test("RED: a device that reads no QR code by camera refuses by name, each capability in the order a person cures it", async () => {
    const detector = class { static getSupportedFormats = async () => ["qr_code"]; detect = async () => []; } as never;
    const media = { getUserMedia: async () => { throw new Error("denied"); } } as never;
    expect(await cameraReadRefusal({ isSecureContext: false, mediaDevices: media, BarcodeDetector: detector })).toBe("camera-insecure-context");
    expect(await cameraReadRefusal({ isSecureContext: true, mediaDevices: undefined, BarcodeDetector: detector })).toBe("camera-absent");
    expect(await cameraReadRefusal({ isSecureContext: true, mediaDevices: media, BarcodeDetector: undefined })).toBe("qr-reader-absent");
    expect(await cameraReadRefusal({ isSecureContext: true, mediaDevices: media, BarcodeDetector: class { static getSupportedFormats = async () => ["ean_13"]; } as never })).toBe("qr-reader-absent");
    expect(await cameraReadRefusal({ isSecureContext: true, mediaDevices: media, BarcodeDetector: detector })).toBeNull();
    // On the page: the button names the refusal before the tap, and a tap says it in words and reads nothing.
    const host = document.createElement("div");
    document.body.append(host);
    const taken: string[] = [];
    takeCarriage(host, { label: "a request", onText: (t) => taken.push(t), cameraHost: { isSecureContext: true, mediaDevices: media, BarcodeDetector: undefined } });
    const camera = q<HTMLButtonElement>(host, "[data-lar-carriage-camera]");
    await expect.poll(() => camera.dataset["larRefusal"]).toBe("qr-reader-absent");
    camera.click();
    await expect.poll(() => host.dataset["larCameraRefusal"]).toBe("qr-reader-absent");
    expect(q<HTMLElement>(host, "[data-lar-carriage-said]").textContent).toContain("paste the text or pick the file");
    // A granted reader whose camera the person denies names that too.
    const denied = document.createElement("div");
    document.body.append(denied);
    takeCarriage(denied, { label: "a request", onText: (t) => taken.push(t), cameraHost: { isSecureContext: true, mediaDevices: media, BarcodeDetector: detector } });
    q<HTMLButtonElement>(denied, "[data-lar-carriage-camera]").click();
    await expect.poll(() => denied.dataset["larCameraRefusal"]).toBe("camera-denied");
    expect(taken).toEqual([]);
  });
});
