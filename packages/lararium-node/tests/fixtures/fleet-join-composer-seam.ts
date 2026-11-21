/**
 * fleet-join-composer-seam — the root holder's composers (`@lararium/mesh` `composeFleetJoinOffer`,
 * `composeFleetJoinAnswer`) rebuilt over a suite's STUB primitives, for the suites that mock `@lararium/mesh` whole.
 *
 * Those suites read what the NODE's door does with its own shores (which face it asks, which seam it reaches, in what
 * order), with every mesh primitive a stub. The composer's own law has its reds in mesh (`fleet-join-root.test.ts`);
 * this seam keeps the composer's ORDER over the doors (the seat, each certificate, the issued note, then the root opened
 * once for the grants, the seal and the signature), so a suite's stubs still see each call the composer makes.
 */
type Stub = (...args: never[]) => unknown;
interface Doors {
  seat(request: unknown): Promise<{ edge: unknown; reach: unknown; hearth: { carriage: { gatePin: unknown; canon: Record<string, string> }; charter: string; admit: unknown; floorPins: unknown[] } | null }>;
  certify(request: unknown, apart: readonly string[]): Promise<unknown>;
  noteIssued(issued: { device: string; certificates: unknown[] }): Promise<void>;
  withRoot<T>(act: (sign: (image: Uint8Array) => Promise<string>) => Promise<T>): Promise<T>;
  addressSecret(): Promise<Uint8Array | null>;
}

export function composerOverStubs(stubs: Record<string, unknown>): Record<string, unknown> {
  const stub = (name: string): Stub => stubs[name] as Stub;
  class FleetJoinRootRefused extends Error {
    constructor(readonly refusal: string) { super(refusal); }
  }
  return {
    FleetJoinRootRefused,
    fleetJoinHearthOf: (a: { carriage: unknown; charter: unknown; admit: unknown; floorPins: unknown }) =>
      (a.carriage === null || a.carriage === undefined ? null : { carriage: a.carriage, charter: a.charter, admit: a.admit, floorPins: a.floorPins }),
    composeFleetJoinOffer: (args: Record<string, unknown>) => (stub("fleetJoinOffer") as (o: unknown) => unknown)({ ...args, nonce: "0".repeat(64) }),
    composeFleetJoinAnswer: async (args: { request: unknown; personaGroup: string; rootKey: string; scopes: unknown; apart: readonly string[]; doors: Doors }) => {
      const nonce = (args.request as { nonce?: unknown } | null)?.nonce;
      if (typeof nonce !== "string") throw new FleetJoinRootRefused("request-malformed");
      const offer = (stub("fleetJoinOffer") as (o: unknown) => unknown)({ personaGroup: args.personaGroup, rootKey: args.rootKey, nonce, scopes: args.scopes });
      const request = (stub("readFleetJoinRequest") as (r: unknown, o: unknown, a: unknown) => { refusal?: string; atomKey: string; requests: Array<{ scope: unknown }> })(args.request, offer, args.apart);
      if (typeof request.refusal === "string") throw new FleetJoinRootRefused(request.refusal);
      const seat = await args.doors.seat(request);
      const certificates: unknown[] = [];
      for (const q of request.requests) certificates.push(await args.doors.certify(q, args.apart));
      await args.doors.noteIssued({ device: request.atomKey, certificates });
      return args.doors.withRoot(async (sign) => {
        const grants: unknown[] = [];
        for (const q of request.requests) grants.push({ personaGroup: args.personaGroup, scope: q.scope, signature: await sign((stub("faceKeyGrantImage") as (g: string, s: unknown) => Uint8Array)(args.personaGroup, q.scope)) });
        const secret = await args.doors.addressSecret();
        if (secret === null) throw new FleetJoinRootRefused("no-address-secret");
        const body = {
          nonce, atomKey: request.atomKey, personaGroup: args.personaGroup, edge: seat.edge,
          carriage: seat.hearth?.carriage ?? null, reach: seat.reach, charter: seat.hearth?.charter ?? null, admit: seat.hearth?.admit ?? null,
          floorPins: seat.hearth?.floorPins ?? [], secret: (stub("sealAddressSecret") as (a: unknown) => unknown)({ secret, request }),
        };
        return { kind: "fleet-join-answer", ...body, certificates, grants, signature: await sign((stub("fleetJoinAnswerImage") as (b: unknown) => Uint8Array)(body)) };
      });
    },
  };
}
