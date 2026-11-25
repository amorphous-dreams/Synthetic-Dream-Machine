# Research: the multi-model, multi-provider swarm, and the models available in October 2026 (Terra, with web search)

You research for an operator who runs a software build crew across several AI providers. Write your findings to `out.md` in this directory, and nothing anywhere else. Cite every source by URL and date; prefer the providers' own model pages, pricing pages and release notes; mark anything you could not verify.

## The operator's setup today
- Anthropic, through Claude Code (a subscription): an Opus 5.5 controller session; Claude subagents (Opus 5.5 builders, Sonnet 5.5 leads and readers). Known current Anthropic model ids: `claude-fable-5-1`, `claude-opus-5-5`, `claude-sonnet-5-5`, `claude-haiku-5-5`.
- OpenAI, through the Codex CLI 0.165.0 (a plan with a token pool that resets): its local model cache lists `gpt-6.1-terra`, `gpt-6.1-sol`, `gpt-6-luna`, `gpt-6-sol`, `gpt-6-astra`, `gpt-5.6-terra`, `gpt-5.6-sol`, `gpt-5.6-luna`, `gpt-reserve`. The crew uses Terra-6.1 to build and Luna to read; Sol-6.1 "gets speedy" (spends the pool fast) and now joins only for named deep reads.
- GitHub Copilot CLI on a legacy annual plan (300 premium requests a month), the `gpt-5.3-codex` model at medium effort for read-only reviews; a read costs about 6 premium requests.
- The roles: controller (judgment, rulings, reads every diff), lane lead (Episkopos: drives seats, runs suites), builder (writes code and red tests in a walled worktree), reader (reviews each slice read-only), researcher (web search), aftermath sweeper (prose, naming, evergreen hygiene).

## Find, with sources
1. Each provider's current model lineup as of October 2026: names and ids, context windows, reasoning/effort controls, tool use, list prices per million input/output tokens (and cache pricing), and the provider's own recommended use cases. Include Google (Gemini) and any other provider a coding crew commonly uses now, briefly.
2. For each subscription/plan the operator uses: what it includes, how limits meter (tokens, requests, multipliers per model, reset windows), and what "spends fast" means for each model there (e.g. a premium-request multiplier, a reasoning-token cost).
3. Published or well-documented practice for multi-model coding crews: which model class fits which role (builder, reviewer, planner, researcher, sweeper), cross-lineage review (does a different-provider reviewer catch more), and cost controls (effort levels, caching, small models for mechanical passes).
4. A recommended roster for this crew, 1 page: per role, a first choice and a fallback across providers, with the cost reasoning, and which roles to keep on the subscription versus metered pools. Name what the operator should measure to confirm it (the crew already tallies spend per lane from each tool's own logs).

Keep out.md under 900 lines; mark each claim SOURCED (URL, date) or REASONED.
