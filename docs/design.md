# Project BakerStreet — Design Document (v6)

> ## Revision Summary
>
> **v5 → v6**
> - **Frontend Component Design section added**: component tree, store subscription matrix, data flow sequences, key component signatures, coordinate system decisions.
>
> **v4 → v5**
> - **Detection vs. structuring separation**: Gemma does not detect. Detection is handled by a deterministic Pattern Detector; Gemma structures already-detected suspicion into evidence, raw record references, and natural-language narrative.
> - **Pre-filter stage added**: instead of feeding the full raw dataset into Gemma, only suspect entities and their relevant records are extracted. This prevents token explosion.
> - **System architecture updated**: Pattern Detector is now an explicit component.
> - **Gemma prompt body and NIM call pseudocode added as appendices**.
>
> **v3 → v4**
> - **Target reset**: dropped the Korean FSS context; refocused on cross-border shell company and AML investigation.
> - **Data sources section added**: ICIJ Offshore Leaks, OpenCorporates, OpenSanctions, IBM AMLSim, SAML-D, SynthAML — public English-language datasets surveyed.
> - **Nemotron pipeline redesigned**: seed candidates made explicit, structural pattern injection retained.
>
> **v2 → v3**
> - **Verification loop introduced**: evidence is upgraded from a free-form string to a structure carrying raw record references. Gemma's claims become reproducible against an independent raw data source.
> - **Edge type split**: `flow` and `shared_attribute` separated. The ambiguity of "cycle" definition is resolved.
> - **Evidence as array**: `evidence: string` became `evidences: EvidenceItem[]`. Cumulative grounds for suspicion are now expressed directly in the model.

---

## Project Definition

> "BakerStreet looks like an investigation assistant, but it is, in fact, an interface that externalizes LLM reasoning into a verifiable structure."

**Domain:** Cross-border shell company detection and anti-money-laundering (AML) investigation. The analytical scope covers cross-border fund flows across major secrecy jurisdictions including the British Virgin Islands, Singapore, Cayman Islands, Delaware, and Switzerland.

**Target users:** AML/KYB compliance analysts, investigative journalists, and junior FIU investigators. Domain-knowledgeable practitioners who lack the licensing budget or training time required for tools like Palantir, Quantexa, or Neo4j-based investigation platforms.

**Positioning:** Existing specialized investigation tools carry substantial licensing costs and steep learning curves. BakerStreet recasts LLM reasoning as natural-language summaries plus visual connections, lowering the **interpretive entry barrier**.

---

## Core Philosophy

- Not competing on accuracy ❌
- Competing on verifiability ✅
- Not "explainable AI" but **"an interface that auto-generates explanations"**
- Every visual element (ripples, tags, lines) is a direct mapping of an LLM output token. None of it is decorative UI.
- **Verification loop:** every evidence item carries a raw record reference. Gemma's claims are independently verified against the raw data layer.

---

## Demo Scenario (single case)

> "Funds from a BVI-registered shell company A flow through Singapore-registered B and Delaware-registered C, before returning to A in a cycle. The three entities are also linked by a shared registered agent, accounting activity from a common IP, and a common nominee director. BakerStreet visualizes fund flow and shared attributes as two separate layers, and externalizes each piece of evidence as a clickable reference into the underlying raw transaction and registration data."

This scenario combines patterns from ICIJ Offshore Leaks and IBM AMLSim. It reproduces typical hallmarks of shell company arrangements: shared nominees, common registered addresses, and circular fund flows.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React (Vite) |
| Styling | Tailwind CSS |
| State management | Zustand |
| Animation | Framer Motion |
| Graph / line rendering | SVG |
| Image effects | Canvas 2D API |
| LLM reasoning | Gemma (via NVIDIA NIM) |
| Synthetic data | Nemotron-4 |

---

## System Architecture

```
[Nemotron — RawRecord narrative synthesizer]
         ↓
[Raw Data Layer]  ── verification source of truth (read-only)
         ↓
[Pattern Detector]  ── deterministic algorithm (cycle / hub / dispersion)
         │
         │  detected suspects + pattern hints
         ↓
[Pre-filter]  ── extracts records relevant to suspect entities
         ↓
[Gemma — structuring + narrative]  ── no detection, only structuring
         │
         │  edges + refs + summary
         ↓
[Inference Graph Layer]  ← core engine
         ↓ (verification: lookup against raw store)
[Visualization Engine]   ← renders only
```

### Core Principles

- **Separation of detection and structuring**: the Pattern Detector handles detection; Gemma handles structuring.
- The AI only **builds** the graph (during the structuring stage).
- The UI only **renders** the graph.
- No string parsing in between.
- **Every evidence must be reverse-traceable to a raw record id.**

### Why Detection Is Not Delegated to Gemma

If we let an LLM perform detection:
- Results vary between runs, breaking demo reproducibility.
- The "Graph is fact" separation principle collapses (the graph becomes a container for LLM output rather than a source of truth).
- Detection accuracy cannot be verified — using LLM output to validate LLM output is self-referential.

We instead delegate detection to deterministic algorithms, and concentrate Gemma's contribution where it has a real comparative advantage: **rendering already-detected suspicion in a form humans can read.**

---

## Data Model (TypeScript)

### Raw Data Layer

The verification source of truth. Synthetic transactions, accounts, IPs, and registrations generated by Nemotron live here. The raw data layer must remain **independent** of Gemma's output for the verification loop to be meaningful.

```ts
type RawRecord = {
  id: string                    // "tx_001", "acct_K1234", "ip_log_88", "reg_007"
  type: "transaction" | "account" | "ip" | "registration"
  payload: Record<string, any>  // raw fields (amount, timestamp, parties, etc.)
}
```

### Graph Layer

```ts
type Node = {
  id: string
  label: string
  type: "entity" | "account" | "ip"
}

type EvidenceItem = {
  kind: string       // "shared registered agent", "matching IP address" — UI tag label
  refs: string[]     // RawRecord.id array — entry point to verification
}

type Edge = {
  id: string
  from: string
  to: string
  type: "flow" | "shared_attribute"
  evidences: EvidenceItem[]
  weight?: number    // optional, reserved for future extension
}

type Graph = {
  nodes: Node[]
  edges: Edge[]
  rawStore: Map<string, RawRecord>
  pattern?: ("cycle" | "hub" | "dispersion")[]  // multiple patterns allowed
}
```

### Edge Type Semantics

| type | Directed? | Cycle-eligible | Visual representation | Example evidence kinds |
|---|---|---|---|---|
| `flow` | Yes | ✅ | Red solid line + arrow | wire transfer, fund routing |
| `shared_attribute` | No | ❌ | Dashed line (different color) | shared registered agent, common nominee director, matching IP |

**Cycles are defined only over flow edges.** Shared-attribute edges contribute to cluster identification, not cycle detection.

### Edge.id Generation Rule

Gemma's output does not include ids, so the frontend assigns them:
```
edgeId = `${type}:${from}->${to}:${index}`
```
This avoids collisions even when multiple evidences exist between the same pair, or when both flow and shared-attribute edges connect the same entities.

