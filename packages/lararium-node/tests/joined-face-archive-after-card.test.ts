/**
 * joined-face-archive-after-card — a lit sibling rests its Archive after its card, as the mounted face does.
 *
 * A sibling face restores from its veil Archive at every light and mints one card per stand (a grant, a workbench seat, a
 * revoke asks it). Its archive floor rests the Archive taken AFTER that card in the face's own row, so the next light restores
 * every prekey secret its log names. A stand whose Archive lags its log refuses BY NAME: the face, and the cause.
 */
import { afterEach, expect, test, vi } from "vitest";
import { KeyhiveProvider } from "@lararium/keyhive";
import { operatorDaemonOptions } from "@lararium/keyhive/operator-daemon-behavior";
import { DAEMON_BAG_ID } from "@lararium/mesh";
import { standFoundedIsland } from "./stand-founded-island.js";
vi.setConfig({ testTimeout: 900_000, hookTimeout: 900_000 });
const teardown: Array<() => void> = [];
afterEach(() => { while (teardown.length) teardown.pop()!(); vi.restoreAllMocks(); });

const STANDS = 120;
const OWN_BAG = "lar:///probe.sibling.own";

async function twoFaces() {
  const a = await standFoundedIsland(teardown);
  const b = await standFoundedIsland(teardown, { seedOffset: 10 });
  const { atom, personaGroupId, faceAnchor, personaKel, deviceEdge, signerDid, meshCabalDocIdHex, veilArchiveBytes, faceAddressSecret } = b.daemonAuth;
  const sibling = (archive: Uint8Array) => ({ atom, personaGroupId, faceAnchor, personaKel, deviceEdge, signerDid, meshCabalDocIdHex,
    // A bag the sibling owns past the vessel ground mints its Document at every light (no plane ledger stands for a sibling).
    veilArchiveBytes: archive, faceAddressSecret, registerBags: [DAEMON_BAG_ID, OWN_BAG] });
  return { a, b, sibling, siblingKey: atom.key, siblingGroup: personaGroupId, founded: veilArchiveBytes };
}

/** One stand of the composition; answers the sibling's provider (null where it did not light) and the warn lines. */
async function standOnce(a: Awaited<ReturnType<typeof standFoundedIsland>>, joined: unknown, siblingKey: string,
  persistVeilArchive?: (bytes: Uint8Array, face: string) => void) {
  const providers: KeyhiveProvider[] = [];
  const init = KeyhiveProvider.prototype.init;
  const spy = vi.spyOn(KeyhiveProvider.prototype, "init").mockImplementation(function (this: KeyhiveProvider, ...args) { providers.push(this); return init.apply(this, args); });
  const warns: string[] = [];
  const warn = vi.spyOn(console, "warn").mockImplementation((...line: unknown[]) => { warns.push(line.map(String).join(" ")); });
  try {
    await operatorDaemonOptions({ daemonAuth: { ...a.daemonAuth, joinedFaces: [joined] } } as never,
      { dyadReading: () => "clear", ...(persistVeilArchive ? { persistVeilArchive } : {}) }).verifierFactory!(a.ctx);
    let sibling: KeyhiveProvider | null = null;
    for (const p of providers) {
      try { if ((await p.whoami()).toLowerCase().endsWith(siblingKey.toLowerCase().replace(/^0x/, ""))) sibling = p; } catch { /* disposed: did not light */ }
    }
    return { sibling, providers, warns };
  } finally { spy.mockRestore(); warn.mockRestore(); }
}

test("a lit sibling rests its Archive after its card, and a face that cards at every light still opens", async () => {
  const { a, sibling, siblingKey, siblingGroup, founded } = await twoFaces();
  const rows = new Map<string, Uint8Array>();
  const write = (bytes: Uint8Array, face: string) => { rows.set(face, Uint8Array.from(bytes)); };
  for (let i = 0; i < 24; i++) {
    const { sibling: lit, providers, warns } = await standOnce(a, sibling(rows.get(siblingGroup) ?? founded), siblingKey, write);
    try {
      expect(warns.filter((w) => w.toLowerCase().includes("refused")), `stand ${i}`).toEqual([]);
      expect(lit, `stand ${i}: the sibling lit`).not.toBeNull();
      // THE FLOOR LANDED IN THE SIBLING'S OWN ROW at its light.
      expect(rows.has(siblingGroup), `stand ${i}: the sibling's Archive rested`).toBe(true);
      // A grant or a workbench seat asks the sibling's card: the same card its rested Archive already holds.
      await lit!.contactCard();
    } finally { await Promise.all(providers.map((p) => p.dispose().catch(() => {}))); }
  }
});

test("a sibling whose Archive lags its log refuses by name: the face, and the cause, never a raw GenerateDocError", async () => {
  const { a, sibling, siblingKey, founded } = await twoFaces();
  // No writer stands, so no Archive follows a card: every light restores the founding Archive and mints one card more, until
  // the face's live prekeys walk past every secret that Archive holds (measured within 11..32 stands for a fresh identity).
  let refused: string[] = [];
  for (let i = 0; i < STANDS && refused.length === 0; i++) {
    const { sibling: lit, providers, warns } = await standOnce(a, sibling(founded), siblingKey);
    try {
      refused = warns.filter((w) => w.toLowerCase().includes("refused"));
      if (refused.length === 0) { expect(lit, `stand ${i}`).not.toBeNull(); await lit!.contactCard(); }
      else expect(lit, `stand ${i}`).toBeNull();
    } finally { await Promise.all(providers.map((p) => p.dispose().catch(() => {}))); }
  }
  expect(refused).toHaveLength(1);
  expect(refused[0]).toContain(`face ${siblingKey}`);
  expect(refused[0]).toContain("holds no prekey secret: its Archive was absent or older than its latest card");
  expect(refused[0]).not.toMatch(/GenerateDocError/);
});
