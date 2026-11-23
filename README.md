# pstack for DeepSeek Harness

A DSH adaptation of [poteto's pstack](https://github.com/cursor/plugins/tree/main/pstack). The 23 playbooks, the 24 principles, the agents, and the guide are upstream's text, taken from `cursor/plugins` commit [`792440e8`](https://github.com/cursor/plugins/commit/792440e8a560a4a3f63748cdee70491ecd412982) and generated into this package. This repo's own code is the harness call layer plus the role editor.

## Install

Open **设置 → 插件 → 添加插件** and enter:

```text
github:yuanv4/pstack-dsh
```

Or from the CLI, which writes the `web` profile only:

```sh
dsh plugin --profile web add github:yuanv4/pstack-dsh
```

Then start a session and run `/poteto-mode`, or any bundled skill from the `/` menu.

## What works differently here

DSH's `subagent` tool takes no model and no effort. So a role's model lives in `$DSH_HOME/pstack-dsh.json` and `pstack_spawn` reads it at spawn time. Nine roles can hold a mapping, matching upstream's `setup-pstack` lines. Any other role name a skill uses runs on the conversation's own route.

Open **插件 → pstack-dsh → 配置** to edit the mapping. The page lists every model DSH currently offers, with that model's own reasoning efforts.

[`HARNESS.md`](./HARNESS.md) maps every Cursor name to its DSH replacement, lists what is skipped, and records the two deliberate divergences.

## Turn the switch on

Skill text alone cannot stop a model from calling the native `subagent` tool, which knows nothing about the role mapping. So this plugin ships a session switch:

```text
/pstack-poteto-mode on
/pstack-poteto-mode status
/pstack-poteto-mode off
```

While it is on for a session, the plugin denies `subagent` and `subagent_fork` for that agent and puts the poteto-mode instructions into that session's system prompt. The only way left to delegate is `pstack_spawn`, so every child gets its role's route or inherits this conversation. The switch persists per session in `$DSH_HOME/pstack-poteto.json` and is restored on the next start. It can be turned on only in the session that runs the workflow, not inside a delegate.

Without the switch, `/poteto-mode` still works as a skill, but nothing stops a delegation from skipping the route mapping.

## Repository layout

| Path | Owner |
|---|---|
| `upstream/pstack/` | Snapshot of `cursor/plugins` at the pinned commit. Never edited by hand. |
| `skills/`, `agents/`, `docs/guide/` | Generated from that snapshot. Never edited by hand. |
| `skills/setup-pstack/` | This repo owns it: it points at the DSH editor instead of writing a Cursor rules file. |
| `src/`, `lib/` | This repo's code: `pstack_spawn`, the overlay, the model catalog, the editor UI. |
| `HARNESS.md` | The harness map above. |

## Working on this repo

```sh
npm run sync:skills   # re-fetch the pinned upstream commit and regenerate the trees
npm test              # typecheck is separate: npm run typecheck
npm run build         # esbuild into lib/
```

`scripts/sync-skills.mjs` holds every DSH rewrite and fails on any Cursor name that survives it. `tests/skills-generated.spec.ts` fails when a generated file drifts, so hand edits do not survive a commit. To move to a newer upstream, change `UPSTREAM_SHA` in `scripts/fetch-upstream.mjs`, run the sync, and read the diff.

## License

MIT. Playbooks and principles are poteto's, from `cursor/plugins`. This adaptation is not endorsed by them.