### EvidenceItem Deduplication Rule

Gemma may output the same evidence twice. The frontend deduplicates on `(kind, refs.sort().join(","))`.

---

## Verification Loop

### Mechanism

```
1. Gemma output: { kind: "shared registered agent", refs: ["reg_007"] }
2. Frontend: rawStore.get("reg_007")
3. Verify: does this record actually link from-entity and to-entity?
4. Outcome:
   - Pass → render normally
   - Fail → demote evidence (gray out or remove) + log a warning
```

### Verification Function

```ts
function verifyEvidence(
  edge: Edge,
  ev: EvidenceItem,
  rawStore: Map<string, RawRecord>
): boolean {
  return ev.refs.every(refId => {
    const record = rawStore.get(refId)
    if (!record) return false
    return isRecordConsistentWithEdge(record, edge)
  })
}
```

`isRecordConsistentWithEdge` branches by record type:
- `account`: edge.from and edge.to must both appear in the account's holder list
- `ip`: both entities must appear in the IP log's user list
- `transaction`: tx sender/receiver must match edge.from/to (used for flow edges)
- `registration`: both entities must appear in the registration record's client list (shared registered agent or common nominee)

### What This Buys Us in Presentation

| Before (v2) | After (v3+) |
|---|---|
| "Gemma said so" | "Gemma's claim is confirmed by the data" |
| Token visualization | Claim + verification |
| Weak hallucination defense | Strong defense — raw data is independent |

Clicking a tag slides a raw record panel in from the right. The verifiable-judgment narrative ("a tool that produces verifiable judgments") becomes operationally true at this moment, not just rhetorical.

---

## Cycle Detection — Restricted to Flow Edges

```ts
function detectFlowCycle(edges: Edge[]): string[] | null {
  const flowEdges = edges.filter(e => e.type === "flow")
  return findCycleInDirectedGraph(flowEdges)  // returns cycle node ids or null
}
```

Gemma's `pattern: "cycle"` claim is also compared against flow edges only. A triangular structure of shared-attribute edges is a cluster, not a cycle.

> ⚠️ **Honest limitation note**: the frontend cycle detection consumes edges that Gemma generated. This is **not independent verification — it is a JSON integrity check**. Two checks consuming the same input are mathematically not independent. True independent verification would extract cycles directly from the raw store and compare them. In the demo phase we use this only as a syntactic check, and avoid calling it "double verification" in the presentation.

---

## State Management (Zustand)

### Core Principle

> Graph is "fact"; UI is "interpretation" — they must remain separated.

```ts
// useRawStore — verification source of truth
{
  records: Map<string, RawRecord>
  getRecord: (id: string) => RawRecord | null
}

// useGraphStore — data layer
{
  nodes: Node[]
  edges: Edge[]
  pattern?: ("cycle" | "hub" | "dispersion")[]
  activateEdge: (edgeId: string, trigger: "user" | "stream") => void
}

// useUIStore — visual layer
{
  activeEdges: string[]
  ripples: RippleState[]
  tags: TagState[]
  rawPanelTarget: string | null   // raw record id of the clicked evidence
  streamingController: AbortController | null
}
```

---

## Core Function: activateEdge

The single entry point for all visual effects. Two trigger types call the same function, distinguished by the `trigger` argument.

```ts
activateEdge(edgeId: string, trigger: "user" | "stream")
  → 1. activate the edge (if already active, only replay ripple, no duplicate tags)
  → 2. highlight the from/to nodes
  → 3. spawn a ripple
  → 4. show one tag per evidence (length of evidences array)
  → 5. draw the SVG line — solid for flow, dashed for shared_attribute
```

- **"user"**: triggered by card click. Immediate response.
- **"stream"**: triggered after Gemma streaming completes; edges fire one by one.

### Idempotency

When called repeatedly with the same edgeId:
- Ripple replays (visual feedback)
- Tags and lines are not added again (skip if state.activeEdges already includes the id)

### User Click During Streaming

If a user clicks while the stream loop is running:
- User trigger takes precedence; the clicked edge activates immediately
- Stream loop continues, but skips edges already activated

### New Stream During Active Stream

If a previous stream is still running, `streamingController.abort()` is called before starting a new one.

---

## Gemma Output Contract (JSON)

**Role clarification:** Gemma does not detect. It receives the Pattern Detector's output (suspect entities + pattern hints) and produces **structured evidence + raw record references + natural-language narrative**.

**Streaming strategy:**
- The `summary` text is streamed in real time.
- `edges` and `pattern` are parsed in one pass after streaming completes.
- Reasoning: streaming partial JSON requires a partial JSON parser, which adds unnecessary complexity in the early stage.

```json
{
  "summary": "Cross-border fund cycle BVI → SG → DE → BVI detected on top of shared agent and nominee cluster",
  "pattern": ["cycle"],
  "edges": [
    {
      "from": "A", "to": "B", "type": "flow",
      "evidences": [
        { "kind": "wire transfer", "refs": ["tx_001"] }
      ]
    },
    {
      "from": "B", "to": "C", "type": "flow",
      "evidences": [
        { "kind": "wire transfer", "refs": ["tx_002"] }
      ]
    },
    {
      "from": "C", "to": "A", "type": "flow",
      "evidences": [
        { "kind": "wire transfer", "refs": ["tx_003"] }
      ]
    },
    {
      "from": "A", "to": "B", "type": "shared_attribute",
      "evidences": [
        { "kind": "shared registered agent", "refs": ["reg_007"] }
      ]
    },
    {
      "from": "A", "to": "C", "type": "shared_attribute",
      "evidences": [
        { "kind": "matching IP address", "refs": ["ip_log_88"] }
      ]
    },
    {
      "from": "B", "to": "C", "type": "shared_attribute",
      "evidences": [
        { "kind": "common nominee director", "refs": ["nominee_K12"] }
      ]
    }
  ]
}
```

### Prompt Constraints

Constraints we impose on Gemma:
- `evidences` is always an array (length 1 even for a single ground)
- `kind` must be one of a predefined enum:
  - flow: `"wire transfer"`, `"fund routing"`
  - shared_attribute: `"shared registered agent"`, `"common nominee director"`, `"matching IP address"`, `"shared beneficial owner"`, `"same registration address"`
- `refs` always contains at least one RawRecord id
- `type` must be consistent with `kind` (the frontend post-processes this)

### Type Post-Processing Mapping

To remain robust against incorrect `type` values from Gemma, the frontend maintains a kind → type mapping:

```ts
const KIND_TO_TYPE: Record<string, Edge["type"]> = {
  "wire transfer": "flow",
  "fund routing": "flow",
  "shared registered agent": "shared_attribute",
  "common nominee director": "shared_attribute",
  "matching IP address": "shared_attribute",
  "shared beneficial owner": "shared_attribute",
  "same registration address": "shared_attribute",
}
```

**Things to avoid in the early phase:** confidence scores, reasoning chains, node metadata. Each adds output instability and debugging difficulty.

---

## Pattern Detector — Deterministic Detection

Patterns are detected directly on the raw data before any Gemma call. The detector is deterministic, so its output is reproducible and itself verifiable.

