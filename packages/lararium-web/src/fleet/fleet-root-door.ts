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

/**
 * THE FIRST OFFER FOUNDS THE FACE (the-veil-ladder#/the-base-model). A veil that offers a face to another device holds no
 * face yet, so its first offer founds one inside the act: `ask` carries the person's tap to the page's founding door (the
 * one-boot ask; the boot founds the face: card, bind, place KEL, then the Lift), and the boot that founded for an offer
 * mounts this door with `resume`, so the founded face's offer shows with no second tap. `resume` reads one boot's consumed
 * ask and never a stored width: a later boot mounts without it and offers nothing by itself.
 */
export interface FleetFoundingDoor { ask(): void; readonly resume: boolean }

/** Mount the door into `host`. It paints a face's offer where this browser holds that face's root, and a founding offer where it holds none and the page hands it a founding door. */
export function mountFleetRootDoor(host: HTMLElement, port: FleetRootPort, opts: { readonly cameraHost?: CameraHost; readonly found?: FleetFoundingDoor } = {}): { refresh(): Promise<void>; dispose(): void } {
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

  /** A veil's founding offer: one tap asks the page's founding door, once. */
  const paintFounding = (found: FleetFoundingDoor): HTMLElement => {
    const section = document.createElement("section");
    section.dataset["larFleetFace"] = "";
    const first = document.createElement("button");
    first.type = "button";
    first.dataset["larFleetFoundOffer"] = "";
    first.textContent = "offer a face to another device (this founds your face here first)";
    first.addEventListener("click", () => {
      if (first.disabled) return;
      first.disabled = true;
      say("founding your face: the ceremony asks a first passphrase and shows a place card, then the offer shows here…", "busy");
      found.ask();
    });
    section.append(first);
    return section;
  };

  // The founding boot's offer runs once for this mount: a repaint replays nothing.
  let resumed = false;
  const refresh = async (): Promise<void> => {
    taking?.stop(); taking = null;
    try {
      const faces = await port.faces();
      const sections = faces.map(paintFace);
      const founding = faces.length === 0 && opts.found ? paintFounding(opts.found) : null;
      body.replaceChildren(...sections, ...(founding ? [founding] : []));
      host.dataset["larFleetFaces"] = String(faces.length);
      if (faces.length === 0) say(founding ? "this browser stands as a veil: its first offer founds a face here, and that face grows its fleet." : "this browser holds no face's root: a face founded here, or on another vessel that offers it, grows its fleet.", "idle");
      else say("", "idle");
      // The boot founded for an offer: the one face it founded offers now. More than one face names no single offer to resume.
      if (opts.found?.resume && !resumed && faces.length === 1) {
        resumed = true;
        sections[0]!.querySelector<HTMLButtonElement>("[data-lar-fleet-offer]")?.click();
      }
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
  /** A read-only instrument: the active wiki's working layer as this vessel mounted it. */
  workbench(): Promise<{ readonly slug: string; readonly bagId: string; readonly documentUrl: string | null }>;
}

/**
 * THE JOINED LEAF's seat door: with no road to the vessel that holds the face, this browser shows its seat request and
 * takes the grant back by the same hands that carried the join. `onKept` runs once a grant rests; the page then boots again,
 * where the kept grant lifts the face at this browser's place and the daemon island's seat reads it.
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
              (kept) => { say("✓ seat grant kept. This browser boots again, lifts the face at its own place and takes its seat.", "ok"); opts.onKept(kept); },
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
