import { KapaeRefused } from "./promote-kapae.js";

export const FACE_PLANE = "face";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type Projection = { readonly planes: Readonly<Record<string, string | undefined>> };
export function faceRelationOf(projection: Projection): string | null {
  const value = projection.planes[FACE_PLANE];
  return value && UUID_V4.test(value) ? value : null;
}
export function mintFaceRelation(projection: Projection): string {
  if (projection.planes[FACE_PLANE] !== undefined) throw new KapaeRefused("face-relation-already-minted", "the face already carries a relation pin");
  return crypto.randomUUID();
}