### Detection Targets

| Pattern | Algorithm | Output |
|---|---|---|
| `cycle` | DFS-based cycle finding on the directed transaction graph | List of entity ids forming the cycle |
| `hub` | Per-entity degree count; hub if exceeds a threshold | Hub entity id + connected entity list |
| `dispersion` | Jurisdiction diversity per entity; dispersion if exceeds a threshold | Dispersing entity id + jurisdiction list |

### Detection Result Structure

```ts
type DetectedPattern = {
  type: "cycle" | "hub" | "dispersion"
  suspect_entity_ids: string[]   // entities directly involved in the pattern
  related_record_ids: string[]   // raw record ids that ground this pattern
}

type DetectionResult = {
  patterns: DetectedPattern[]
  all_suspect_entities: string[]  // union across patterns
}
```

### Cycle Detection Pseudocode

```python
def detect_cycles(transactions: list[Tx]) -> list[DetectedPattern]:
    # build a directed graph from transactions
    graph = defaultdict(list)
    for tx in transactions:
        graph[tx.sender_entity].append((tx.receiver_entity, tx.id))
    
    # DFS
    cycles = find_simple_cycles(graph, max_length=5)
    
    return [
        DetectedPattern(
            type="cycle",
            suspect_entity_ids=cycle_nodes,
            related_record_ids=cycle_tx_ids,
        )
        for cycle_nodes, cycle_tx_ids in cycles
    ]
```

### Demo Simplification

For the demo, we save the patterns injected during Step 4 of the Nemotron pipeline as metadata, and have the Pattern Detector read them back. The real algorithm still runs in parallel as a sanity check — a "sandwich" structure:

```python
# Demo-mode simplification
def detect_patterns_demo(raw_store, injected_patterns_metadata):
    # 1. detect with the algorithm
    detected = detect_cycles_from_raw(raw_store)
    
    # 2. sanity-check against the injected patterns
    assert_overlap(detected, injected_patterns_metadata)
    
    return detected
```

---

## Pre-filter — Compressing Gemma's Input

Only the suspect entities and their related records are passed to Gemma. This prevents token explosion and keeps Gemma's role narrowly defined.

### Stage Pseudocode

```python
def prepare_gemma_input(
    raw_store: dict,
    entities: list[Entity],
    detection_result: DetectionResult,
) -> dict:
    suspect_ids = set(detection_result.all_suspect_entities)
    
    # 1. extract records directly tied to suspects
    relevant_records = []
    for record_id, record in raw_store.items():
        if is_about_suspects(record, suspect_ids):
            relevant_records.append(record)
    
    # 2. sanitize records — strip fields irrelevant to Gemma's reasoning (token saving)
    sanitized = [sanitize_for_gemma(r) for r in relevant_records]
    
    return {
        "entities": [e.to_dict() for e in entities if e.id in suspect_ids],
        "records": sanitized,
        "record_id_whitelist": [r["id"] for r in sanitized],
        "pattern_hints": [p.type for p in detection_result.patterns],
    }
```

### Compression Effect

| Stage | Data scale | Gemma token estimate |
|---|---|---|
| Full raw dataset | ~50 entities + ~1000 transactions + dozens of ip/reg records | 80K~120K tokens (risk of exceeding context limit) |
| After pre-filter | ~5 suspect entities + ~30 records | 3K~6K tokens (safe) |

### Data Flow

```
[Raw Store]
    ↓ (Pattern Detector)
[DetectionResult: suspect entities + pattern hints]
    ↓ (Pre-filter)
[Gemma input: compressed entities/records + whitelist + hints]
    ↓ (NIM API)
[Gemma output: summary + edges + pattern]
    ↓ (Frontend verification)
[Inference Graph: verified edges + active raw refs]
```

---

## Error and Edge Case Handling

Cases that, if they fire during the demo, are catastrophic. Each must have a handler in place beforehand.

| Situation | Response |
|---|---|
| Gemma returns empty edges | Auto-fallback to mock data (fixed A→B→C→A scenario) |
| Edge references a node not in the graph | Skip that edge; render the rest |
| ≤1 valid edge after filtering | Full fallback to mock data |
| evidence.refs id not in rawStore | Demote that evidence (gray); keep the edge |
| All evidences fail verification on an edge | Demote the edge entirely (lower suspicion grade) |
| NIM API timeout | Trigger fallback after 3s; UI shows "reasoning..." until then |
| JSON parse failure | Show summary only; skip edge rendering; fallback |
| Gemma `type` and `kind` mismatch | Force-correct via KIND_TO_TYPE mapping |
| Duplicate (from, to, type, kind) | Deduplicate; keep the first |

```ts
const validEdges = edges.filter(e =>
  nodeMap.has(e.from) && nodeMap.has(e.to)
)

if (validEdges.length <= 1) {
  triggerFallback("insufficient_valid_edges")
}
```

---

## Data Sources (English-language Public Datasets)

Nemotron's input seeds come from the **international shell company / cross-border AML** domain rather than any country-specific source. Datasets fall into three categories.

### A. Real Shell Company / Offshore Structure Data

This group provides **real entities, jurisdictions, and relationship graphs from actual investigations**. Transaction data is absent, but the structural realism of shell company arrangements is preserved.

| Source | Scale | Format | Notes |
|---|---|---|---|
| **ICIJ Offshore Leaks Database** | 810,000+ offshore entities across 200+ countries | CSV / Neo4j dump | Combined Panama, Paradise, Pandora, Bahamas, and Offshore Leaks. Open Database License. Roughly 80 years of records. |
| **OpenSanctions ICIJ OffshoreLeaks** | Same data, restructured | JSON / CSV (FtM) | Updated daily. Structured entity model. Free for non-commercial use. |
| **OpenCorporates API** | Official corporate registries from 145+ jurisdictions | JSON API | Free for public-interest projects. Company name, registration number, address, officers. Clear provenance. |
| **OpenSanctions main dataset** | Sanctions, PEP, watchlist (combined) | JSON / CSV | For sanction-evasion and cross-jurisdiction entity matching. |

**License caution:** ICIJ uses the Open Database License plus CC-BY-SA. OpenCorporates is free for public-interest projects only; commercial redistribution requires a separate license. For demos and academic presentations, attribution is sufficient.

### B. Synthetic Transaction Data (with Labeled AML Patterns)

This group provides **transaction flows with labeled suspicious patterns**. These are the direct seeds for imposing cycle/hub/dispersion patterns on flow edges.

| Source | Scale | Format | Notes |
|---|---|---|---|
| **IBM AMLSim** | Configurable (typically tens to hundreds of thousands of nodes) | CSV (multi-agent simulator) | Java-based simulator. Allows direct injection of fan-in/fan-out, cycle, gather-scatter, and other AML patterns. Open source. |
| **IBM AML-Data** | Pre-generated CSV | CSV | Pre-baked output of AMLSim. Usable immediately without running the simulator. |
| **SAML-D (Oztas et al. 2023)** | 855,460 customers, 0.92% suspicious | CSV | 28 typologies, 12 features. Multi-country, multi-currency, high-risk-country labels. Public on GitHub. |
| **SynthAML (Nature Sci Data 2023)** | 16M+ transactions, 20K AML alerts | CSV | Synthesized from real Spar Nord (Denmark) data. Real-world transferability documented. |

