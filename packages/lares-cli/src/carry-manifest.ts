/**
 * carry-manifest — the bundle a re-founding carries across. Its one reader stands beneath the vessel
 * (`@lararium/node`, `packages/lararium-node/src/carry-manifest.ts`), so the vessel derives a keep's bundle id from the staged
 * tree itself; the CLI's export, import and keep read the same module through this door.
 */
export {
  CARRY_SCHEMA, MANIFEST_FILE, REDECLARE_FILE, KAHUA_HEADS_FILE, CarryBundleRefused,
  sha256Hex, bundleIdOf, zeroCounts, unsafeRelPath, walkBundle, bundleBytes, verifyBundle, relUnder,
} from "@lararium/node";
export type {
  CarryLayer, CarryFile, CarryRow, CarryFace, CarryOmission, CarryManifest, CarryRedeclareFace, CarryShareRow, CarryRedeclare,
  CarryKahuaHead, VerifiedBundle,
} from "@lararium/node";
