# SambungKata — translation where your team already works

**Codegeist 2026 · Category: Apps for Business Teams · Bonus targeted: Best Agents (Rovo)**

*Sambung kata* is Indonesian for "connecting words" — and that is exactly the
problem SambungKata solves. Distributed teams write issues in whatever language
the author thinks in, and everyone else pays the translation tax: copy the
ticket, paste it into a translator, lose the project's vocabulary on the way.

SambungKata puts one-tap translation **inside** Jira and Confluence, and ships
the same capability as a **Rovo agent with reusable actions** that other agents
can call.

## What it does

1. **Jira issue panel** — open any issue, pick a language (English, Indonesian,
   Javanese, Spanish, French, German, Portuguese), tap *Translate issue*. The
   summary and description are translated in-panel, honouring the project's
   glossary.
2. **Per-project glossary** — each Jira project keeps its own glossary in Forge
   storage (KVS): the terms that must always be rendered the team's way
   ("sprint" stays "sprint", product names never get translated). Editable
   right from the panel.
3. **Rovo agent — "SambungKata Translator"** — ask in Rovo chat:
   *"Translate this issue into Indonesian"* or *"Translate 'Sprint planning
   moved to Friday' into Javanese"*. The agent is backed by two reusable
   actions — `translate-text` and `translate-issue` — declared as first-class
   Forge `action` modules, so other agents can invoke them too.
4. **Confluence byline item** — on any page, translate the title and a summary
   excerpt from the byline under the title.

## How it works

```
Jira issue panel (UI Kit) ──invoke──▶ Resolver ──▶ fetchIssue (@forge/api, ADF→text)
Confluence byline (UI Kit) ─invoke──▶    │    ──▶ fetchPage (@forge/api)
Rovo agent ──action──▶ translate-text / translate-issue handlers
                                            │
                                            ▼
                              translate() provider chain
                              1. Forge LLMs API (@forge/llm, Claude)
                                 — on-platform, no API key, no egress
                              2. External MT API (only if env vars set)
                              3. Built-in demo dictionary (EN/ID/JV)
                                            │
                              Glossary (Forge KVS, per project)
```

- **Primary engine: the Forge LLMs API.** The manifest enables the `llm`
  module (`model: claude`); resolvers and action handlers call
  `chat()` from `@forge/llm`. Issue content never leaves the Atlassian
  platform, so the app can qualify for *Runs on Atlassian*.
- **Glossary-aware.** Relevant glossary terms are injected into the LLM
  prompt (and applied as replacements in dictionary mode).
- **Zero-config fallback.** If the LLM is unavailable, an optional external
  provider (Google Cloud Translation shape) can be enabled via Forge
  environment variables; failing that, a small built-in EN↔ID/JV dictionary
  answers, and the UI honestly labels results with the engine that produced
  them.

## Repository layout

```
manifest.yml            modules, scopes, egress — the whole app contract
src/index.js            resolver definitions + Rovo action handlers
src/translate.js        provider chain (Forge LLM → external → dictionary)
src/dictionary.js       demo dictionary + language list + detector
src/glossary.js         per-project glossary on Forge KVS
src/jira.js             issue fetch + ADF-to-text
src/confluence.js       page fetch + excerpt extraction
src/frontend/index.jsx  UI Kit issue panel (translate + glossary editor)
src/frontend/byline.jsx UI Kit Confluence byline item
```

## Deploy it (once an Atlassian account exists)

```bash
npm install -g @forge/cli        # Node 22+
forge login                      # your Atlassian API token
npm install                      # app dependencies
forge register                   # writes the real app.id into manifest.yml
forge deploy                     # development environment
forge install                    # choose Jira and Confluence, enter your site
forge tunnel                     # iterate locally with live reload
```

Optional external provider (skip for the default Forge LLM path):

```bash
forge variables set SAMBUNGKATA_API_URL https://translation.googleapis.com/language/translate/v2
forge variables set --encrypt SAMBUNGKATA_API_KEY <key>
```

## How judges install it

1. Deploy to production: `forge deploy -e production`.
2. In the [developer console](https://developer.atlassian.com/console), open
   the app → **Distribution** → set status to **Sharing** and save. The
   console generates an **installation link**.
3. Judges open the link and install on their own site (site-admin required).
   - The **issue panel and Confluence byline** work on any Jira/Confluence
     Cloud site.
   - The **Rovo agent** additionally needs Rovo activated on the site
     (Standard/Premium plans and trials include Rovo): after installing,
     open Rovo Chat → Browse Agents → enable **SambungKata Translator**.

> Keep the manifest free of a `license:` section — licensed apps cannot be
> shared via installation link.

## Prize fit

- **Apps for Business Teams** (main category): translation friction is a
  daily business-team problem across every distributed org.
- **Best Agents (Rovo)** bonus: a purpose-built `rovo:agent` whose two
  actions are reusable Forge `action` modules, invocable by other agents —
  not a chatbot skin over a single function.