**Selection guide:**
- Quickest start with clear pattern labels: **IBM AML-Data** (pre-generated)
- Need direct control over cycle structure: **IBM AMLSim** (run the simulator)
- Multi-country / multi-currency cross-border scenarios: **SAML-D**
- Realistic transaction distributions: **SynthAML**

### C. Additional Verification / Enrichment Data

| Source | Use |
|---|---|
| **FinCEN Files (ICIJ)** | $2T trove of suspicious activity reports. Reference for real shell company sanction-evasion patterns. |
| **UK Companies House** | UK corporate registry. Free bulk download of official registration data. Rich nominee director patterns. |
| **OpenSanctions Pairs (Oxford 2024)** | 755,540 labeled entity pairs across 31 countries. Validation set for entity matching / deduplication. |

### Recommended Combinations for the Demo

**Minimum (for Phase 4 start):**
- **IBM AML-Data** (transaction patterns + labels)
- **ICIJ Offshore Leaks CSV** (entity names, jurisdictions, registered agents)

These are joined on entity id mapping. Anonymous account holders in AML-Data are substituted with ICIJ entities, producing cross-border cycles like "BVI shell A → SG B → DE C → A".

**Extended (if time permits):**
- Add **SAML-D** for multi-currency / high-risk-country pattern enrichment.
- Add **OpenCorporates API** for citing real nominee director / registered agent cases.

---

## Nemotron Synthetic Data Strategy

**Role:** not a *data generator* but a *pattern combiner*.

### Generation Order Matters

RawRecords are created first, and patterns are imposed on top of them. The reverse order (pattern first, then records to fit) breaks the verification loop.

### Generation Pipeline

```
1. Seed collection:
   - Transaction distribution: marginal distribution from IBM AML-Data or SAML-D
   - Entity structure: shell company names, jurisdictions, registered agents from ICIJ Offshore Leaks
   - Nominee / agent patterns: ICIJ + OpenCorporates references

2. RawRecord synthesis:
   - transaction: amount/timestamp/sender/receiver sampled from AML-Data distribution
   - account: holder mapped to ICIJ entity
   - ip log: list of accessing entities (cross-border IP patterns artificially imposed)
   - registration: registered agent / nominee info per jurisdiction

3. Structural constraint imposition (Nemotron's role):
   - cycle: BVI → SG → DE → BVI flow edges forced
   - dispersion: a single entity holds accounts across multiple jurisdictions
   - hub: a single nominee director registered for multiple entities

4. Cross-references for the verification loop:
   - Each RawRecord receives a unique id (tx_001, acct_K1234, ip_log_88, reg_007)
   - Gemma's prompt constrains evidence.refs to point at these RawRecord ids
```

### Concrete Use Points for Nemotron

Nemotron, deployed via NIM, is used for two narrow tasks:

1. **Natural-language narrative generation**: synthesizing entity names, registration justifications, and business descriptions in plausible English. Drawing on ICIJ entity naming patterns to generate shell-company-style names like "Sterling Crescent Holdings Ltd" or "Northern Star Trading Pte Ltd".
2. **Transaction memos / wire references**: turning AML-Data category labels into natural-language memos. Things like "consulting fee", "trade settlement" — typical laundering memo styles.

Transaction distributions and structural patterns are better handled by statistical tools like AMLSim/SAML-D, so we do not delegate these to Nemotron. **Nemotron's comparative advantage is natural-language synthesis.**

### Honest Phrasing (for Defense)

> ⚠️ Instead of the vague phrase "statistical similarity", we state:
> - **Transaction distributions follow the marginal distribution of IBM AML-Data / SAML-D**.
> - **Target patterns (cycle/hub/dispersion) are imposed as structural constraints**, not emergent from statistics.
> - **Entity structure references real shell company cases from ICIJ Offshore Leaks** for jurisdiction-distribution realism.
> - **Per-case factual accuracy is not claimed**; the goal is pattern demonstration for the demo.

### Three Patterns to Build

1. **Cycle**: multinational shell company fund recirculation (BVI → SG → DE → BVI)
2. **Dispersion**: a single entity's accounts spread across multiple jurisdictions
3. **Hub**: shared nominee director / registered agent across many entities

---

## UX Flow

### 1. Board

Clue cards are pinned to a board, scattered. ASCII Holmes idles in a corner.

### 2. The Three-Second Scene (the showpiece)

```
Card click (user trigger)
  → Ripple pulse fires
  → Tag popups on related cards
     ([shared registered agent], [matching IP], [common nominee director] — shared_attribute layer)
  → 0.5s later: dashed lines connect (shared_attribute)
  → 0.3s later: red arrowed cycle is drawn (flow layer)
  → "Cross-border fund cycle on shared agent cluster" appears as a one-liner
```

This scene visualizes **two layers stacking up to compound suspicion**. Far more persuasive than any single-evidence presentation.

### 3. Streaming

Gemma's summary text streams in real time. After streaming completes, edges are parsed and `streamActivateEdges` fires them through the stream trigger, expanding the graph progressively.

To call out explicitly during the presentation: "Gemma's analytical output is converted into visual ripples and lines."

### 4. Verification Panel (new)

When a tag is clicked:
- The raw record panel slides in from the right
- The evidence's `refs` are unfolded
- Example: clicking "shared registered agent" shows `reg_007`'s client list, where both A and B appear → confirming they share the same agent
- Compresses "this is what real verification looks like" into a single screen

### 5. Verdict

```
[FRAUD] ASCII stamp
+ Number of related entities
+ Top 2 accounts (by edge degree)
+ Hub node (1)
+ Set of evidence kinds discovered
+ Whether a flow cycle was detected
```

> Change: "suspicious total amount" was removed because it is not a derived value in the Graph model.
> "Strongest evidence" was changed to "set of evidence kinds discovered" because tie-breaking on frequency is ambiguous.

```ts
const getVerdictData = (state) => ({
  entityCount: state.nodes.filter(n => n.type === "entity").length,
  topAccounts: getTopNodesByDegree(state, "account", 2, hubNode),  // exclude hub
  hubNode: getTopNodesByDegree(state, null, 1)[0],
  evidenceKinds: [...new Set(state.edges.flatMap(e => e.evidences.map(ev => ev.kind)))],
  hasFlowCycle: detectFlowCycle(state.edges) !== null,
})
```

#### Tie-breaking Rules

When degree values tie:
1. Higher degree first
2. Earlier appearance in the edges array
3. Alphabetical node id

#### Hub / topAccount Deduplication

If hubNode has type `account`, it is excluded from topAccounts and the next candidate fills in.

---

## Visual Identity

| Element | Specification |
|---|---|
| Background | #FDF5E6 (Old Lace), aged paper texture |
| Accent (flow) | #B22222 (red) |
| Secondary (shared_attribute) | #4A6FA5 (ink blue) or grayscale |
| Body font | Special Elite or Courier Prime (typewriter) |
| Memo font | Caveat (handwriting) |
| Line Screen effect | Canvas 2D API, repeating horizontal lines over card images |

