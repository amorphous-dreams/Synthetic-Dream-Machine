/**
 * carrier-fold — a carrier FOLDED: the same grammar the file rests in on disk, each folded slot's body standing as its `has`
 * line and the commands that unfold it.
 *
 * The fold cuts the carrier at the decomposer's own top-level slot scan (`findTopLevelAhuBlocks`), keeps every byte outside a
 * folded body (the declaration, the head, the meta, each slot's opener and closer, the trailer), writes each fold through the
 * read gradient's own `has` line (`hasLine`, a slot's bytes and first line), and re-stamps the block check through the frame
 * writer (`stampCarrier`). So a folded carrier reads as a canonical carrier: `lares meme check` passes on it, the slots it
 * names stand as the slots the family stores, and an unfolded slot rides byte for byte.
 *
 * Platform-blind pure functions: no store, no engine, no clock.
 *
 * Meme: lar:///ha.ka.ba/lararium/tw5/read-gradient
 */

import { stampCarrier } from "@lararium/memetic-frame";
import { findTopLevelAhuBlocks } from "./meme-ast/ahu-scan.js";
import { carrierSlots, hasLine, param, type CarrierSlot } from "./has-line.js";

export interface CarrierFold {
  /** Does this slot read unfolded (its body kept byte for byte)? */
  readonly open: (slot: string) => boolean;
  /** The lines a folded slot carries beneath its `has` line: the commands that unfold it. */
  readonly buttons: (slot: CarrierSlot) => readonly string[];
  /** Does the record seal this slot? A sealed slot always folds, to its name alone: no first line, no command. */
  readonly sealed?: (slot: string) => boolean;
  /** Lines seated ahead of the first slot: the carrier's own `has` line and the commands over the whole of it. */
  readonly lead?: (slots: readonly CarrierSlot[]) => readonly string[];
}

/** A command as a carrier line: one inline code span (a command holding a backtick takes the double run). */
export const commandLine = (command: string): string => (command.includes("`") ? `\`\` ${command} \`\`` : `\`${command}\``);

/** The lines one fold writes: the slot's `has` line, then its buttons, a blank line between each. */
function foldBody(slot: CarrierSlot, buttons: readonly string[]): string {
  return `\n\n${[hasLine(slot.slot, [param("bytes", slot.bytes)], slot.first), ...buttons].join("\n\n")}\n\n`;
}

/**
 * Fold a carrier: every top-level slot `open` leaves out answers its `has` line and its buttons; the block check re-stamps over
 * the folded body. A text holding no frame returns as it stands.
 */
export function foldCarrier(text: string, fold: CarrierFold): string {
  const blocks = findTopLevelAhuBlocks(text);
  const slots = carrierSlots(text);
  let out = "";
  let from = 0;
  blocks.forEach((block, i) => {
    const slot = slots[i]!;
    if (i === 0) {
      const lead = fold.lead?.(slots) ?? [];
      out += text.slice(from, block.openStart) + (lead.length > 0 ? `${lead.join("\n\n")}\n\n` : "");
      from = block.openStart;
    }
    const sealed = fold.sealed?.(block.slot) === true;
    if (!sealed && fold.open(block.slot)) return;
    out += text.slice(from, block.bodyStart) + (sealed ? `\n\n${hasLine(slot.slot, [param("sealed", "true")], null)}\n\n` : foldBody(slot, fold.buttons(slot)));
    from = block.bodyEnd;
  });
  return stampCarrier(out + text.slice(from));
}
