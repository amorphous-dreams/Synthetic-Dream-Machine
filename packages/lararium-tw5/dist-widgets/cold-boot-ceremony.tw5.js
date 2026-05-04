Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
//#region src/cold-boot-ceremony.ts
/**
* cold-boot-ceremony — void-start operator identity tiddler builder.
*
* Runs in TW5 VM (compiled as IIFE) and in Node (imported as TS module).
* Produces the IdentityTiddler + operators GroupTiddler for the device operator
* on first boot, when IdentitiesDoc has no principals.
*
* Key derivation (Brooklyn Zelenka / UCAN / Keyhive alignment):
*   did:key = "did:key:z" + base58btc(0xed 0x01 || verifyingKeyBytes)
*   multicodec prefix 0xed01 = Ed25519 public key (varint-encoded 0x1300)
*   verifyingKeyBytes = raw 32-byte Ed25519 public key
*
* The device Ed25519 keypair is the identity root.
* GitHub / BlueSky auth enriches displayName only — they do not own the DID.
* verifyingKey field is populated now; Keyhive BeeKEM consumes it when available.
*
* No external imports — self-contained IIFE in TW5 wiki context.
*
* Meme: lar:///ha.ka.ba/@lararium/tw5/modules/cold-boot-ceremony
*/
var BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58btcEncode(bytes) {
	let n = 0n;
	for (const byte of bytes) n = n * 256n + BigInt(byte);
	let out = "";
	while (n > 0n) {
		out = BASE58_ALPHABET[Number(n % 58n)] + out;
		n = n / 58n;
	}
	for (const byte of bytes) {
		if (byte !== 0) break;
		out = "1" + out;
	}
	return out;
}
function hexToBytes(hex) {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	return bytes;
}
/** Ed25519 multicodec prefix (varint 0x1300 → bytes 0xed 0x01). */
var ED25519_MULTICODEC = new Uint8Array([237, 1]);
/**
* Derive did:key from a hex-encoded 32-byte Ed25519 verifying key.
*
* Format: "did:key:z" + base58btc(0xed || 0x01 || pubkeyBytes)
* Spec: https://w3c-ccg.github.io/did-method-key/#ed25519-x25519
*/
function didKeyFromVerifyingKey(verifyingKeyHex) {
	const pubkey = hexToBytes(verifyingKeyHex);
	const prefixed = new Uint8Array(ED25519_MULTICODEC.length + pubkey.length);
	prefixed.set(ED25519_MULTICODEC, 0);
	prefixed.set(pubkey, ED25519_MULTICODEC.length);
	return "did:key:z" + base58btcEncode(prefixed);
}
var SOCIAL_HOST = "ha.ka.ba";
var IDENTITIES_BAG_URI = `lar:///${SOCIAL_HOST}/@identities`;
var GROUPS_BAG_URI = `lar:///${SOCIAL_HOST}/@groups`;
function identityTiddlerUri(did) {
	return `${IDENTITIES_BAG_URI}/${did}`;
}
function groupTiddlerUri(id) {
	return `${GROUPS_BAG_URI}/${id}`;
}
/**
* Build void-start ceremony tiddlers.
*
* Returns [IdentityTiddler, GroupTiddler] keyed for IdentitiesDoc and GroupsDoc.
* Caller writes each into the appropriate Automerge doc handle.
*
* Idempotency: caller MUST check the tiddler title doesn't already exist before writing.
*/
function buildCeremonyTiddlers(verifyingKeyHex, displayName) {
	const did = didKeyFromVerifyingKey(verifyingKeyHex);
	const now = (/* @__PURE__ */ new Date()).toISOString();
	const name = displayName ?? did.slice(0, 20) + "…";
	return [{
		title: identityTiddlerUri(did),
		bag: IDENTITIES_BAG_URI,
		authority: "cold-boot-ceremony",
		fields: {
			did,
			displayName: name,
			createdAt: now,
			kind: "operator",
			verifyingKey: verifyingKeyHex,
			readPolicy: "private"
		}
	}, {
		title: groupTiddlerUri("operators"),
		bag: GROUPS_BAG_URI,
		authority: "cold-boot-ceremony",
		fields: {
			id: "operators",
			displayName: "Operators",
			createdAt: now,
			memberDids: did,
			capabilityPolicy: "group:operators"
		}
	}];
}
//#endregion
exports.buildCeremonyTiddlers = buildCeremonyTiddlers;
exports.didKeyFromVerifyingKey = didKeyFromVerifyingKey;
