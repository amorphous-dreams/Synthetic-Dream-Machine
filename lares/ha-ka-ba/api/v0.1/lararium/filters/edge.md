<<~&#x0001; ? -> lar:///ha.ka.ba/api/v0.1/lararium/filters/edge >>
```toml iam
uri-path      = "ha.ka.ba/api/v0.1/lararium/filters/edge"
file-path     = "lares/ha-ka-ba/api/v0.1/lararium/filters/edge.md"
type          = "text/x-memetic-wikitext"
register      = "CS"
confidence    = 0.88
mana          = 0.88
role          = "anchor: registerEdgeOperator — heleuma ka"
heleuma       = "ka"
source-file   = "packages/lararium-tw5/src/tw5-widgets.ts"
source-symbol = "registerEdgeOperator"
module-ref    = "lar:///ha.ka.ba/api/v0.1/lararium/filters/edge-tw5"
body-sha256   = "b5acd21f560e7c7ece02012049a8370ac2effc2422dccab1210512a8e02e34c4"
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

<<~ pranala #to-tw5-widgets ? -> lar:///ha.ka.ba/api/v0.1/lararium/modules/tw5-widgets family:control role:implements >>
<<~ pranala #to-module ? -> lar:///ha.ka.ba/api/v0.1/lararium/filters/edge-tw5 family:control role:module >>

<<~/ahu >>

<<~&#x0003;>>
<<~&#x0004; -> ? >>
