/**
 * fleet-root-door — THE ROOT HOLDER's fleet-join door on a page: a browser that wears a face it founded offers that
 * face to another of the same person's devices, and answers the request that comes back.
 *
 *   1. OFFER    the page asks the vessel for the face's offer and shows it (text, a file, QR codes).
 *   2. REQUEST  the other device reads the offer and shows its request; this page takes it (a paste, a file, a camera).
 *   3. ANSWER   the page hands the request to the vessel. The vessel asks the face's unlock BY THE CEREMONY DOOR, signs
 *               under the face's root, seals the face's address secret to the request, and hands back the answer; the
 *               page shows it for the other device to land.
 *
 * THE PAGE HOLDS FILES AND NOTHING ELSE. The offer, the request and the answer are signed or sealed public records; the
 * root key, its ward route and the address secret stay behind the vessel's port and the ceremony window. No server takes
 * part in the carriage: the three files cross by the person's own hands.
 *
 * A browser that holds no root for the face it wears refuses by the vessel's own name (`root-absent`), and the door says
 * so: the vessel that founded the face answers its joins.
 *
 * Canon: lar:///ha.ka.ba/lares/docs/pono/device-capabilities-2026#/device-seats · lar:///ha.ka.ba/lararium/mesh/membership-doctrine
 */
import { showCarriage, takeCarriage } from "./carriage-panel.js";
import type { CameraHost } from "./carriage-qr.js";

/** The vessel's root-holder verbs as the page reaches them: files in, files out. */
export interface FleetRootPort {
  /** The faces this browser holds a root for: the PersonaGroup and the words the page shows for it. */
  faces(): Promise<readonly { readonly personaGroup: string; readonly label: string }[]>;
  /** The face's offer, as the file a joining vessel reads. */
  offer(personaGroup: string): Promise<string>;
  /** The answer to one request, as the file the joining vessel lands. The vessel asks the face's unlock by the ceremony door. */
  answer(personaGroup: string, request: string): Promise<string>;
}

const words = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/** Mount the door into `host`. It paints nothing until the vessel names a face this browser holds a root for. */
export function mountFleetRootDoor(host: HTMLElement, port: FleetRootPort, opts: { readonly cameraHost?: CameraHost } = {}): { refresh(): Promise<void>; dispose(): void } {
  host.dataset["larFleetDoor"] = "root";
  const status = document.createElement("div");
  status.setAttribute("role", "status");
  status.dataset["larFleetStatus"] = "";
  const body = document.createElement("div");
  host.replaceChildren(body, status);
  let taking: { stop(): void } | null = null;
  const say = (text: string, state: "idle" | "busy" | "ok" | "refused"): void => { status.textContent = text; host.dataset["larFleetState"] = state; };

  const paintFace = (face: { readonly personaGroup: string; readonly label: string }): HTMLElement => {
    const section = document.createElement("section");
    section.dataset["larFleetFace"] = face.personaGroup;
    const heading = document.createElement("h3");
    heading.textContent = `grow this face's fleet: ${face.label}`;
    const offer = document.createElement("button");
    offer.type = "button";
    offer.dataset["larFleetOffer"] = "";
    offer.textContent = "offer this face to another device";
    const shown = document.createElement("div");
    const requestHost = document.createElement("div");
    const answerHost = document.createElement("div");
    section.append(heading, offer, shown, requestHost, answerHost);

    const answer = (request: string): void => {
      say("answering: unlock this face in the ceremony window when it asks…", "busy");
      port.answer(face.personaGroup, request).then(
        (text) => {
          showCarriage(answerHost, { text, fileName: "answer.json", label: "the fleet-join answer" });
          answerHost.dataset["larFleetStep"] = "answer";
          say("✓ answered. Carry the answer to the other device; it lands the face there.", "ok");
        },
        (err: unknown) => { say(`✗ ${words(err)}`, "refused"); },
      );
    };
    offer.addEventListener("click", () => {
      say("offering…", "busy");
      port.offer(face.personaGroup).then(
        (text) => {
          showCarriage(shown, { text, fileName: "offer.json", label: "the fleet-join offer" });
          shown.dataset["larFleetStep"] = "offer";
          answerHost.replaceChildren();
          taking?.stop();
          requestHost.dataset["larFleetStep"] = "request";
          taking = takeCarriage(requestHost, { label: "the request the other device shows", onText: answer, ...(opts.cameraHost ? { cameraHost: opts.cameraHost } : {}) });
          say("✓ offered. Show the offer to the other device, then bring its request back here.", "ok");
        },
        (err: unknown) => { say(`✗ ${words(err)}`, "refused"); },
      );
    });
    return section;
  };

  const refresh = async (): Promise<void> => {
    taking?.stop(); taking = null;
    try {
      const faces = await port.faces();
      body.replaceChildren(...faces.map(paintFace));
      host.dataset["larFleetFaces"] = String(faces.length);
      if (faces.length === 0) say("this browser holds no face's root: a face founded here, or on another vessel that offers it, grows its fleet.", "idle");
      else say("", "idle");
    } catch (err) { body.replaceChildren(); say(`✗ ${words(err)}`, "refused"); }
  };
  void refresh();
  return { refresh, dispose: () => { taking?.stop(); host.replaceChildren(); } };
}