### Edge Visual Distinction

| type | Line | Color | Arrow |
|---|---|---|---|
| flow | Solid, 2px | #B22222 | Yes |
| shared_attribute | Dashed, 1.5px | #4A6FA5 (or gray) | No |

### Canvas + SVG Coexistence

- Canvas (card image effects) and SVG (line connections) coexist on the same screen.
- **Single coordinate system recommended**: SVG `viewBox` is the authoritative coordinate system; Canvas elements are placed via `foreignObject` or absolute-positioned divs as small per-card canvases.
- A full-screen Canvas plus a full-screen SVG is a synchronization headache during resize/zoom.
- Phase 3 should leave generous time buffer for visual tuning.

---

## Frontend Component Design

This section defines the React component tree, store subscription relationships, data flow, and key signatures. It is the direct reference during Phase 1~3 implementation.

### Component Tree

```
<App>
├── <BoardScene>
│   ├── <HolmesIdle />               ← bottom-left, independent
│   ├── <SummaryStream />            ← top, displays Gemma summary
│   ├── <BoardCanvas>                ← SVG single coordinate system
│   │   ├── <EdgeLayer />            ← renders all edges
│   │   ├── <RipplePulseLayer />     ← all ripple animations
│   │   └── <CardContainer>          ← entities.map
│   │       └── <Card>               ← per-entity card (inside foreignObject)
│   │           ├── <CardImage />    ← Canvas Line Screen effect
│   │           └── <TagPopup />     ← evidence tags
│   └── <RawPanel />                 ← right slide-in panel (conditional)
│
└── <VerdictScene />                 ← overlay (conditional)
    └── <FraudStamp />
```

Tree depth stays within 4 levels. Deeper hierarchies make props flow harder to track.

### Canvas + SVG + Framer Motion Coexistence Strategy

The SVG `viewBox` is the unified coordinate system; cards are embedded as HTML inside `<foreignObject>`. Framer Motion can animate SVG children (`<motion.circle>`, etc.), so the RipplePulseLayer is pure SVG without a separate Canvas.

- A small Canvas 2D context per card handles the Line Screen effect.
- No full-screen Canvas (avoids the coordinate-sync headache).

### Store Subscription Matrix

**Principle:** each component subscribes only to the minimum slice it needs. Zustand selectors keep re-renders precise.

| Component | useRawStore | useGraphStore | useUIStore | Notes |
|---|---|---|---|---|
| App | ❌ | ❌ | `verdictMode` | Routing only |
| BoardScene | ❌ | ❌ | `streamingState` | Loading indicator |
| HolmesIdle | ❌ | ❌ | ❌ | Fully independent |
| SummaryStream | ❌ | ❌ | `summaryText` | Just the text |
| BoardCanvas | ❌ | `nodes` (for layout) | ❌ | Coordinate container |
| EdgeLayer | ❌ | `edges`, `nodes` | `activeEdges` | Branches by type |
| RipplePulseLayer | ❌ | ❌ | `ripples` | List of active ripples |
| CardContainer | ❌ | `nodes` | ❌ | Card placement |
| Card | ❌ | `edges` (own-related selector) | ❌ | onClick → activateEdge |
| TagPopup | ❌ | ❌ | `tags[entityId]` | Only its entity's tags |
| RawPanel | `records[rawPanelTarget]` | `edges` (with target ref) | `rawPanelTarget` | Verification view |
| VerdictScene | ❌ | `getVerdictData()` | ❌ | Derived state |
| FraudStamp | ❌ | `pattern` | ❌ | Cycle detection flag |

**Core principles:**
- Only RawPanel reads rawStore directly. Others access raw data indirectly through the graph layer.
- Three components touch edges: EdgeLayer, Card, RawPanel — each with its own selector.
- The UI store carries only visual state (ripples, tags, panel target). Graph facts live in the graph store.

### Data Flow — The Three-Second Scene (user trigger)

```
[User clicks a Card]
        │
        ▼
Card.onClick(entityId)
        │
        ├─ Look up edges connected to this entity (selector)
        │
        ▼
edges.forEach(edge => activateEdge(edge.id, "user"))
        │
        ▼
useGraphStore.activateEdge() internals:
        │
        ├─ ① call verifyEvidence() (rawStore lookup)
        │   └─ on failure, demote that evidence
        │
        ├─ ② useUIStore.addActiveEdge(edgeId)
        ├─ ③ useUIStore.addRipple({entityId, timestamp})
        ├─ ④ useUIStore.addTag({entityId, kind, status})
        │   └─ for both entities
        │
        ▼
Zustand notifies subscribed components
        │
        ├─ EdgeLayer: detects activeEdges change → draws new edge
        ├─ RipplePulseLayer: detects ripples change → Framer Motion fires
        └─ TagPopup (both entities): tags change → popup appears
```

The stream trigger calls the same function. The only difference is the caller — `streamActivateEdges` instead of Card.

#### activateEdge's Scope

This function does not mutate the graph itself — only visual state. The edges array is set into the graph store in one shot right after Gemma's response is parsed.

```ts
// On Gemma response arrival
useGraphStore.setState({ edges: parsedEdges, pattern: parsedPattern })
// At this point visual state is empty (activeEdges = [], ripples = [])

// Then the stream loop runs
for (const edge of parsedEdges) {
  activateEdge(edge.id, "stream")
  await delay(600)
}
```

### Data Flow — Verification Loop (tag click)

```
[User clicks a tag in TagPopup]
        │
        ▼
TagPopup.onClick(evidenceItem)
        │
        ▼
useUIStore.setState({ rawPanelTarget: evidenceItem.refs[0] })
        │
        ▼
RawPanel re-renders
        │
        ├─ Look up record in useRawStore
        ├─ Render branch by record type
        │   - transaction → sender / receiver / amount / memo
        │   - registration → agent / nominee / clients
        │   - ip → ip address / users
        │   - account → holder / jurisdiction
        │
        └─ Reverse lookup: which edges use this ref as evidence
            → "this record is used as evidence for 'shared registered agent' on A↔B"
```

This reverse lookup is the **operational demo of verifiability**. A single raw record's fingerprint across multiple claims is visible at a glance.

### Data Flow — Full Lifecycle

```
[App mount]
        │
        ▼
fetch synthetic_dataset.json
        │
        ├─ rawStore.records ← Map(record_id → RawRecord)
        └─ graphStore.nodes ← entity list (edges still empty)
        │
        ▼
[User action or auto-start]
        │
        ▼
Pattern Detector runs (over the raw store)
        │
        ├─ Returns DetectionResult
        ├─ Pre-filter prepares Gemma input
        └─ uiStore.streamingState = "preparing"
        │
        ▼
NIM API call (stream)
        │
        ├─ uiStore.streamingState = "streaming"
        │
        ├─ on_event("summary_delta", chunk):
        │     uiStore.summaryText += chunk
        │     SummaryStream re-renders (typing effect)
        │
        ├─ on_event("structured", {pattern, edges}):
        │     graphStore.setState({ edges, pattern })
        │     uiStore.streamingState = "activating"
        │     streamActivateEdges(edges) starts
        │
        └─ When streamActivateEdges completes:
              uiStore.streamingState = "complete"
              after a delay, verdictMode = true
        │
        ▼
VerdictScene overlay appears
```

