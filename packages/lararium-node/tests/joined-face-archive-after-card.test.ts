/**
 * joined-face-archive-after-card — a lit sibling rests its Archive after its card, as the mounted face does.
 *
 * A sibling face restores from its veil Archive at every light and mints one card per stand (a grant, a workbench seat, a
 * revoke asks it). Its archive floor rests the Archive taken AFTER that card in the face's own row, so the next light restores
 * every prekey secret its log names. A stand whose Archive lags its log refuses BY NAME: the face, and the cause.
 */
import { afterEach, expect, test, vi } from "vitest";
import { KeyhiveProvider } from "@lararium/keyhive";
import { refreshLitArchives } from "../src/joined-face-auth.js";
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

/** The prekey a contact card presents (its rotation's new key), as hex. */
function cardPrekeyHex(card: Uint8Array): string {
  const op = JSON.parse(new TextDecoder().decode(card)) as { Rotate?: { payload: { new: number[] } }; Add?: { payload: { key: number[] } } };
  const key = op.Rotate?.payload.new ?? op.Add?.payload.key;
  if (!key) throw new Error("the card presents no prekey");
  return Buffer.from(key).toString("hex");
}

/** Whether a stand holds the secret behind a prekey: its exported prekey secrets carry the public key beside each secret. */
async function holdsSecretFor(p: KeyhiveProvider, prekeyHex: string): Promise<boolean> {
  const kh = (p as unknown as { requireKh: () => { exportPrekeySecrets: () => Promise<Uint8Array> } }).requireKh();
  return Buffer.from(await kh.exportPrekeySecrets()).toString("hex").includes(prekeyHex);
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
  expect(refused[0]).toContain("holds no prekey secret: its Archive stood absent or older than its latest card");
  expect(refused[0]).not.toMatch(/GenerateDocError/);
});

test("a supervisor reopen refreshes the sibling's Archive from its row: a reopen after a card-minting stand still opens and keeps that card's secret", async () => {
  const { a, sibling, siblingKey, siblingGroup, founded } = await twoFaces();
  const rows = new Map<string, Uint8Array>();
  const write = (bytes: Uint8Array, face: string) => { rows.set(face, Uint8Array.from(bytes)); };
  // STAND ONE: the sibling lights from its founding Archive and rests the Archive after its card in its own row.
  const entry = sibling(founded);
  const first = await standOnce(a, entry, siblingKey, write);
  let cardKey: string;
  try {
    expect(first.sibling).not.toBeNull();
    cardKey = cardPrekeyHex(await first.sibling!.contactCard());
    expect(await holdsSecretFor(first.sibling!, cardKey), "CONTROL: the stand that minted the card holds its secret").toBe(true);
  } finally { await Promise.all(first.providers.map((p) => p.dispose().catch(() => {}))); }
  expect(rows.has(siblingGroup)).toBe(true);
  // THE SUPERVISOR'S REOPEN composes from the entry the light proved, held in memory, asking the lit face's own holder for its row.
  const logs: string[] = [];
  const [reopened] = await refreshLitArchives([entry], async (group) => rows.get(group) ?? null, (line) => logs.push(line));
  expect(reopened!.veilArchiveBytes).toEqual(rows.get(siblingGroup));
  expect(logs).toEqual([]);
  const again = await standOnce(a, reopened, siblingKey, write);
  try {
    expect(again.warns.filter((w) => w.toLowerCase().includes("refused"))).toEqual([]);
    expect(again.sibling).not.toBeNull();
    expect(await holdsSecretFor(again.sibling!, cardKey), "the reopen keeps the newest card's secret").toBe(true);
  } finally { await Promise.all(again.providers.map((p) => p.dispose().catch(() => {}))); }
  // CONTROL: the in-memory entry (the Archive its light restored, before its card) holds no secret for that card.
  const stale = await standOnce(a, entry, siblingKey);
  try {
    expect(stale.sibling ? await holdsSecretFor(stale.sibling, cardKey) : false).toBe(false);
  } finally { await Promise.all(stale.providers.map((p) => p.dispose().catch(() => {}))); }
});

test("a reopen whose row fails to read keeps the in-memory Archive, names the face, and refuses nothing new; a row that reads none drops it", async () => {
  const held = new Uint8Array([1, 2, 3]);
  const face = { personaGroupId: "group-of-a-lit-face", handleIndex: 2, veilArchiveBytes: held } as never;
  const unheld = { personaGroupId: "group-with-no-row", handleIndex: 3, veilArchiveBytes: held } as never;
  const logs: string[] = [];
  const out = await refreshLitArchives([face, unheld], async (group) => {
    if (group === "group-of-a-lit-face") throw new Error("the row would not open");
    return null;
  }, (line) => logs.push(line));
  // The row that fails keeps the held bytes; the row that reads none (no row, or a rehive's marker: stand from the seed)
  // drops them, so the reopen stands as that face's next boot would.
  expect(out.map((f) => (f as { veilArchiveBytes?: Uint8Array }).veilArchiveBytes)).toEqual([held, undefined]);
  expect("veilArchiveBytes" in (out[1] as object)).toBe(false);
  expect(logs).toHaveLength(1);
  expect(logs[0]).toContain("h2");
  expect(logs[0]).toContain("the row would not open");
});
