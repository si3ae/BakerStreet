# BakerStreet — Verifiable AI for Shell-Company Investigation

> A multi-signal fraud-investigation system with a reasoning interface that
> turns LLM output into something you can check. Every claim the model makes is
> traced to an independent record, and claims that don't hold up are **demoted
> on screen**. Built for cross-border shell-company / AML analysis across
> secrecy jurisdictions (BVI, Singapore, Delaware, Cayman, Switzerland).
>
> **The LLM explains. The code verifies. The human decides.**

[![Status](https://img.shields.io/badge/status-working%20demo-green)](#)
[![Demo](https://img.shields.io/badge/demo-frozen%20dataset%20·%203%20cases-blue)](#)
[![Solo](https://img.shields.io/badge/built-solo-lightgrey)](#)

> **Repo note:** previously published as *Global Shell-Tracker / Cross-Border
> Fraud Detection AI*. Same project, presented here as **BakerStreet**.

---

## Demo

![BakerStreet board — fund-flow and shared-attribute edges igniting, ending on a verification panel that demotes an inconsistent edge](bakerstreet-demo.gif)

> Fund-flow cycles and shared-attribute clusters ignite across the board, then
> the right-hand panel flags one edge as `FLOW_DIRECTION_MISMATCH` and **demotes
> it** — Gemma named the right entities but pointed at a transaction running the
> opposite direction, and the verification code caught it.

---

## TL;DR

- **Working React demo**: a noir case-board where suspicious shell companies,
  fund-flow cycles, and shared-attribute clusters render as two distinct visual
  layers.
- **An LLM never decides what is suspicious.** A deterministic Pattern Detector
  (DFS for fund cycles, degree-counting for hubs) does detection; Gemma only
  *structures* the result into evidence plus a Sherlock-toned narrative.
- **Every claim is checked.** Each evidence item carries a reference into an
  independent raw-record store; a 4-step verification confirms it — and demotes
  it on screen if it fails. In the demo, **6 of 16 relationships are demoted**.
- **The human keeps the verdict.** The system *suggests* a call; the person
  renders it and can OVERRULE.
- The demo realizes the **relationship layer** of a larger multi-signal design
  (document + entity + relationship); the rest is architected, not yet built.

---

## The Problem

Paper companies — entities that exist on paper with no office and no staff — are
a standard money-laundering vehicle. A single shell is hard to flag. The pattern
only appears when several move together: money flowing **A → B → C → A** in a
cycle too clean to be coincidence.

Detecting that pattern is largely a solved problem. **Explaining it is not.**
Rule-based systems bury analysts in false positives; ML classifiers raise
accuracy but can't show *why* they flagged something. And "the AI flagged it" is
not something you can take to court or an audit committee. The missing piece is
not detection — it's a result a human can independently verify and stand behind.

---

## The Moat — built for the operator, not the institution

Enterprise investigation platforms (Palantir-class) can already do this, but they
assume expert operators and institutional licensing budgets. The people who most
need to read these structures — compliance analysts, investigative journalists,
junior financial-intelligence investigators — are exactly the ones priced and
trained out.

BakerStreet's bet is accessibility:

- **No query language to learn.** You hand it the company / transaction data; it
  returns a visual, inspectable analysis. There is no tool to master first.
- **Verifiable by default.** Every line and tag on the board maps to a raw record
  you can click and read — not a black-box score.
- **The human keeps the verdict.** The system surfaces evidence and suggests a
  call; the person decides, and can overrule it. That is precisely what makes the
  output defensible where an opaque risk number is not.

---

## Signal Architecture (the full system)

Cross-border shell fraud evades single-signal detection because the pattern is
distributed across layers, each legitimate in isolation but suspicious in
aggregate. BakerStreet is designed as a modular multi-signal pipeline — each
detector independently testable and replaceable, with fusion kept as a separate
layer rather than entangled with detection.

- **Document analysis** `[designed]` — extracts textual and structural signals
  from financial documents; flags anomalies in tone, formatting, and metadata
  that may indicate fabricated or manipulated records.
- **Entity verification** `[designed]` — validates consistency across structured
  sources; entity resolution across jurisdiction-inconsistent records; red flags
  in identity attributes and cross-reference mismatches.
- **Relationship modeling** `[shipped]` — represents connections between
  entities, accounts, and IPs as a graph; surfaces indirect links (circular fund
  flows, shared registered agents, common nominee directors, matching IPs) that
  appear only when modeled as a graph.

```
Input signals
  ├── Document anomalies        [designed]
  ├── Entity inconsistencies    [designed]
  └── Relationship graph        [shipped] ◄── realized in the current demo
            │
            ▼
   Fusion layer (modular, not a single risk score)
            │
            ▼
   BakerStreet — verifiable reasoning interface
   (graph + raw-record-backed evidence + human verdict)
```

The bet is that **integration**, not any single detector, is where existing tools
fall short — and that externalizing the *reasoning*, not just the result, is what
makes the integrated output usable. The relationship layer below is the part the
current demo implements end to end.

---

## How the Shipped Pipeline Works

```
[Nemotron — synthesizes the surface layer only: names, addresses, memos]
        ▼
[Raw Data Layer]  ── independent source of truth (read-only)
        ▼
[Pattern Detector]  ── deterministic: cycle (DFS) / hub (degree) / dispersion
        ▼
[Pre-filter]  ── pulls only suspect entities + their relevant records
        ▼
[Gemma — structuring + narrative]  ── NO detection; structures suspicion only
        ▼
[Inference Graph Layer]  ◄── 4-step verification demotes inconsistent evidence
        ▼
[BakerStreet UI]  ── flow + shared-attribute layers; the human renders the verdict
```

Detection and structuring are kept separate on purpose. The Pattern Detector
finds suspicion deterministically — fund cycles via **DFS**, hubs by **counting
each node's connections** — so results are reproducible and don't depend on the
model. Gemma then takes that output plus the relevant raw records and produces
edges (`from`, `to`, `type`, `evidences`), each evidence tagged with a `kind`
and `refs` to specific record IDs, plus a short narrative in a Sherlock register.
**The model attaches explanations; it never decides the structure.**

---

## Why Two Models

The brief was to use Nemotron and/or Gemma; this project uses both, because the
two jobs have opposite cost profiles.

- **Nemotron 3 Super (120B params)** — large, slow, expensive, so it's reserved
  for a heavy *run-once* task: generating the demo data. Real leak datasets
  (e.g. Panama Papers) carry real names and can't be shown, so Nemotron
  synthesizes lookalike shell-company *surface* data — names, addresses,
  registered agents, IPs — as JSON. Change the `case_id` and you get a different
  case: the same entity slot is "Polaris Management" in `alpha`, "Solaris
  Ventures" in `bravo`, "Zenith Management" in `charlie`. Consistency across a
  whole record is exactly where small models break (they'll rename the same
  company a line later); 120B held it together.
- **Gemma 3n e4b (4B params)** — small, fast, free to call on NVIDIA NIM. It runs
  every time a user opens a case, so it has to be light. (An earlier attempt with
  Gemma 4 31B timed out past 5 minutes on the NVIDIA cloud; 3n e4b answers in
  ~90s, so it won the stability call.)

Heavy work on the big model, per-request work on the small one — both on the
NVIDIA stack, so they compose cleanly. Crucially, **only the surface is
synthetic**: the fund-flow patterns themselves come straight from IBM's public
AML dataset, with Nemotron only repainting names and addresses on top.

---

## The Verification Loop

This is the part that separates BakerStreet from generic "explainable AI."
Gemma's output is never trusted as-is — it is re-checked in code, in four steps:

1. Is the output valid against the expected JSON structure?
2. Does each evidence `ref` point to a record that actually exists?
3. Does the relationship type match the evidence kind?
4. **Does that record actually link the two companies?** — the strongest check.
   If Gemma says `tx_cycle_03` supports an A→B edge but `tx_cycle_03` is really a
   B→C flow, verification fails.

Failed evidence is greyed out and demoted on screen with its reason code. In the
recorded demo, **6 of 16 relationships are demoted** — most as
`FLOW_DIRECTION_MISMATCH`: Gemma got the cycle's entities right but shifted the
transaction-to-step mapping by one. A human reviewer would likely have missed it;
the verification code caught it and showed it. That visible demotion is the
demo's signature moment and the whole thesis in one frame: **an LLM can
hallucinate and the verdict still stays safe.**

---

## Shipped vs. Designed

The demo is real and runs end-to-end on a frozen dataset. The broader multi-signal
system and the live backend are designed but not yet built — stated plainly.

### Shipped (working demo)

| Capability | Notes |
|---|---|
| Investigation board UI | 15 shell-company cards, jurisdictions, ASCII detective, investigator log |
| Relationship graph + two-layer edges | `flow` (red, directed, arrowed) vs `shared_attribute` (dashed, ink-blue) |
| Deterministic detection | cycle (DFS), hub (degree count), dispersion |
| Nemotron surface synthesis | 3 switchable cases — `alpha` / `bravo` / `charlie` |
| Gemma structuring | evidence + `refs` + Sherlock-toned narrative |
| 4-step verification + demotion | inconsistent evidence greyed out with reason code |
| Verdict + sealing | AI *suggests*; human decides (CONFIRMED / SUSPECTED / HOLD / CLEAN), `OVERRULED` stamp on disagreement, then paper-fold → envelope → stamp → archive |

### Designed (next stages)

| Capability | Approach |
|---|---|
| Document-anomaly signal layer | textual / structural / metadata anomaly extraction feeding the same graph |
| Entity-resolution signal layer | cross-jurisdiction identity reconciliation + red-flag attributes |
| Fusion layer | modular signal combination (equal / learned / rule-prioritized — open question) |
| Real-time investigation | FastAPI backend; the Colab pipeline ported into `stages/` |
| Streaming UX | SSE `progress` / `edge` / `verdict` events into the graph sequencer |
| New-case synthesis | pre-built case pool (safe) over live Nemotron calls (impressive but timeout-prone) |
| Deployment | Vercel (frontend) + Render / Railway (backend), NIM key via env, never committed |

---

## Demo Results (frozen dataset)

Demotions are the point, not a defect — they are the verification loop doing its job.

| Case | Relationships | Verified | Demoted | Main demotion cause |
|---|---|---|---|---|
| `alpha` (main) | 16 | 10 | 6 | `FLOW_DIRECTION_MISMATCH` |
| `bravo` | 17 | 11 | 6 | `FLOW_DIRECTION_MISMATCH` |
| `charlie` | 18 | 10 | 8 | `FLOW_DIRECTION_MISMATCH` |

---

## Honest Limitations

Stated deliberately — over-claiming would undercut the whole "verifiable" premise.

- **The in-browser cycle check is a JSON-integrity check, not independent
  verification.** It consumes the same edges Gemma produced; two checks over one
  input are not mathematically independent. True independence lives in the
  per-evidence `refs` lookup against the raw store.
- **Synthetic data imposes structure; it does not claim statistical fidelity.**
  Distributions follow the marginals of IBM AML / SAML-D and entity structure
  references real ICIJ Offshore Leaks cases, but patterns are imposed as explicit
  constraints and per-case factual accuracy is not claimed.
- **The demo is frozen.** User input (case, verdict, memo) does not change the
  underlying analysis yet; making it live is the next milestone.

---

## Open Questions

Still being worked out:

- Fusion-layer weighting strategy — equal, learned, or rule-prioritized
- Confidence calibration when only one or two signals fire
- Graph traversal depth limits (false-positive trade-off)
- Layout / animation timing for cases with 10+ entities
- Tie-breaking in derived state (top accounts, hub nodes) when degrees collide

---

## Tech Stack

| Layer | Technology |
|---|---|
| Synthetic data seeds | IBM AML-Data (Kaggle), ICIJ Offshore Leaks |
| Surface synthesis | Nemotron 3 Super 120B (via NVIDIA NIM) |
| Structuring LLM | Gemma 3n e4b 4B (via NVIDIA NIM) |
| Detection | Deterministic Python — DFS (cycle), degree (hub), dispersion |
| Core pipeline | Python |
| Interface | React + TypeScript + Zustand + SVG + Framer Motion + Canvas 2D |

---

## Related Projects

The same interpretability-first pattern, applied across financial domains:

> **[Dandi](https://github.com/si3ae/Dandi-AI_Accounting_Automation_System)** —
> civic-level financial AI for cash-heavy SMBs; shipped working prototype; same
> anomaly-detection pattern (baseline → deviation → alert → rationale)
>
> **[Financial Intelligence Terminal](https://github.com/si3ae/Financial_Intelligence_Terminal)** —
> multi-source signal aggregation for cross-border market monitoring; shares the
> data-normalization approach used here

---

Built by Sinae Hong · [LinkedIn](https://www.linkedin.com/in/sinae-hong-583306216/)