#### UI Branching by streamingState

- `idle` — initial; only cards visible
- `preparing` — loading indicator
- `streaming` — summary area active
- `activating` — edges drawing one by one
- `complete` — all visible; Verdict can appear

### Key Component Signatures

```tsx
// BoardCanvas — SVG container
function BoardCanvas({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 1200 800" className="w-full h-full">
      {children}
    </svg>
  )
}

// Card — entity card (HTML inside foreignObject)
function Card({ entityId }: { entityId: string }) {
  const node = useGraphStore(s => s.nodes.find(n => n.id === entityId))
  const connectedEdges = useGraphStore(
    s => s.edges.filter(e => e.from === entityId || e.to === entityId)
  )
  const activateEdge = useGraphStore(s => s.activateEdge)
  
  const handleClick = () => {
    connectedEdges.forEach(edge => activateEdge(edge.id, "user"))
  }
  
  if (!node) return null
  return (
    <foreignObject x={node.x} y={node.y} width={180} height={240}>
      <div onClick={handleClick}>
        <CardImage src={node.imageUrl} />
        <CardLabel name={node.label} jurisdiction={node.jurisdiction} />
        <TagPopup entityId={entityId} />
      </div>
    </foreignObject>
  )
}

// EdgeLayer — renders all edges
function EdgeLayer() {
  const edges = useGraphStore(s => s.edges)
  const nodes = useGraphStore(s => s.nodes)
  const activeEdges = useUIStore(s => s.activeEdges)
  
  return (
    <g>
      {edges.map(edge => {
        const isActive = activeEdges.includes(edge.id)
        const fromNode = nodes.find(n => n.id === edge.from)
        const toNode = nodes.find(n => n.id === edge.to)
        if (!fromNode || !toNode) return null
        
        return (
          <EdgeRenderer 
            key={edge.id}
            edge={edge}
            from={fromNode}
            to={toNode}
            active={isActive}
          />
        )
      })}
    </g>
  )
}

// EdgeRenderer — branches by edge type
function EdgeRenderer({ edge, from, to, active }: EdgeRendererProps) {
  if (edge.type === "flow") {
    return <FlowArrow from={from} to={to} active={active} />
  }
  return <SharedAttributeDash from={from} to={to} active={active} />
}

// RawPanel — verification panel
function RawPanel() {
  const target = useUIStore(s => s.rawPanelTarget)
  const record = useRawStore(s => target ? s.records.get(target) : null)
  const referencingEdges = useGraphStore(s =>
    target 
      ? s.edges.filter(e => 
          e.evidences.some(ev => ev.refs.includes(target))
        )
      : []
  )
  
  if (!target || !record) return null
  return (
    <aside className="raw-panel">
      <RecordView record={record} />
      <ReferencingEdgesList edges={referencingEdges} />
    </aside>
  )
}
```

### Coordinate Decisions

- **SVG viewBox**: `0 0 1200 800` (roughly 3:2). CSS scales to viewport.
- **Card size**: `180 × 240` (in viewBox units)
- **Card placement**: 5~7 cards scattered. Random seed fixed for reproducibility.
- **Edge coordinates**: line connects card centers (`x + 90, y + 120`). Arrow padding so the arrowhead lands at the card boundary.
- **Ripple center**: card center.
- **TagPopup position**: right or top of the card; per-entity fixed to avoid overlap.

### Open Items

1. **Card image source** — given the shell company domain shift, company-logo style placeholders + jurisdiction flags fit better than human portraits. Final visual decision before the presentation.
2. **Card layout algorithm** — random scattering is simplest but causes many edge crossings. A one-time `d3-force` layout, then fixing positions, is cleaner. Decide at the end of Phase 1.
3. **VerdictScene trigger** — auto-appear right after `streamActivateEdges` completes vs. user-click. For a presentation demo, auto is safer (timing under control).
4. **Mobile / resize** — the demo is full-screen desktop, so this is deprioritized. Auto-scaling falls out of `viewBox` for free.

---

## Presentation Script (1 minute)

1. **Intro** — "Investigations are visual by nature. The problem is that today's data isn't."
2. **Problem** — Cross-border shell company tools carry heavy licensing costs and steep entry barriers. Compliance analysts and journalists struggle to get hands-on access.
3. **Tech** — IBM AML-Data and ICIJ Offshore Leaks seed the pipeline; Nemotron synthesizes natural-language narrative. A deterministic Pattern Detector finds cycle/hub/dispersion patterns; Gemma takes over to structure detected suspicion as evidence with raw record references. **The separation of detection and structuring is the key.**
4. **Demo** — "Detected suspicious relationships emerge as two distinct layers — fund flow and shared attributes. Every piece of evidence is reverse-traceable to the underlying transaction or registration data."
5. **Outro** — "Not just analysis — a tool that produces verifiable judgments."

---

## Defense One-Liners

**On LLM hallucination:**
> "Detection in BakerStreet is not done by an LLM. A deterministic Pattern Detector identifies cycle/hub/dispersion; Gemma only structures the result, attaching evidence and raw record references. Every claim Gemma makes carries a record id. The frontend independently looks up that record and verifies the claim's consistency. Evidence that fails verification is visually demoted."

**On Nemotron data legitimacy:**
> "Nemotron does not generate statistical distributions. It synthesizes the natural-language layer — entity names and transaction memos. Transaction distributions follow IBM AML-Data and SAML-D's marginal distributions; entity structure references real shell company cases from ICIJ Offshore Leaks. Patterns like cycle/hub/dispersion are imposed as explicit constraints. Per-case factual accuracy is not claimed; pattern demonstration is the goal."

**On cycle detection double-verification:**
> "The frontend cycle check consumes Gemma's output as input — so this is a JSON integrity check, not independent verification. True independent verification is per-evidence: `verifyEvidence` looks up each ref in the raw store independently."

---

## Phrasing Cautions

- "Reduces interpretation cost to zero" ❌ → "Lowers interpretation entry barrier" ✅
- "Ripples find the accomplices" ❌ → "Relationships found by Gemma surface as ripples and lines" ✅
- "Double-verified cycle" ❌ → "Gemma claim + raw-verified cycle" ✅
- "Statistically similar synthetic data" ❌ → "Synthetic data with imposed structural patterns" ✅

---

## Implementation Roadmap

### Phase 1 — Skeleton (3~4 days)
- Vite + React + Tailwind + Zustand setup
- Card component (image, name, jurisdiction)
- Random card placement on the board (position absolute + random coords)
- Background, fonts, colors

