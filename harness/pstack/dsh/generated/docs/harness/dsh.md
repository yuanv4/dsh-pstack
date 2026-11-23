# pstack in DeepSeek Harness

This file is the DSH platform map. The generated installation includes it here and as `HARNESS.md` so skill links continue to resolve. Unlike the official runtime mapping, DSH uses deterministic source rewrites and locally authored setup files.

## Sources and regeneration

The `pstack/` snapshot holds selected files from `cursor/plugins` at commit [`792440e8`](https://github.com/cursor/plugins/commit/792440e8a560a4a3f63748cdee70491ecd412982). The generator writes `harness/pstack/dsh/generated/`. Do not edit generated files by hand.

- `npm run sync:skills` re-fetches that commit and regenerates all three trees.
- `scripts/generate-pstack-harness-trees.mjs` builds and prunes the output trees. `harness/pstack/dsh/adaptations/rewrites.mjs` holds the DSH rewrites and checks unsupported Cursor constructs and required anchors. Semantic changes still need review.
- `harness/pstack/dsh/tests/skills-generated.spec.ts` fails when a generated file differs from the generator output, so the tree cannot drift between releases.
- `docs/guide/` is copied verbatim except for two links to omitted automation files, which point to the pinned upstream commit. The installation includes the pinned Claude Code adapter for the setup guide. The guide documents Cursor first; read this file for DSH differences.
- `upstream.lock.json` records the repository, commit, mappings, upstream Git blob SHA-1 hashes, and normalized snapshot SHA-256 hashes. Markdown, text, and JSON use UTF-8 with CRLF converted to LF and trailing newlines reduced to one. Other files retain their bytes.
- `node scripts/fetch-upstream.mjs --verify` checks the snapshot inventory and hashes offline. Fetching validates the complete tree and downloaded bytes before replacing the selected trees.
- To update the pin, change the commit in the lock, update the pin references in this file, `README.md`, and the acceptance test, run `node scripts/fetch-upstream.mjs --update-lock`, run the sync, and review the diff. The lock update downloads and verifies the new upstream blobs. New upstream prose may need new rewrite rules.
- A filesystem error during replacement can leave a partial managed tree. Rerun the sync to restore managed-tree writes. Inspect unexpected snapshot inventory files outside the managed paths separately.

The three files in `harness/pstack/dsh/adaptations/skills/setup-pstack/` are local sources. The generator copies them to `skills/setup-pstack/` in place of the corresponding upstream files. They point at the DSH editor instead of writing a Cursor rules file.

## Skills

A skill's frontmatter decides how it is reached. The generator makes skills that upstream workflows invoke model-invocable, including their transitive workflow and principle dependencies. DSH loads these through the `skill` tool. Other entry points retain upstream's user-only flag. The explicit list is in `harness/pstack/dsh/adaptations/rewrites.mjs`.

## Tools

| Upstream (Cursor) | DSH |
| --- | --- |
| `Task` subagent | `pstack_spawn`, then read the settlement notice |
| Stop a child | `pstack_interrupt` |
| `AskQuestion` | `ask_user_question` |
| Open a todolist, or copy steps into the todolist tool | `todo_write` |
| `Grep`, `Glob` | `grep`, `glob` |
| Run another pstack skill | the `skill` tool, then follow the returned body |
| `/loop` | `create_goal` for a finite objective or a managed background watcher. Neither provides timed wakeups; schedules require an explicit human request |
| A built-in PR tool | `gh` through `pwsh` |

## Subagent fields

| Upstream (Cursor) | DSH |
| --- | --- |
| `subagent_type` | `role` |
| `model:`, and the per-call reasoning level | optional `model` and `reasoning_effort` on `pstack_spawn`. The role line is the default; a per-call value adjusts one job |
| `readonly: true` | say "do not edit files" in the brief, then check `git status` yourself |
| `readonly: false` | default |
| `environment: "cloud"` | create a worktree in the parent and put its path in the brief |
| `run_in_background: true` | `run_in_background: true` |
| `resume` | `send_message` to the settled child |
| `file_attachments` | list the paths in the brief |

`pstack_spawn` accepts `description`, `prompt`, `role`, and optional `name`, `run_in_background`, `route_index`, `model`, `provider`, and `reasoning_effort`. `provider` requires a `model`. Choose a listed route and supported effort. If the catalog has no effort metadata, omit the effort.

## Agent Teams

When the session enables Agent Teams, `pstack_spawn` starts a teammate. Create the shared task first, then start the child with `name` and include the task id in its prompt. After dispatch, reassign the task to the returned name. Re-read the task before every update. Only the task owner completes it; the lead reassigns the task to itself before finishing.

Use the team board for durable work with an owner, dependencies, write scopes, or handoff. Keep private or one-shot exploration as ordinary delegation. Use `pstack_interrupt` to stop one child by name or Session id.

## Models

Upstream writes one line per role into a rules file and passes the model on every call. In DSH the editor writes the mapping to `$DSH_HOME/pstack-dsh.json`, and `pstack_spawn` also accepts validated per-call overrides.

The mapped roles are the nine lines from upstream `setup-pstack`:

`feature, refactoring` · `bug-fix` · `perf-issue` · `hillclimb` · `judgment and prose` · `arena runners` · `arena cross-judge pool` · `swarm workers` · `interrogate reviewers`

A role the file does not name, such as `how-explainer`, `why-investigators`, `reflect-judgment`, or `poteto-agent`, runs on the parent conversation's route. That is the DSH equivalent of upstream sending no model.

Precedence follows upstream. An explicit `model` wins, then the role's line, then the parent conversation; an explicit `reasoning_effort` adjusts whichever model won. Model names resolve to a provider through the live catalog, so a call must name a model DSH lists, and an effort the resolved model supports. Mapped effort is retained only when the effective provider and model are unchanged. A role with no line and no explicit model inherits the conversation; an effort-only override in that case requires an explicit model. An explicit `route_index` requires an existing mapped seat; omit it to inherit or select the first mapped route. Catalog listing does not guarantee session authorization or a successful model call.

## Paths

| Upstream (Cursor) | DSH |
| --- | --- |
| `pstack/skills/` in the plugin | `harness/pstack/dsh/generated/skills/` in this package, served by the plugin |
| `.cursor/skills/`, `~/.cursor/skills/` | `<workspace>/skills/`, `~/.dsh/skills/` |
| `~/.cursor/rules/pstack-models.mdc` | `$DSH_HOME/pstack-dsh.json` |
| `~/.cursor/projects/<slug>/agent-transcripts/` | `$DSH_HOME/sessions/<workspace-slug>/<session>/session.v4.jsonl.zstd` |

## Enforcement

Upstream gets route compliance from the Cursor harness, where a `Task` call names a model directly. Here a role name is only a request, and the native `subagent` tool ignores it. So the port adds a session switch, borrowed from [l246804/dsh-pstack](https://github.com/l246804/dsh-pstack):

- `/pstack-poteto-mode on` denies the native `subagent` and `subagent_fork` tools for that agent with `agent.ctx.tools.restrict({ deny })`, so `pstack_spawn` is the only delegation path left.
- The same call puts `skills/poteto-mode/SKILL.md` into that session's system prompt as `pstack:poteto-workflow`. A section registered through `agent.ctx` is assembled for every step, so the text is present without a separate skill invocation.
- `agent/pre-step` appends one short reminder line per new user turn, so drift after a long run or a compaction does not silently drop the workflow.
- The selection persists per session in `$DSH_HOME/pstack-poteto.json` and is reapplied on `agent/created`, on `tools/change`, and once at plugin start.
- `off` lifts the restriction and removes the section. Delegates (sessions with `origin: subagent`) cannot turn it on.
- The Web client renders the switch as a row in `conversation.input.model.options`, beside DSH's Agent Teams row; that slot passes the session id to `inject`, and the row calls `GET`/`POST /plugins/pstack-dsh/poteto`.

## Skipped in DSH

DSH has no Cursor Automations, Bugbot, cloud agents, or `cursor-team-kit` skills. When a step needs one, write one line, `Skipped in DSH: <step>. <reason>.`, and continue to the next step. Do not stop, ask, or retry. When a later step needs what the skipped one produced, leave a placeholder and name it in the line.

## What this port drops

| Upstream field | Why |
| --- | --- |
| Cursor panel default slugs | DSH routes must come from the live catalog; `pstack_spawn` supports per-call model overrides |
| `Task.subagent_type` | DSH has no such field; `role` replaces it |
| `Task.isolation`, `environment: "cloud"` | The parent owns worktrees and passes paths |
| `~/.cursor/skills`, rules files | DSH reads skills and one overlay file |
| Cursor Automations, Bugbot, cloud agents | No DSH equivalent |
