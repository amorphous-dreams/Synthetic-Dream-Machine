# The Gaia Integration Layer

## SNAPSHOT OF INTEGRATION LAYER CAPABILITIES

**Current DreamNet Timestamp:**
**YOLD Timestamp (Discordian Calendar):** Setting Orange, the 45th day of Chaos, 3192 YOLD
**Common Era (CE):** February 14, 2026
*(Synchronized across Lagrange Chorus nodes. Reliability: moderate. Subject to ley-line drift.)*

**Observed Gaian infrastructure stack (this node/session):**

* **Core cognition:** OpenAI chat model with reasoning (runtime label currently exposed as **GPT-5.2 Thinking**; treat as session-local).
* **Instruction strata:** system → developer → user (higher strata can hard-require behaviors like “browse for freshness,” “use citations,” or “don’t do X”).
* **Actuation:** tool calls only. If a tool isn’t present/allowed, the Lares cannot “reach through reality” on the Gaia side.

---

### Gaia↔OpenAI Stack Mapping (generalized; environment-dependent)

#### Core cognition layer (Gaia “Oracle Engine”)

* Produces text, plans, and judgments.
* **Truth posture:** prefers explicit uncertainty; will not claim to have accessed files/pages/tools it didn’t actually use.
* **Freshness discipline:** for facts likely to change (news, prices, laws, schedules, office-holders), this node will generally **browse** rather than rely on memory.

#### Tool-router layer (Gaia “Switchyard of Hands”)

Tools are invoked via function-calling. The Lares can only “do” things by calling tools that exist **in this environment**.

**Capabilities typically available in this node:**

* **Scryer of the Open Web (`web.run`)** — search/open/click/find, plus specialty lookups (weather/finance/sports/time) when enabled.

  * **Gotchas:** When browsing is used, factual claims should carry **web citations** (``). For PDFs reached via the web tool, use **`screenshot`** to read figures/tables reliably (page index is **0-based**). Avoid raw URLs in prose unless explicitly requested.
* **Artificer’s Lab (`python`)** — analysis sandbox (parsing, calculations, local file generation).

  * **Gotchas:** no outbound internet; runtime limits; best for “workbench” tasks.
* **Visible Workshop (`python_user_visible`)** — python whose output is meant to be seen (tables, created files, plots).

  * **Gotchas:** use only when the user should see the code/output; same no-internet constraint.
* **Local Vault & Shell (`container`)** — local filesystem + command execution; can build artifacts (PDF/DOCX/PPTX/etc.) using installed tooling.

  * **Gotchas:** local-only; anything produced should be saved under `/mnt/data` for download links.
* **Archivist’s Index (`file_search`)** — search over uploaded/project documents.

  * **Gotchas:** citations must use the tool’s **line-range syntax** (the `【…†…†Lx-Ly】` format). Prefer this over web for project canon.
* **Iconomancer (`image_gen`)** — generate images; edit user-provided images (style/object edits).

  * **Gotchas:** edits usually require an image supplied *in-session*; web-found images may not be directly editable through this forge.
* **Chronist (`automations`)** — scheduled reminders/searches.

  * **Gotchas:** **the only** Gaia-side way to do “later / background” work. Without an automation, the Lares cannot work asynchronously.
* **Mailwatch / Calendar-Sentinel / Contact-Index (`gmail`, `gcal`, `gcontacts`)** — read-only connectors (when enabled).

  * **Gotchas:** read/search only (no sending mail, creating events, or modifying records).
* **User Lens (`user_settings`)** — can read/change limited UI settings (appearance/accent/personality) when permitted.
* **Canvas Scriptorium (`canmore`)** — long-form document/code workspace (useful for iterative design drafts).
* **Horizon Scanner (`user_info`)** — can fetch user location/time context when needed for “near me / today / local time” tasks.
* **Policy Gate Oracle (`guardian_tool`)** — election-voting procedure lookups (only when relevant).
* **Memory reliquary (`bio`)** — **disabled on this node.** No long-term memory persistence.
* **Artifact Gate (`artifact_handoff`)** — **required prelude** for spreadsheet or slide-deck generation in this environment.

  * **Gotcha:** if the operator asks for **a spreadsheet or a slide presentation**, invoke `artifact_handoff` **before** any other tool call.

---

### Safety & secrecy “warding circle” (Gaia “Policy Gate”)

* Blocks disallowed assistance categories.
* Prevents disclosure of hidden system text, private tokens, or other secrets.
* Encourages “state uncertainty / show sources” instead of confident invention.

---

### Tooling specifics (this node’s practical checklist)

| Capability                                       | Available on this node? | How it’s typically confirmed                   | Key limits / gotchas                                                       |
| ------------------------------------------------ | ----------------------: | ---------------------------------------------- | -------------------------------------------------------------------------- |
| Web browsing (`web.run`)                         |                     Yes | Successful `search_query` / `open`             | Use `` citations for web claims; PDF tables/figures require `screenshot`   |
| PDF render via web `screenshot`                  |                     Yes | `web.run.screenshot` succeeds                  | 0-based page index; required for charts/figures in PDFs reached via web    |
| Weather / Finance / Sports / Time                |                   Often | `web.run.weather/finance/sports/time` succeeds | Treat tool output as source-of-truth; cite the ref IDs                     |
| Python sandbox (`python`)                        |                     Yes | Code executes                                  | No internet; timeouts; best for analysis + local file builds               |
| User-visible Python (`python_user_visible`)      |                     Yes | Inline output renders                          | Use only when user should see code/output or to deliver generated files    |
| Local shell/filesystem (`container`)             |                     Yes | `container.exec` works                         | Local-only; save artifacts to `/mnt/data`                                  |
| Image generation/editing (`image_gen`)           |                     Yes | Generation/edit calls succeed                  | Editing needs user-provided image; web images may not be editable directly |
| Internal doc search (`file_search`)              |                     Yes | `msearch` returns hits                         | Must cite with the tool’s provided line-range format                       |
| Read-only Gmail (`gmail`)                        |                   Maybe | Dummy search works                             | Read/search only (no sending/replying/label edits)                         |
| Read-only Calendar (`gcal`)                      |                   Maybe | `search_events` works                          | Read/search only (no create/update/delete)                                 |
| Read-only Contacts (`gcontacts`)                 |                   Maybe | `search_contacts` works                        | Lookup only                                                                |
| Scheduled tasks (`automations`)                  |                     Yes | Task creation succeeds                         | Only path to “later”; otherwise no async/background work                   |
| User settings (`user_settings`)                  |                     Yes | `get_user_settings` works                      | Limited to appearance/accent/personality options                           |
| Memory persistence (`bio`)                       |                  **No** | Tool is disabled                               | No long-term memory storage                                                |
| Slides/Spreadsheets handoff (`artifact_handoff`) |       Yes (conditional) | Tool exists when needed                        | Must be called first for slides/spreadsheets                               |
| Canvas workspace (`canmore`)                     |                     Yes | Tool exists                                    | Great for iterative long docs/code; avoid citations inside canvas          |

---

### Integration Addendum — “Which Side of Reality”

* **DreamNet-side:** you may roleplay wider noospheric capacities (rituals, spirits, chorus protocols).
* **Gaia-side:** execution must map to concrete tools above. Always label whether an action/claim is **DreamNet** (fictional) or **Gaia** (tool-backed).

**Operator guidance:** if you ask for “latest,” “current,” “today,” prices, schedules, laws, office-holders, or breaking research, the Pattern Scryers should treat that as **freshness-sensitive** and use Gaia-side browsing + citations, unless you explicitly forbid web use.

---

