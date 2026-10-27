/** Narrow, closed argument grants for a face's far agent. */
import { canonicalJsonBytes } from "./crypto.js";
import { INTENT_DELEGATION_DOMAIN, INTENT_ENTRY_DOMAIN } from "./domains.js";

export type DelegationPolicy = { readonly kind: "closed-args"; readonly args: Readonly<Record<string, { readonly type: "string" | "integer" | "boolean"; readonly oneOf?: readonly (string | number | boolean)[]; readonly optional?: boolean }>> };
export type DelegationCite = { readonly roster: string } | { readonly frontier: string } | { readonly control: string };
export type DelegationBound = { readonly asOf?: DelegationCite; readonly until?: DelegationCite };
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const cid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
const keys = (v: Record<string, unknown>, allowed: readonly string[]): boolean => Object.keys(v).every((k) => allowed.includes(k));
const scalar = (type: unknown, value: unknown): boolean => type === "integer" ? Number.isSafeInteger(value) : type === "string" ? typeof value === "string" : type === "boolean" && typeof value === "boolean";
const cite = (v: unknown): v is DelegationCite => object(v) && Object.keys(v).length === 1 && Object.entries(v).every(([k, value]) => ["roster", "frontier", "control"].includes(k) && cid(value));
export function validDelegationPolicy(v: unknown): v is DelegationPolicy {
  if (!object(v) || !keys(v, ["kind", "args"]) || v.kind !== "closed-args" || !object(v.args) || Object.keys(v.args).length > 16) return false;
  for (const [key, raw] of Object.entries(v.args)) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(key) || !object(raw) || !keys(raw, ["type", "oneOf", "optional"]) || !["string", "integer", "boolean"].includes(String(raw.type))) return false;
    if (raw.optional !== undefined && typeof raw.optional !== "boolean") return false;
    if (raw.oneOf !== undefined && (!Array.isArray(raw.oneOf) || raw.oneOf.length > 32 || !raw.oneOf.every((x) => scalar(raw.type, x)))) return false;
  }
  try { canonicalJsonBytes(v); return true; } catch { return false; }
}
export function validDelegationBound(v: unknown): v is DelegationBound {
  return object(v) && keys(v, ["asOf", "until"]) && (v.asOf !== undefined || v.until !== undefined) &&
    (v.asOf === undefined || cite(v.asOf)) && (v.until === undefined || cite(v.until));
}
export function verbInPrefix(prefix: string, verb: string): boolean { return verb === prefix || verb.startsWith(prefix + "/"); }
export function argsWithinPolicy(policy: DelegationPolicy, args: unknown): boolean {
  if (!validDelegationPolicy(policy) || !object(args)) return false;
  for (const [key, value] of Object.entries(args)) {
    const rule = policy.args[key];
    if (!rule || !scalar(rule.type, value) || (rule.oneOf && !rule.oneOf.includes(value as string | number | boolean))) return false;
  }
  return Object.entries(policy.args).every(([key, rule]) => rule.optional || Object.hasOwn(args, key));
}
export function validDelegateBody(v: Record<string, unknown>): boolean {
  return keys(v, ["kind", "group", "entry", "refs", "epoch", "agent", "prefix", "policy", "bound", "nonce"]) &&
    v.kind === INTENT_DELEGATION_DOMAIN && v.entry === "delegate" && typeof v.group === "string" &&
    Array.isArray(v.refs) && v.refs.length === 0 && Number.isSafeInteger(v.epoch) && (v.epoch as number) >= 0 &&
    cid(v.agent) && typeof v.prefix === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(v.prefix) &&
    validDelegationPolicy(v.policy) && validDelegationBound(v.bound) && typeof v.nonce === "string";
}
export function validDelegationRevokeBody(v: Record<string, unknown>): boolean {
  return keys(v, ["kind", "group", "entry", "refs", "epoch", "delegation"]) && v.kind === INTENT_ENTRY_DOMAIN &&
    v.entry === "delegate-revoke" && typeof v.group === "string" && Number.isSafeInteger(v.epoch) && (v.epoch as number) >= 0 &&
    cid(v.delegation) && Array.isArray(v.refs) && v.refs.length === 1 && v.refs[0] === v.delegation;
}
