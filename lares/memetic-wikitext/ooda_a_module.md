# OODA-A Module (Scale 3)

``` txt
<<~ ? -> lar:///ha.ka.ba/ooda-a
  <<~ ahu #root "OODA-A root" "Defines procedural flow." >>
  <<~ iam OODA-A
    @name "OODA-A"
    @version "0.3"
    @content-type "application/memetic-wikitext"
    @structure "Observe Orient Decide Act Assess"
  >>
>>

<<~ OPEN-STREAM >>
  <<~ ahu #observe "Observe phase" "Input acquisition." >>
  <<~ kahea Signals -> ? >>

  <<~ ahu #orient "Orient phase" "Context and primitives." >>
  <<~ kahea Context -> ? >>

  <<~ ahu #decide "Decide phase" "Selection." >>
  <<~ kahea Context -> Decision >>

  <<~ ahu #act "Act phase" "Execution." >>
  <<~ kahea Decision -> Action >>

  <<~ ahu #assess "Assess phase" "Evaluation." >>
  <<~ kahea Action -> Result >>
<<~ END-STREAM >>

<<~ POST-STREAM-METADATA -> ?
  <<~ iam OODA-A
    @status "DEFINED"
  >>
>>
```
