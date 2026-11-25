/**
 * place-floor-pin-door: the names the package barrel exports from `place-floor-pin.ts`, on a subpath of their own.
 *
 * `place-floor-pin.ts` exports more than the barrel lends (helpers its own package composes with); a reader that names a
 * subpath instead of the barrel reaches this door, which carries exactly the barrel's names from that module and
 * nothing else. `tools/mesh-barrel-witness.test.mjs` holds every exported subpath to the barrel's reach.
 */
export {
  PLACE_FLOOR_PIN_KIND, PLACE_FLOOR_PIN_PREFIX, PLACE_FLOOR_PIN_REFUSALS, placeFloorPinImage, signPlaceFloorPin, readPlaceFloorPin,
  placeFloorPinKey, writePlaceFloorPin, placeFloorPinsFromBoard, filePlaceFloorPins, placeArmFor, foldClaimHead,
  type PlaceFloorPinStatement, type PlaceFloorPinRefusal, type PlaceFloorPinReading, type ClaimReadAt, type ClaimStanding,
  type ClaimHeadReading, type ClaimFilingReport, type ClaimIndex,
} from "./place-floor-pin.js";
