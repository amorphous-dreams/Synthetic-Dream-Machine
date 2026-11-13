/**
 * plain-rows — THE DOOR A PUBLIC (class F) ROW READS AND WRITES THROUGH, with no key.
 *
 * A row that holds no secret rests in the clear under a law that names why (the carrier table's `bare` column): a Nexus's
 * pending crossing and its sealed transition records carry public key-sets, signatures and witnesses, which any holder of the
 * charter can verify. They rest apart from every key, so a locked vessel reads them and no unlock holds them open.
 *
 * What a sealed row guaranteed beyond secrecy stays: a row reads whole or refuses by name, and an update reads, decides and writes
 * under the custody claim (one hand at a time, in this process and across processes). Node-main only.
 */
import { join } from "node:path";
import { FsCustodyIo } from "./custody-io.js";
import { vesselCustodyHomes, type CustodyHome } from "./vault-carriers.js";
import type { RowUpdate } from "./custody-holder.js";

const ioOf = (): { readonly io: FsCustodyIo; readonly homes: ReturnType<typeof vesselCustodyHomes> } => {
  const homes = vesselCustodyHomes();
  return { io: new FsCustodyIo(homes), homes };
};
const pathOf = (home: CustodyHome, file: string): string => join(vesselCustodyHomes()[home], ...file.split("/"));

/** The row's bytes, or null where none stands. */
export async function readPlainRow(home: CustodyHome, file: string): Promise<Uint8Array | null> {
  return ioOf().io.read(pathOf(home, file));
}

/** Read the row, decide and write the next one under the custody claim; a `null` plaintext writes nothing. */
export async function updatePlainRow<T>(home: CustodyHome, file: string, decide: (standing: Uint8Array | null) => RowUpdate<T>): Promise<T> {
  const { io } = ioOf();
  const path = pathOf(home, file);
  return io.exclusive(async () => {
    const decided = decide(await io.read(path));
    if (decided.plaintext !== null) await io.write(path, decided.plaintext);
    return decided.value;
  });
}

/** Remove the row under the custody claim, only while `when` (where given) holds of its bytes; answers whether a row left. */
export async function removePlainRow(home: CustodyHome, file: string, when?: (bytes: Uint8Array) => boolean): Promise<boolean> {
  const { io } = ioOf();
  const path = pathOf(home, file);
  return io.exclusive(async () => {
    const standing = await io.read(path);
    if (standing === null || (when !== undefined && !when(standing))) return false;
    await io.remove(path);
    return true;
  });
}
