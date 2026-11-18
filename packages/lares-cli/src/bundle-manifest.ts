/**
 * bundle-manifest — the house bundle a keep cuts and a restore imports. Its one reader stands beneath the vessel
 * (`@lararium/node`, `packages/lararium-node/src/bundle-manifest.ts`), so the vessel derives a keep's bundle id from the staged
 * tree itself; the CLI's export, import and keep read the same module through this door.
 */
export {
  BUNDLE_SCHEMA, MANIFEST_FILE, REDECLARE_FILE, KAHUA_HEADS_FILE, BundleVerifyRefused,
  sha256Hex, bundleIdOf, zeroCounts, unsafeRelPath, walkBundle, bundleBytes, verifyBundle, relUnder, openBundle, sealRedeclare, KEEP_SEAL_BAG,
} from "@lararium/node";
export type {
  BundleLayer, BundleFile, BundleRow, BundleFace, BundleOmission, BundleManifest, BundleRedeclareFace, BundleShareEntry, BundleRedeclare,
  BundleKahuaHead, VerifiedBundle, SealedBundle, BundleDiskManifest, BundleFaceKey,
} from "@lararium/node";
