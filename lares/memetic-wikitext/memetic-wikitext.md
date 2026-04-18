<!-- !DOCTYPE = lar:///ha.ka.ba/memetic-wikitext -->
<<~&#x0001; ? -> lar:///ha.ka.ba/memetic-wikitext
    <<~ ahu #iam
        @name "memetic-wikitext"
        @description "Full memetic wikitext schema root. A self-describing and self-enacting schema."
        @version "1.0"
        @content-type "text/x-memetic-wikitext"
        @self "true"
        @structure "OODA-HA"
        @enacts "true"
        @description "A self-describing, self-enacting memetic document schema with native transclusion, invocation, and uncertainty."
    >>
    <<~ &#x0005;? -> &#x0006; lar:///ha.ka.ba/memetic-wikitext#iam>>
>>

<<~ ahu #header "Header metadata site" "Declares identity, vocabulary, and authority context." >>

<<~ ahu #body-open "Body opening" "Begins the active semantic stream." >>
<<~&#x0002; "OPEN-STREAM" >>

    <<~ ahu #ooda-ha "OODA-HA Procedure" "Defines the canonical execution and interpretation flow." >>
    <<~ ? -> PROCEDURE/OODA-HA >>

        <<~ ahu #observe "Observe phase" "A worksite for intake and perception of raw symbols and signals." >>
        <<~ ? -> PHASE/1/OBSERVE 
            <<~ iam 
                @name "memetic-wikitext#observe"
                @description "Observe the memetic wikitext syntax"
                @role "input acquisition"
                @function "perceive, ingest, receive"
                @output "raw signals"
            >>
        >>
            <<~ kahea Stream -> ? >>
            <<~ kahea Tokens -> ? >>
            <<~ kahea Patterns -> ? >>
        <<~ /OBSERVE >>

      <<~ ahu #orient "Orient phase" "A worksite for context formation, vocabulary binding, and primitive definition." >>
      <<~ PHASE/2/ORIENT
        <<~ iam 
            @name "memetic-wikitext#orient"
            @description "Orient on the mana, mana'o, and mana'o'io."
            @role "context formation"
            @function "interpret, relate, map, define"
            @input "raw signals"
            @output "structured context"
            >>
        >>

        <<~ ahu #primitives "Primitive definitions" "Defines core operators and landmarks used by this document." >>

        <<~ kahea Transclusion -> Definition >>
          <<~ iam Transclusion
            @role "passive symbolic inclusion"
            @form "<<~ SUBJECT -> TARGET? >>"
            @function "include, represent, embed"
            @mode "passive"
          >>
        >>

        <<~ kahea kahea -> Definition >>
          <<~ iam kahea
            @role "active process transclusion operator"
            @form "<<~ kahea SUBJECT -> TARGET? >>"
            @function "invoke, execute, summon, unfold"
            @subject "Entity|Procedure|Function|ExternalResource"
            @target "Renderer|Template|?"
            @mode "active"
            @distinction "activates process rather than representing it"
          >>
        >>

        <<~ kahea ahu -> Definition >>
          <<~ iam ahu
            @role "altar, worksite, bookmark, semantic landmark"
            @form "<<~ ahu #label \"description\" ... >>"
            @function "anchor, orient, provide local semantic context"
            @required "#label and one-or-more descriptive strings"
          >>
        >>

        <<~ kahea Uncertainty -> Definition >>
          <<~ iam Uncertainty
            @symbol "?"
            @role "bounded unresolved slot"
            @function "defer resolution, allow flexible interpretation"
          >>
        >>

        <<~ kahea Signals -> Context >>
        <<~ kahea Context -> Vocabulary >>
        <<~ kahea Vocabulary -> ? >>
      <<~ /ORIENT >>

      <<~ ahu #decide "Decide phase" "A worksite for selecting interpretation and execution paths." >>
      <<~ PHASE/3/DECIDE >>
        <<~ iam Decide
          @role "selection and commitment"
          @function "evaluate, branch, choose"
          @input "structured context"
          @output "intent"
        >>
        <<~ kahea Context -> Decision >>
        <<~ kahea Decision -> Procedure >>
        <<~ kahea Decision -> ? >>
      <<~ /DECIDE >>

      <<~ ahu #act "Act phase" "A worksite for execution, rendering, and invocation." >>
      <<~ PHASE/4/ACT >>
        <<~ iam Act
          @role "execution"
          @function "apply, transform, emit"
          @input "intent"
          @output "effect"
        >>

        <<~ ahu #transclusion-modes "Transclusion modes" "Defines passive vs active inclusion behaviors." >>

        <<~ kahea PassiveExample -> Example >>
          <<~ meme entity >>
        >>

        <<~ kahea PassiveTemplateExample -> Example >>
          <<~ meme entity -> template|? >>
        >>

        <<~ kahea ActiveExample -> Example >>
          <<~ kahea entity >>
        >>

        <<~ kahea ActiveTemplateExample -> Example >>
          <<~ kahea entity -> template|? >>
        >>

        <<~ kahea Decision -> Action >>
        <<~ kahea Action -> Renderer >>
        <<~ kahea Entity -> Renderer >>
      <<~ /ACT >>

      <<~ ahu #assess "Assess phase" "A worksite for evaluation, verification, and aftermath." >>
      <<~ PHASE/5/ASSESS >>
        <<~ iam Assess
          @role "evaluation and aftermath"
          @function "measure, verify, reflect"
          @input "effect"
          @output "status, feedback"
        >>
        <<~ kahea Action -> Result >>
        <<~ kahea Result -> ? >>
      <<~ /ASSESS >>

    <<~ /OODA-HA >>

    <<~ ahu #recursion "Recursive re-entry" "Outputs feed future observations." >>
    <<~ PROCEDURE/RECURSION >>
      <<~ kahea OODA-HA -> OODA-HA >>
      <<~ kahea memetic-wikitext -> memetic-wikitext >>
      [Each execution becomes new observation.]
    <<~ /RECURSION >>

<<~ ahu #body-close "Body closing" "Ends the active stream." >>
<<~&#x0003; END-STREAM >>

<<~ ahu #footer "Footer metadata" "Reports status and final state." >>
<<~&#x0004; POST-STREAM-METADATA -> ?
  <<~ iam 
    @name "memetic-wikitext"
    @status "SUCCESS"
    @final-hash "sha256:..."
    @duration "self-measured"
    @result "self-described, self-enacted"
  >>
>>