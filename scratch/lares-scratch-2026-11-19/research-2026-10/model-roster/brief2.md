# Second wave (Opus): the multi-provider swarm and the October 2026 models — ratchet the first round

You are the second, ratcheting round of a research pair. The first round (OpenAI Terra-6.1 with web search) wrote `/home/joshu/.lares-scratch/research/model-roster/out.md`; its brief is `brief.md` beside it. Read both whole first. Write your result ONLY to `/home/joshu/.lares-scratch/research/model-roster/out2.md`.

## Ground you hold
- The crew's own record: `/home/joshu/.claude/projects/-home-joshu-Synthetic-Dream-Machine/memory/feedback_mixed_model_swarm.md` (roster history, the seven swarm refinements, the spend procedure), `/home/joshu/.lares-scratch/controller/spend.py` (run it: `python3 /home/joshu/.lares-scratch/controller/spend.py --since 2026-10-26` gives each lane's measured spend by model, from the tools' own logs; it is read-only), `/home/joshu/.lares-scratch/k17-r/brief.md` #Crew and #Swarm refinements.
- The operator's current rulings: default Codex crew = Sonnet Episkopos + `gpt-6.1-terra` builder + `gpt-6-luna` reader; `gpt-6.1-sol` only for a named deep question ("Codex Sol gets speedy"); Claude Opus+Sonnet pairs as the fallback; Copilot for the batch Aftermath; the operator feels budget tension and wants a durable reference.
- The measured facts of this crew (state them back from spend.py, not from memory): which lanes spent what, on which models; one hands-spine slice took 8 Opus seats and 10 Sonnet seats.

## Your work
1. VERIFY: fetch and check the first round's load-bearing SOURCED claims: the Codex plan per-5h message estimates (Terra/Sol/Luna/Astra), the Copilot legacy multipliers (GPT-5.3-Codex 6×, GPT-5.1-Codex-Mini 0.33×, Haiku 4.5 0.33×) and whether legacy annual can select the cheap ones, Anthropic's per-model pricing and its Claude Code plan metering, the "fresh eyes beat a second family" study. Mark each HOLDS / OVERSTATED / WRONG with a quote.
2. GAPS: what the first round missed: Claude Code's own subagent model selection (can a subagent run Haiku 5.5? how the plan weights Opus vs Sonnet vs Haiku subagents), Codex CLI `/usage` and how to read the pool from a script, Terra's positioning (the API page stresses screen action and drafting: is it the right BUILDER, or should Sol-6.1 at low/medium effort build while Luna reads?), effort levels as a cost lever per role, prompt caching in Claude Code subagents (stable brief prefixes).
3. YIN against the current roster: the strongest case that Terra+Luna under-reviews (Luna's recall), that Opus seats should not build at all, or that the controller itself should run on Sonnet with Opus on named rulings. Then YANG: what survives.
4. THE ROSTER, ratcheted, one page: per role (controller, Episkopos, builder, reader, deep reader, researcher, sweeper, batch Aftermath): first choice, fallback, effort, the plan it draws from, and its cost reasoning in this crew's own measured numbers; plus 3 cheap experiments the crew can run in a week to confirm it (each: what spend.py and the review records would show).
5. Open questions only the operator can rule, each with your lean.

Mark every claim SOURCED (URL, date) or REASONED. Keep out2.md under 600 lines. Reply when done with a 10-line summary.