### Phase 2 — Data Layer + Inference Graph Layer (5~6 days) ← core
- RawRecord, EvidenceItem, Edge (with type), Graph type definitions
- useRawStore / useGraphStore / useUIStore separation
- `activateEdge(edgeId, trigger)` (with idempotency, abort)
- `verifyEvidence` verification function
- `detectFlowCycle`
- KIND_TO_TYPE mapping + dedup
- Mock data fallback paths
- **Done criterion:** feeding a mock JSON + mock rawStore produces verified ripples → tags (colored by verification status) → flow/shared distinguishing lines, all auto-played.

### Phase 3 — The Three-Second Scene (4~5 days)
- Framer Motion ripple animation
- SVG solid (flow) + dashed (shared_attribute) edge rendering
- Tag popup (per evidence kind)
- Raw record panel component (slides in on tag click)
- Canvas Line Screen effect
- Canvas/SVG coordinate sync (foreignObject approach)

### Phase 4 — AI Integration (4~5 days)
- Data acquisition:
  - Download IBM AML-Data CSV (or run AMLSim directly)
  - Download ICIJ Offshore Leaks CSV (extract entity, jurisdiction, registered agent)
  - Join on entity id mapping
- Nemotron pipeline:
  - On the joined data, synthesize natural-language narrative (entity names, transaction memos)
  - Generate 3 pattern datasets (cycle, dispersion, hub)
- Gemma NIM API + summary streaming + post-stream JSON parse
- Prompt constraints (kind enum, refs required, type consistency)
- Stream trigger fires `activateEdge` sequentially (600ms interval, abortable)
- Wire up error/timeout fallback

### Phase 5 — Verdict + Polish (2~3 days)
- [FRAUD] ASCII stamp animation
- Verdict derived state (entityCount, topAccounts, hubNode, evidenceKinds, hasFlowCycle)
- Tie-breaking and hub/account dedup logic
- ASCII Holmes idle animation
- Bug pass

### Phase 6 — Presentation Prep (1~2 days)
- One slide on prompt structure
- Fixed demo data: A→B→C→A + shared_attribute trio
- Verification panel demo flow
- Defense answers rehearsed verbally

**Total approximately 3~4 weeks**

---

## Implementation Starting Order

1. RawRecord, EvidenceItem, Edge (with type) type definitions
2. useRawStore / useGraphStore / useUIStore code structure
3. `activateEdge(edgeId, trigger)` + `verifyEvidence` + `detectFlowCycle` central flow
4. React component tree design (Board, Card, EdgeLayer, RawPanel, Verdict)
5. Mock data (rawStore + graph) drives A→B→C→A flow + shared_attribute trio with fallbacks
6. Gemma JSON prompt design (summary streaming / edges parse-on-complete; kind enum; refs required)

---

## Appendix — Stream Trigger Timing

```ts
async function streamActivateEdges(edges: Edge[], signal: AbortSignal) {
  const EDGE_DELAY_MS = 600
  // sort flow → shared_attribute, so the cycle appears first
  const sorted = [...edges].sort((a, b) =>
    a.type === "flow" ? -1 : b.type === "flow" ? 1 : 0
  )

  for (const edge of sorted) {
    if (signal.aborted) return
    activateEdge(edge.id, "stream")
    await delay(EDGE_DELAY_MS)
  }
}
```

- Edge delay: **600ms** baseline.
- Flow edges first, shared_attribute after — so fund flow surfaces before the supporting attribute cluster is overlaid.
- During presentation rehearsal, tune ±200ms based on perceived pacing.

---

## Appendix A — Gemma System Prompt

The body used for the demo. Sent as the `system` message of the NIM API.

````
You are an AML investigation assistant. Your role is NOT to detect suspicion — that has already been done by deterministic algorithms upstream. Your role is to STRUCTURE the suspicion: connect entities through evidence and produce a brief natural-language summary.

# Input

You receive:
1. A list of suspect entities (id, jurisdiction, synthesized name)
2. A subset of raw records relevant to these entities, each with a unique id
3. A list of pre-detected pattern hints (cycle / hub / dispersion)

# Available Record IDs (whitelist)

You MUST only reference record ids from this list in your output's `refs` fields:
{record_id_whitelist}

DO NOT invent new record ids. DO NOT modify ids. If you cannot find a supporting record for an evidence claim, OMIT that evidence rather than fabricating.

# Output Schema

Output ONLY valid JSON. No markdown fences, no preamble, no trailing comments.

Keys MUST appear in this exact order:
1. "summary" — string, max 25 words. A single sentence describing the overall finding.
2. "pattern" — array of strings from this enum: ["cycle", "hub", "dispersion"]. Multiple values allowed.
3. "edges" — array of edge objects.

Each edge object:
{
  "from": "<entity_id>",
  "to": "<entity_id>",
  "type": "flow" | "shared_attribute",
  "evidences": [
    { "kind": "<one of the allowed kinds>", "refs": ["<record_id>", ...] }
  ]
}

# Allowed Evidence Kinds

For type "flow":
- "wire transfer"
- "fund routing"

For type "shared_attribute":
- "shared registered agent"
- "common nominee director"
- "matching IP address"
- "shared beneficial owner"
- "same registration address"

The `kind` MUST be consistent with `type`. Do not mix.

# Constraints

- Every evidence MUST have at least one ref to a record in the whitelist.
- An edge MAY have multiple evidences if multiple distinct records support different angles of the same connection.
- Same (from, to, type) pair: collapse into one edge with multiple evidences. Do NOT duplicate edges.
- Different `type` between same entities → separate edges (one flow, one shared_attribute).
- `summary` must be in English, factual, no speculation language ("might", "could").

# Few-Shot Example

Input:
Entities: [
  {"id": "A", "jurisdiction": "BVI", "name": "Sterling Crescent Holdings Ltd"},
  {"id": "B", "jurisdiction": "SGP", "name": "Northern Star Trading Pte Ltd"},
  {"id": "C", "jurisdiction": "USA-DE", "name": "Pinewood Capital LLC"}
]
Records:
- tx_001: transaction, sender=acct_A1, receiver=acct_B1, amount=520000 USD
- tx_002: transaction, sender=acct_B1, receiver=acct_C1, amount=515000 USD
- tx_003: transaction, sender=acct_C1, receiver=acct_A1, amount=510000 USD
- reg_007: registration, agent=Alcogal, clients=[A, B]
- ip_log_88: ip, address=203.0.113.42, users=[A, C]
- nominee_K12: registration, nominee="John Smith Doe", clients=[B, C]
Pattern hints: ["cycle"]

Output:
{"summary":"Cross-border fund cycle BVI to SG to DE to BVI on shared agent and nominee cluster.","pattern":["cycle"],"edges":[{"from":"A","to":"B","type":"flow","evidences":[{"kind":"wire transfer","refs":["tx_001"]}]},{"from":"B","to":"C","type":"flow","evidences":[{"kind":"wire transfer","refs":["tx_002"]}]},{"from":"C","to":"A","type":"flow","evidences":[{"kind":"wire transfer","refs":["tx_003"]}]},{"from":"A","to":"B","type":"shared_attribute","evidences":[{"kind":"shared registered agent","refs":["reg_007"]}]},{"from":"A","to":"C","type":"shared_attribute","evidences":[{"kind":"matching IP address","refs":["ip_log_88"]}]},{"from":"B","to":"C","type":"shared_attribute","evidences":[{"kind":"common nominee director","refs":["nominee_K12"]}]}]}

