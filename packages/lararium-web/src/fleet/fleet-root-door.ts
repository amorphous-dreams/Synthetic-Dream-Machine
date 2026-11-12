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
  /** THE CARRIED SEAT: the grant for one seat request a joined device shows after it lands the answer. Absent on a port that seats by sync alone. */
  seat?(request: string): Promise<string>;
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
    const seatHost = document.createElement("div");
    const grantHost = document.createElement("div");
    let takingSeat: { stop(): void } | null = null;
    section.append(heading, offer, shown, requestHost, answerHost, seatHost, grantHost);

    const answer = (request: string): void => {
      say("answering: unlock this face in the ceremony window when it asks…", "busy");
      port.answer(face.personaGroup, request).then(
        (text) => {
          showCarriage(answerHost, { text, fileName: "answer.json", label: "the fleet-join answer" });
          answerHost.dataset["larFleetStep"] = "answer";
          say("✓ answered. Carry the answer to the other device; it lands the face there." + (port.seat ? " Then bring back the seat request it shows, and this face seats it." : ""), "ok");
          if (port.seat) {
            const seat = port.seat.bind(port);
            seatHost.dataset["larFleetStep"] = "seat-request";
            takingSeat?.stop();
            takingSeat = takeCarriage(seatHost, { label: "the seat request the other device shows after it lands", ...(opts.cameraHost ? { cameraHost: opts.cameraHost } : {}), onText: (seatRequest) => {
              say("seating…", "busy");
              seat(seatRequest).then(
                (grant) => { showCarriage(grantHost, { text: grant, fileName: "seat-grant.json", label: "the seat grant" }); grantHost.dataset["larFleetStep"] = "seat-grant"; say("✓ seated. Carry the seat grant to the other device; it reads what this face seals from then on.", "ok"); },
                (err: unknown) => { say(`✗ ${words(err)}`, "refused"); },
              );
            } });
          }
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

/** The joined leaf's seat verbs as the page reaches them. */
export interface FleetSeatPort {
  /** The faces this browser joined and holds no root for. */
  faces(): Promise<readonly { readonly personaGroup: string; readonly label: string }[]>;
  /** This browser's seat request for one joined face, as a file. */
  request(personaGroup: string): Promise<string>;
  /** Keep a carried seat grant; answers the face it seats. The vessel's seat reads it at its next boot. */
  land(grant: string): Promise<string>;
}

/**
 * THE JOINED LEAF's seat door: with no road to the vessel that holds the face, this browser shows its seat request and
 * takes the grant back by the same hands that carried the join. `onKept` runs once a grant rests and the vessel's seat has
 * been woken to read it.
 */
export function mountFleetSeatDoor(host: HTMLElement, port: FleetSeatPort, opts: { readonly onKept: (face: string) => void; readonly cameraHost?: CameraHost }): { refresh(): Promise<void> } {
  host.dataset["larFleetDoor"] = "seat";
  const status = document.createElement("div");
  status.setAttribute("role", "status");
  status.dataset["larFleetStatus"] = "";
  const body = document.createElement("div");
  host.replaceChildren(body, status);
  const say = (text: string, state: "idle" | "busy" | "ok" | "refused"): void => { status.textContent = text; host.dataset["larFleetState"] = state; };
  const paint = (face: { readonly personaGroup: string; readonly label: string }): HTMLElement => {
    const section = document.createElement("section");
    section.dataset["larFleetFace"] = face.personaGroup;
    const ask = document.createElement("button");
    ask.type = "button";
    ask.dataset["larFleetSeatAsk"] = "";
    ask.textContent = `ask face ${face.label} for this device's seat, by file`;
    const shown = document.createElement("div");
    const grantHost = document.createElement("div");
    section.append(ask, shown, grantHost);
    ask.addEventListener("click", () => {
      say("composing the seat request…", "busy");
      port.request(face.personaGroup).then(
        (text) => {
          showCarriage(shown, { text, fileName: "seat-request.json", label: "this device's seat request" });
          shown.dataset["larFleetStep"] = "seat-request";
          grantHost.dataset["larFleetStep"] = "seat-grant";
          takeCarriage(grantHost, { label: "the seat grant the root holder shows", ...(opts.cameraHost ? { cameraHost: opts.cameraHost } : {}), onText: (grant) => {
            port.land(grant).then(
              (kept) => { say("✓ seat grant kept. This browser's daemon restarted in place and takes its seat.", "ok"); opts.onKept(kept); },
              (err: unknown) => { say(`✗ ${words(err)}`, "refused"); },
            );
          } });
          say("✓ seat request shown. Carry it to the root holder's fleet door, then bring its seat grant back here.", "ok");
        },
        (err: unknown) => { say(`✗ ${words(err)}`, "refused"); },
      );
    });
    return section;
  };
  const refresh = async (): Promise<void> => {
    try {
      const faces = await port.faces();
      body.replaceChildren(...faces.map(paint));
      host.dataset["larFleetFaces"] = String(faces.length);
      say("", "idle");
    } catch (err) { body.replaceChildren(); say(`✗ ${words(err)}`, "refused"); }
  };
  void refresh();
  return { refresh };
}
