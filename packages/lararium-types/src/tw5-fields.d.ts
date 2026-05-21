/**
 * Canonical TW5 field shapes shared across Lararium.
 *
 * These live in @lararium/types so the store layer, TW5 bridge layer, and
 * projection layers can all share one authority model for tiddler field bags.
 */
/**
 * Raw/open field bag accepted by `new $tw.Tiddler(...)`, deserializers, and
 * `wiki.addTiddler(...)`.
 */
export interface ITW5TiddlerInputFields {
    title?: string;
    text?: string;
    tags?: string | string[];
    type?: string;
    created?: Date | string;
    modified?: Date | string;
    creator?: string;
    modifier?: string;
    revision?: string;
    list?: string | string[];
    [field: string]: unknown;
}
export type TW5TiddlerInputFields = ITW5TiddlerInputFields;
/**
 * Helper for boundaries that require a TW5 input bag with a concrete title.
 */
export type TW5TiddlerInputFieldsWithTitle = TW5TiddlerInputFields & {
    title: string;
};
/**
 * Materialized/frozen runtime field bag exposed on `tiddler.fields` after TW5
 * field-module parsing.
 */
export interface ITW5TiddlerFields extends Omit<ITW5TiddlerInputFields, "title" | "tags" | "list" | "created" | "modified"> {
    title: string;
    tags?: readonly string[];
    type?: string;
    created?: Date;
    modified?: Date;
    list?: readonly string[];
    [field: string]: unknown;
}
export type TW5TiddlerFields = ITW5TiddlerFields;
//# sourceMappingURL=tw5-fields.d.ts.map