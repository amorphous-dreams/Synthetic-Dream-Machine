export function codeOnly(source: string): string;
export function listenerIndex(source: string): number;
export function violation(name: string, source: string, starters?: readonly string[]): string | null;
export function sharedViolation(name: string, source: string): string | null;
