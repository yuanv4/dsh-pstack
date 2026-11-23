---
name: arena
description: "Spawn N parallel candidates at the same task, pick a base, graft the strongest parts of the losers into it. Use for /arena, 'arena this', 'throw it in the arena', or when one attempt at a non-trivial artifact would lock in the wrong shape."
---

# Arena

Open a todolist with one entry per phase (Frame, Fan out, Cross-judge, Pick, Graft, Verify) before launching anything.

## Phase A: Frame

Every candidate gets the same prompt, so the prompt is the contract.

1. State the artifact each candidate is producing.
2. Derive the rubric, 3-6 concrete gradeable criteria for what success looks like on *this* task. It is the picker's tool in Phase D. Candidates only see the task.
3. Pick the runners from the `arena runners` line in `$DSH_HOME/pstack-dsh.json`. Use `route_index` for each mapped seat. A missing line inherits this conversation; spawn at least two independent candidates. If a mapped route is unavailable or launch is rejected, use the nearest authorized catalog route of the same family or drop the seat and say so. Keep at least two runners or report the gap. Families use prefixes after dropping a leading `cursor-`; the longest match wins: `claude-fable-*`, `claude-*`, and `gemini-*`. Other families use the text before the first hyphen. Spawn more for multiple design directions, and repeat one route for generation-bound work. Pick each subagent's reasoning effort for the job, per the Subagents section, using catalog-supported overrides when needed.
4. Give each candidate its own output location (a git worktree where possible, otherwise `/tmp/arena-<slug>/candidate-<n>/`), per the **separate-before-serializing-shared-state** principle skill.

## Phase B: Fan out

Spawn all N subagents in one message with `run_in_background: true`, each with the task, the path to the shared grounding, its own output path, and instructions to produce the artifact and a short rationale naming the alternatives it considered and what it rejected.

If a candidate produces no output, proceed with N-1 and note the dropout.

## Phase C: Cross-judge

After all Phase B candidates complete, spawn one read-only judge from the `arena cross-judge pool` line in `$DSH_HOME/pstack-dsh.json`. The judge is never from the parent's vendor when the vendor is known. Fable is a separate family but counts as Claude for vendor selection. A provider adapter id is not necessarily the model vendor; establish vendor from reliable model information, not the provider string. Use the first known other-vendor mapped route with its `route_index`. If the parent vendor is unknown, use the first known explicit mapped route and disclose that the vendor check did not run. An inherited route is not a cross-vendor check. If no explicit suitable route exists, skip the judge and say why. Catalog listing does not guarantee authorization. If launch rejects a route, try an authorized catalog-listed route of the same family and suitable vendor, then the next suitable entry, or skip the judge and disclose why. While you read in Phase D, the judge scores each candidate by path label on each rubric criterion and recommends a base.

## Phase D: Pick a base

Read every candidate end to end before picking. Score each against the rubric criterion by criterion, not on holistic feel, and compare with the cross-judge when Phase C ran one. Agreement on the base confirms the pick. Disagreement means one of you is biased or the rubric was ambiguous. Read both rationales before deciding.

Pick the base a future maintainer can extend most easily without breaking invariants. When two feel tied, prefer the cleaner boundary or smaller API, per the Laziness Protocol.

## Phase E: Graft

Walk each losing candidate once more for what is worth porting into the base, usually one or two things per candidate, not most of it. Fold each graft in by hand, per the **redesign-from-first-principles** principle skill, so the result stays coherent under one mental model. Don't paste mechanically.

If the candidates converge on one shape, that is strong agreement. Note it and ship the consensus shape. No graft is needed. If they wildly diverge, Phase A was under-specified. Reframe and re-run rather than averaging the divergence.

## Phase F: Verify

Verify the synthesized artifact like any other output, per the **prove-it-works** principle skill. If verification finds a problem the arena missed, either Phase A was wrong (re-frame and re-run) or a candidate caught it and you missed the graft (go back to Phase E). Don't paper over it.

## Outputs

One synthesized artifact, with a short synthesis note alongside naming the base and why, the cross-judge's verdict or that Phase C skipped the judge, each graft with its source candidate, what was rejected and why, any convergence or dropouts, and the verification result.
