<<~&#x0001; ? -> lar:///ha.ka.ba/@lararium/tw5/filters/edge >>
```toml iam
uri-path = "ha.ka.ba/@lararium/tw5/filters/edge"
file-path = "packages/lararium-tw5/memes/filters/edge.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: registerEdgeOperator — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/filters/edge.ts"
source-symbol = "registerEdgeOperator"
module-ref    = "lar:///ha.ka.ba/@lararium/tw5/filters/edge-tw5"
body-sha256 = "ba40004e870ab68dbb6fa90f6319eafa1b060e8db17e4e128eac3c461c2f68f1"
cacheable     = true
retain        = true
```

<<~&#x0002;>>

<<~ ahu #contract >>

## Contract

`edge:family[role]` — returns tiddlers that have an `edge-out-{family}-{role}` field. Omit role to match any edge in the family.

<<~/ahu >>

<<~ ahu #source >>

## Source

```typescript
tw.filterOperators["edge"] = function (source: TW5FilterSource, operator: TW5FilterOperator) {
  const family = operator.suffix ?? "";
  const role   = operator.operand ?? "";
  const results: string[] = [];
  source(function (tiddler, title: string) {
    if (!tiddler) return;
    if (role) {
      const v = tiddler.fields?.[`edge-out-${family}-${role}`];
      if (v !== undefined && v !== "") results.push(title);
    } else {
      const prefix = `edge-out-${family}-`;
      if (Object.keys(tiddler.fields ?? {}).some((k) => k.startsWith(prefix))) results.push(title);
    }
  });
  return results;
};
```

<<~/ahu >>

<<~ ahu #edges >>

<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/@lararium/tw5/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/@lararium/tw5/filters/edge-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
