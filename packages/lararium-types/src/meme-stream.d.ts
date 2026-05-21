/**
 * meme-stream — streaming parser for the memetic-wikitext carrier protocol.
 *
 * Carrier framing uses HTML-entity control sigils as stream boundaries:
 *
 *   <<~[prefix?]&#x0001; ? -> lar:///URI >>   SOH — opens a carrier, declares URI
 *   <<~[prefix?]&#x0002;[^>]*>>               STX — header→body boundary
 *   <<~[prefix?]&#x0003;[^>]*>>               ETX — closes body (carrier done)
 *   <<~[prefix?]&#x0004;[^>]*>>               EOT — carrier exit sigil
 *   <<~ -> ? >>                                return-throat — EOT variant
 *   <<~ ahu #slot >>...<<~/ahu >>             ahu section — incremental child event
 *
 * Kapu extended range: &#x0011; = SOH variant, &#x0014; = EOT variant.
 *
 * MemeStreamParser uses an index-based scan (no buffer slicing mid-frame)
 * so fullText in carrier-close is always the complete SOH→ETX span.
 *
 * Designed for:
 *   - Single-carrier streaming: Automerge CRDT patches arriving incrementally
 *   - Multi-Realm ingestion: sequence of carriers from a remote Realm's meme stream
 *
 * This module is isomorphic (no fs/DOM/TW5 dependencies).
 */
export interface StreamEventCarrierOpen {
    kind: "carrier-open";
    uri: string;
}
export interface StreamEventAhuChild {
    kind: "ahu-child";
    uri: string;
    slot: string;
    bodyText: string;
}
export interface StreamEventCarrierClose {
    kind: "carrier-close";
    uri: string;
    fullText: string;
}
export interface StreamEventRealmDone {
    kind: "realm-done";
}
export type MemeStreamEvent = StreamEventCarrierOpen | StreamEventAhuChild | StreamEventCarrierClose | StreamEventRealmDone;
export declare class MemeStreamParser {
    private _buf;
    private _pos;
    private _state;
    private _uri;
    private _sohStart;
    private _inAhu;
    private _ahuSlot;
    private _ahuStart;
    private _ahuDepth;
    /** Push a text chunk. Returns all events emitted during this chunk. */
    push(chunk: string): MemeStreamEvent[];
    /** Signal end of input — flushes any open carrier as a best-effort close. */
    flush(): MemeStreamEvent[];
    private _drain;
    /** Trim fully-consumed prefix of _buf to keep memory bounded. */
    private _gc;
}
//# sourceMappingURL=meme-stream.d.ts.map