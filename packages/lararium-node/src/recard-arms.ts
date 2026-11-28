/**
 * recard-arms — the faces whose NEXT light recards (`lares vault recard face=N`; the custody door arms one).
 *
 * An arm never outlives the act that armed it: the light that follows TAKES it the moment it starts, before it reads custody,
 * proves the face or reads `live()`, so a light that fails anywhere spends the arm and the next ordinary light recards
 * nothing. A face's close, drop or a whole lock clears an arm no light took.
 */
export interface RecardArms {
  /** Arm face `ordinal`'s next light. */
  arm(ordinal: number): void;
  /** Clear face `ordinal`'s arm (its close, its drop, its key's lock). */
  clear(ordinal: number): void;
  /** Clear every arm (a whole lock). */
  clearAll(): void;
  /** Whether an arm stands for face `ordinal` (read-only). */
  armed(ordinal: number): boolean;
}

export function recardArms(): RecardArms & { readonly take: (ordinal: number) => boolean } {
  const arms = new Set<number>();
  return {
    arm: (ordinal) => { arms.add(ordinal); },
    clear: (ordinal) => { arms.delete(ordinal); },
    clearAll: () => { arms.clear(); },
    armed: (ordinal) => arms.has(ordinal),
    take: (ordinal) => arms.delete(ordinal),
  };
}

/** Run one light of face `ordinal` with its arm TAKEN FIRST: the light reads whether it recards, and the arm is spent either way. */
export function armedLight<T>(arms: { readonly take: (ordinal: number) => boolean }, ordinal: number, light: (recard: boolean) => Promise<T>): Promise<T> {
  const recard = arms.take(ordinal);
  return light(recard);
}