# Now process the actual input.
````

The user message contains the actual data:

```
Entities: {entities_json}

Records:
{records_formatted}

Pattern hints: {pattern_hints_json}
```

### Note on Arrow Glyphs in Few-Shot

Unicode arrows like `→` may break across multiple tokens depending on the tokenizer, or be dropped from output. **In the example output, "to" is used instead of `→`** for safety. The frontend converts to `→` at render time.

---

## Appendix B — NIM Call Pseudocode

```python
import json
import requests

NIM_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions"
GEMMA_MODEL = "google/gemma-2-27b-it"  # confirm exact id in NIM catalog
NIM_API_KEY = os.environ["NIM_API_KEY"]


def call_gemma_streaming(input_data: dict, on_event):
    """
    on_event(event_type, payload) callback:
      - "summary_delta" : str  — text chunk for UI streaming
      - "summary_done"  : str  — fully assembled summary
      - "structured"    : dict — {pattern, edges} parse result
      - "error"         : str  — failure reason
    """
    record_whitelist = "\n".join([f"- {rid}" for rid in input_data["record_id_whitelist"]])
    system_prompt = SYSTEM_PROMPT_TEMPLATE.replace(
        "{record_id_whitelist}", record_whitelist
    )

    user_prompt = (
        f"Entities: {json.dumps(input_data['entities'])}\n\n"
        f"Records:\n{format_records(input_data['records'])}\n\n"
        f"Pattern hints: {json.dumps(input_data['pattern_hints'])}"
    )

    body = {
        "model": GEMMA_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
        "max_tokens": 1500,
        "stream": True,
        # If NIM supports OpenAI-compatible structured output:
        # "response_format": {"type": "json_object"}
    }

    try:
        response = requests.post(
            NIM_ENDPOINT,
            headers={
                "Authorization": f"Bearer {NIM_API_KEY}",
                "Accept": "text/event-stream",
            },
            json=body,
            stream=True,
            timeout=30,
        )
    except requests.Timeout:
        on_event("error", "timeout")
        return
    except requests.RequestException as e:
        on_event("error", f"request_failed: {e}")
        return

    if response.status_code != 200:
        on_event("error", f"http_{response.status_code}")
        return

    buffer = ""
    summary_emitted_chars = 0
    edges_started = False

    for line in response.iter_lines(decode_unicode=True):
        if not line or not line.startswith("data:"):
            continue
        data = line[5:].strip()
        if data == "[DONE]":
            break

        try:
            chunk = json.loads(data)
            delta = chunk["choices"][0]["delta"].get("content", "")
        except (json.JSONDecodeError, KeyError, IndexError):
            continue

        buffer += delta

        # Stream the summary region
        if not edges_started:
            if '"edges"' in buffer:
                edges_started = True
                # Flush any unsent summary tail
                final_summary = extract_summary_field(buffer)
                if final_summary:
                    remaining = final_summary[summary_emitted_chars:]
                    if remaining:
                        on_event("summary_delta", remaining)
                    on_event("summary_done", final_summary)
            else:
                partial_summary = extract_summary_field(buffer)
                if partial_summary and len(partial_summary) > summary_emitted_chars:
                    new_chars = partial_summary[summary_emitted_chars:]
                    on_event("summary_delta", new_chars)
                    summary_emitted_chars = len(partial_summary)

    # Streaming complete — parse the full JSON
    parsed = parse_json_safely(buffer)
    if parsed is None:
        on_event("error", "json_parse_failed")
        return

    on_event("structured", {
        "pattern": parsed.get("pattern", []),
        "edges": parsed.get("edges", []),
    })


def extract_summary_field(buffer: str) -> str | None:
    """
    Pull the summary value out of a partial JSON buffer.
    Regex-based, no full parser.
    """
    import re
    m = re.search(r'"summary"\s*:\s*"((?:[^"\\]|\\.)*)', buffer)
    if not m:
        return None
    raw = m.group(1)
    try:
        return json.loads(f'"{raw}"')  # handle escapes
    except json.JSONDecodeError:
        return raw  # incomplete escapes — best effort


def parse_json_safely(text: str) -> dict | None:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Try truncating to the last brace
        last_brace = text.rfind("}")
        if last_brace == -1:
            return None
        try:
            return json.loads(text[:last_brace + 1])
        except json.JSONDecodeError:
            return None


def format_records(records: list[dict]) -> str:
    """Compact one-record-per-line format for Gemma input."""
    lines = []
    for r in records:
        rid = r["id"]
        rtype = r["type"]
        payload = r["payload"]
        lines.append(f"- {rid}: {rtype}, {compact_payload(payload)}")
    return "\n".join(lines)


def compact_payload(payload: dict) -> str:
    return ", ".join(f"{k}={v}" for k, v in payload.items())
```

### Compromise: Pseudo-streaming

If the regex-based partial parsing in `extract_summary_field` proves fragile, a safer compromise is available:

```python
# Not real streaming — but visually indistinguishable
def call_gemma_pseudo_streaming(input_data, on_event):
    # Receive the full response in one shot
    response = requests.post(NIM_ENDPOINT, ..., json={**body, "stream": False})
    parsed = response.json()["choices"][0]["message"]["content"]
    parsed = json.loads(parsed)

    summary = parsed["summary"]
    
    # Animate as typing on the frontend (~30ms per char)
    for ch in summary:
        on_event("summary_delta", ch)
        time.sleep(0.03)
    on_event("summary_done", summary)
    on_event("structured", {"pattern": parsed["pattern"], "edges": parsed["edges"]})
```

**Visually identical, implementation risk zero.** Recommended for the demo.

---

## Appendix C — Three-Layer Hallucination Defense

| Layer | Location | Mechanism |
|---|---|---|
| 1. Prompt enforcement | System prompt | "refs only from whitelist; omit if not found" |
| 2. Whitelist injection | System prompt body | Available record ids enumerated explicitly |
| 3. Verification function | Frontend `verifyEvidence` | Demote evidence whose ref is not in rawStore |

The three layers stack, so even if one or two are bypassed, the verification function remains as a safety net.

---

## Appendix D — Pattern Detector vs. Gemma Responsibility Matrix

| Task | Owner | Note |
|---|---|---|
| Cycle detection | Pattern Detector (DFS) | Deterministic, reproducible |
| Hub detection | Pattern Detector (degree count) | Deterministic |
| Dispersion detection | Pattern Detector (jurisdiction diversity) | Deterministic |
| Evidence kind labeling | Gemma | record-type → kind mapping is a natural-language reasoning task |
| Connecting evidence to raw record refs | Gemma | Whitelist-bounded |
| Natural-language summary | Gemma | Gemma's comparative advantage |
| Edge type (flow / shared_attribute) | Frontend post-processing | KIND_TO_TYPE mapping (corrects Gemma output) |
| Verification (`verifyEvidence`) | Frontend | Independent rawStore lookup |

This matrix is the operational definition of the **detection-vs-structuring separation** principle.
