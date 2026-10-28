const CID = /^[0-9a-f]{64}$/;
/** A CAS member id: 64 lowercase hex, or a refusal by name. */
export const named = (kind: string, cid: string): string => {
  if (!CID.test(cid)) throw new Error(`glass-${kind}-cid-refused:${cid.slice(0, 80)}`);
  return cid;
};

