<!-- <<~ !DOCTYPE = lar:///ha.ka.ba/api/v0.1/pono/memetic-wikitext >> -->

<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/modules/deserializer >>

<<~ ahu #iam >>
```toml
uri-path     = "ha.ka.ba/api/v0.1/lararium/modules/deserializer"
file-path    = "lares/ha-ka-ba/api/v0.1/lararium/modules/deserializer.md"
content-type = "text/x-memetic-wikitext"
register     = "CS"
confidence   = 0.86
mana         = 0.85
manao        = 0.83
manaoio      = 0.81
role         = "canonical source copy: TW5 tiddler deserializer for text/x-memetic-wikitext — splits .md carrier into parent + child tiddlers"
status-date  = "2026-04-30"
heleuma       = "ka"
source-file  = "packages/lararium-tw5/src/lararium-tw5.ts"
source-symbol = "_registerDeserializer"
implements    = ["lar:///ha.ka.ba/api/v0.1/pono/heleuma/ka"]
```
<<~/ahu >>

<<~&#x0002;>>

<<~ ahu #contract >>

## Deserializer — Contract

Registered in `TW5._bootModules()` imperative fallback as:

```
tw.Wiki.tiddlerDeserializerModules["text/x-memetic-wikitext"] = fn(text, fields) → object[]
```

TW5 calls this when it encounters a tiddler with `type = "text/x-memetic-wikitext"`. The deserializer wraps `splitCarrierToTiddlers(uri, text)` to produce a parent tiddler and all ahu child slot tiddlers in one call. Parse warnings are surfaced as `$:/lararium/parse-warning/<slug>` tiddlers.

**This code cannot be loaded from a meme.** It is a closure over the compiled `splitCarrierToTiddlers` function and must be registered imperatively against the live `tw.Wiki` class. It lives in `packages/lararium-tw5/src/lararium-tw5.ts`.

<<~/ahu >>

<<~ ahu #source >>

## Source (TypeScript — compiled-in)

```typescript
private static _registerDeserializer(tw: TW5Instance): void {
    if (!tw?.Wiki?.tiddlerDeserializerModules) return;
    tw.Wiki.tiddlerDeserializerModules["text/x-memetic-wikitext"] = function(text: string, fields: Record<string, unknown>) {
      const uri: string = (fields?.title as string) ?? "";
      const split = splitCarrierToTiddlers(uri, text);
      const parent = { title: uri, ...fields, ...split.parent.fields, text };
      const children = split.children.map((c) => ({ ...c.fields, title: c.title, text: c.text }));
      const result: TW5TiddlerFields[] = [parent, ...children];
      if (split.warnings.length > 0) {
        const safeSlug = uri.replace(/[^a-zA-Z0-9._-]/g, "_");
        result.push({
          title: `$:/lararium/parse-warning/${safeSlug}`,
          tags: "$:/lararium/parse-warnings",
          "carrier-uri": uri,
          "warning-count": String(split.warnings.length),
          text: split.warnings.join("\n"),
          modified: new Date().toISOString().replace(/[:.]/g, "-"),
        });
      }
      return result;
    };
  }
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #splits ? -> lar:///ha.ka.ba/api/v0.1/lararium/carrier-split family:data role:uses >>
<<~ pranala #gate ? -> lar:///ha.ka.ba/api/v0.1/lararium/modules/boot-gate family:control role:registered-by >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
