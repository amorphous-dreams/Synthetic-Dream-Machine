/**
 * lar-chords — the page's reading of a key chord the wiki declared, in TiddlyWiki's own descriptor grammar.
 *
 * A crossing set (`data-lar-keys="enter escape alt-shift-N"`) names chords the way `parseKeyDescriptor` reads them:
 * components joined by `+` or `-`, the modifiers `ctrl`, `shift`, `alt`, `meta` (`cmd`, `win`), and one named key
 * whose code the table below gives (TiddlyWiki's own `namedKeys`). A named shortcut (`((name))`) resolves only in
 * the wiki; the engine resolves it before it declares the chord, so the page reads it as no chord.
 *
 * A chord matches a keydown the way `checkKeyDescriptor` does: the key code and all four modifiers agree.
 *
 * Meme: lar:///ha.ka.ba/lares/docs/pono/dreamdom#/what-a-sink-keeps
 */
import type { LarShortcutChord } from "@lararium/mesh/lar-camera";
import { larLogicalKeyCode } from "@lararium/mesh/lar-camera";

const NAMED: Readonly<Record<string, number>> = {
  cancel: 3, help: 6, backspace: 8, tab: 9, clear: 12, return: 13, enter: 13, pause: 19, escape: 27, space: 32,
  page_up: 33, page_down: 34, end: 35, home: 36, left: 37, up: 38, right: 39, down: 40, printscreen: 44, insert: 45,
  delete: 46, firefoxsemicolon: 59, firefoxequals: 61, multiply: 106, add: 107, separator: 108, subtract: 109,
  decimal: 110, divide: 111, firefoxminus: 173, semicolon: 186, equals: 187, comma: 188, dash: 189, period: 190,
  slash: 191, backquote: 192, openbracket: 219, backslash: 220, closebracket: 221, quote: 222,
};

/** The key code TiddlyWiki gives a key name, or 0 for none. */
export function namedKeyCode(name: string): number {
  const s = name.toLowerCase();
  if (/^[a-z]$/.test(s)) return s.charCodeAt(0) - 32;
  if (/^[0-9]$/.test(s)) return s.charCodeAt(0);
  const numpad = /^numpad([0-9])$/.exec(s);
  if (numpad) return 96 + Number(numpad[1]);
  const fn = /^f([1-9]|1[0-9]|2[0-4])$/.exec(s);
  if (fn) return 111 + Number(fn[1]);
  return NAMED[s] ?? 0;
}

/** Each chord a space-separated descriptor list declares; a descriptor naming no key reads as none. */
export function parseChords(descriptors: string): LarShortcutChord[] {
  const chords: LarShortcutChord[] = [];
  for (const descriptor of descriptors.split(" ").filter(Boolean)) {
    if (/^\(\(.*\)\)$/.test(descriptor)) continue;
    const chord = { descriptor, keyCode: 0, ctrl: false, shift: false, alt: false, meta: false };
    for (const part of descriptor.split(/\+|-/)) {
      const s = part.toLowerCase();
      if (s === "ctrl") chord.ctrl = true;
      else if (s === "shift") chord.shift = true;
      else if (s === "alt") chord.alt = true;
      else if (s === "meta" || s === "cmd" || s === "win") chord.meta = true;
      const code = namedKeyCode(s);
      if (code) chord.keyCode = code;
    }
    if (chord.keyCode) chords.push(chord);
  }
  return chords;
}

/** The first chord a keydown matches, or undefined. */
export function matchChord(event: Pick<KeyboardEvent, "key" | "keyCode" | "ctrlKey" | "shiftKey" | "altKey" | "metaKey">, chords: readonly LarShortcutChord[]): LarShortcutChord | undefined {
  return chords.find((c) => c.keyCode === larLogicalKeyCode(event.key, event.keyCode) && c.ctrl === event.ctrlKey && c.shift === event.shiftKey && c.alt === event.altKey && c.meta === event.metaKey);
}
