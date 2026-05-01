<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/filters/implementors >>
```toml iam
uri-path      = "ha.ka.ba/api/v0.1/lararium/filters/implementors"
file-path     = "lares/ha-ka-ba/api/v0.1/lararium/filters/implementors.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: registerImplementorsOperator — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
source-symbol = "registerImplementorsOperator"
module-ref    = "lar:///ha.ka.ba/api/v0.1/lararium/filters/implementors-tw5"
body-sha256   = "f42a9cb44873b64b3bc2d06c991939f4e63a639d2ddb69ac4ca9b448d7b618b7"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`implementors[X]` — returns tiddlers whose `implements` field (space-separated list) contains X.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
tw.filterOperators["implementors"] = function (source: TW5FilterSource, operator: TW5FilterOperator) {
  const target  = operator.operand ?? "";
  const results: string[] = [];
  source(function (tiddler, title: string) {
    if (!tiddler) return;
    const raw: string = String(tiddler.fields?.["implements"] ?? "");
    const tokens: string[] = tw.utils.parseStringArray(raw) ?? [];
    if (tokens.includes(target)) results.push(title);
  });
  return results;
};
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/api/v0.1/lararium/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/api/v0.1/lararium/filters/implementors-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
