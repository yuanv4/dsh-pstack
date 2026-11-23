# pstack_spawn

Canonical DSH spawn for this port. Playbooks follow this file. Do not send Cursor `Task` fields or grok `task` fields.

## Call

```text
pstack_spawn
  description: <3-5 words>
  prompt: <complete brief>
  role: <pstack role key>
  run_in_background: true
  route_index: <optional mapped seat>
  model: <optional catalog model>
  provider: <optional provider for model>
  reasoning_effort: <optional supported effort>
```

Allowed fields: `description`, `prompt`, `role`, `run_in_background`, `route_index`, `model`, `provider`, `reasoning_effort`.

Forbidden on this call: `thinking`, `isolation`, `subagent_type`, `environment`, `readonly`, `resume_from`.

An explicit model wins over the mapped route, which wins over the parent route. A provider requires a model and disambiguates a model listed under multiple providers. An explicit effort overrides the selected route's effort. An explicit different model does not inherit the mapped route's effort. Validate the model and effort with `pstack_catalog`. If no effort metadata is available, omit effort. An effort override needs an explicit or mapped model.

Omit `route_index` to use the first mapped route or inherit when the role has no route. An explicit index must select an existing mapped seat, even with a model override. Missing overlay or an inherited role uses the parent route when no model is supplied.

## Fallback

If `pstack_spawn` is not registered, report the missing tool. Do not use native delegation when Poteto mode blocks it.

## Wait and cancel

- Continuable (shipped `spawn` + `subagent` `backgroundMode: continuable`): start returns a subagent id. A settlement notice arrives when the child ends. `send_message` gives it more work. `interrupt_agent` stops the current turn.
- One-shot background: collect with `job_output`, stop with `job_kill`.

Do not poll `list_agents` for completion.

## Isolation

DSH `subagent` has no isolation field. Children share the parent cwd (`packages/subagent/subagent-spawn-in-process/README.md`). When workers must not share a tree, the **parent** runs `git worktree add` (or a unique directory) and puts that path in each prompt.

## Roles

Nine upstream lines can hold a model mapping:

| Role | Used by |
|---|---|
| `feature, refactoring` | feature and refactoring code delegates |
| `bug-fix` | bug fix delegate |
| `perf-issue` | performance delegate |
| `hillclimb` | hillclimb delegate |
| `judgment and prose` | hardest and judgment-heavy work |
| `arena runners` | `/arena` candidates, `/architect` design candidates |
| `arena cross-judge pool` | `/arena` cross-judge |
| `swarm workers` | `/swarm` workers, and verification |
| `interrogate reviewers` | `/interrogate` reviewers |

Any other role name a skill uses, such as `how-explorer`, `how-explainer`, `why-investigators`, `why-synthesizer`, `reflect-judgment`, `poteto-agent`, or `comment-sicko`, has no line. Those children run on this conversation's route. The retired names (`hardest-tasks`, `architect-runners`, `how-critics`, …) are dropped when the overlay is read.

Panel roles (`arena runners`, `arena cross-judge pool`, `swarm workers`, `interrogate reviewers`): call `pstack_overlay_read`. If the role inherits, independent children may inherit the same route, but that does not establish vendor diversity. If the role has routes, select each mapped seat with its `route_index`. A cross-vendor judge requires an explicit known other-vendor model, or must be skipped with a reason. Do not infer the model vendor from the provider adapter id or invent slugs to fake a panel.

## Todo and questions

- `todo_write({ todos: [{ content, status }] })` replaces the whole list. Status is `pending`, `in_progress`, or `completed`. No `id`, `merge`, or `cancelled`.
- Product or preference questions: `ask_user_question`.
