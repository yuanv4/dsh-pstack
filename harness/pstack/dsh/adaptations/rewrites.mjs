const REWRITES = [
  // Paths.
  [/~\/\.cursor\/rules\/pstack-models\.mdc/g, '$DSH_HOME/pstack-dsh.json'],
  [/~\/\.cursor\/skills\//g, '~/.dsh/skills/'],
  [/\.cursor\/skills\//g, '<workspace>/skills/'],
  [/~\/\.cursor\/projects\/[^\s`),]*/g, '$DSH_HOME/sessions/<workspace-slug>/'],
  [/`\.cursor\/worktrees\/[^`]*`/g, '`a sibling path`'],
  [/`?~\/\.cursor\/plugins\/`?/g, '`~/.dsh/skills/`'],
  // Subagent fields.
  [/subagent_type: "general-purpose"/g, 'role: poteto-agent'],
  [/subagent_type: generalPurpose/g, 'role: poteto-agent'],
  [/subagent_type: "([a-z0-9-]+)"/g, 'role: $1'],
  [/subagent_type: ([a-z0-9-]+)/g, 'role: $1'],
  // Agent frontmatter fields DSH does not read; persona routing comes from the overlay.
  [/^model: .*\n/m, ''],
  [/^is_background: true\n/m, ''],
  // Tools.
  [/`Task`/g, '`pstack_spawn`'],
  [/\bTask spawns?\b/g, '`pstack_spawn`'],
  [/\bTask subagents?\b/g, '`pstack_spawn` child'],
  [/\bTask calls?\b/g, '`pstack_spawn` call'],
  [/\bTask tool\b/g, '`pstack_spawn`'],
  [/\bTask\b/g, '`pstack_spawn`'],
  [/\bAskQuestion\b/g, '`ask_user_question`'],
  [/\bTodoWrite\b/g, '`todo_write`'],
  [/\bGrep\b/g, '`grep`'],
  [/\bGlob\b/g, '`glob`'],
  [/\bBash\b/g, '`pwsh`'],
  [/\bthe `Skill` tool\b/g, 'the `skill` tool'],
  [/\bcreate-skill\b/g, 'the skill-authoring flow'],
  [/`plugins\/cache\/`/g, 'an installed plugin package'],
]

/** Short prose fixes that a word swap cannot express. */
const LITERALS = [
  ['using your configured feature model (default `claude-opus-5-5-xhigh-fast`)', 'using the `feature, refactoring` role from `$DSH_HOME/pstack-dsh.json`'],
  ['using your configured refactoring model (default `claude-opus-5-5-xhigh-fast`)', 'using the `feature, refactoring` role from `$DSH_HOME/pstack-dsh.json`'],
  ['using your configured bug-fix model (default `claude-opus-5-5-xhigh-fast`)', 'using the `bug-fix` role from `$DSH_HOME/pstack-dsh.json`'],
  ['using your configured perf-issue model (default `claude-opus-5-5-xhigh-fast`)', 'using the `perf-issue` role from `$DSH_HOME/pstack-dsh.json`'],
  ['using your configured hillclimb model (default `claude-opus-5-5-xhigh-fast`)', 'using the `hillclimb` role from `$DSH_HOME/pstack-dsh.json`'],
  ["Pick each subagent's reasoning level for the job, per the Subagents section.", "Pick each subagent's reasoning effort for the job, per the Subagents section. Use a supported per-call effort when needed."],
  ['one readonly judge', 'one read-only judge'],
  [' and `readonly: true`', ' with a brief that forbids edits'],
  ['agent mode (readonly strips MCP), ', 'a brief that forbids edits when the job must not write, '],
  ['`agent-transcripts/`', '`$DSH_HOME/sessions/<workspace-slug>/`'],
  ['`/deslop` from `cursor-team-kit` over the diff before commit.', '**unslop** over the diff before commit.'],
  ['the slop-strip (the `deslop` skill from the `cursor-team-kit` plugin (`/deslop`))', 'the slop-strip (**unslop**)'],
  ['- `/deslop`, `control-cli`, and `control-ui` ship in the `cursor-team-kit` plugin.', '- Slop-stripping and UI/CLI control come from a Cursor plugin DSH does not ship; use **unslop**, and drive the surface yourself.'],
  ['`control-ui` or `control-cli` from `cursor-team-kit`', 'drive the real surface yourself'],
  ['set their own `subagent_type`', 'set their own `role`'],
  ['`generalPurpose`', '`poteto-agent`'],
  [', `environment: "cloud"`', ''],
  ['Use `environment: "local"` only when the worker needs its own tree.', 'The parent creates a worktree when workers must not share a tree.'],
  [' An agent that only dispatches, polls, or packs results runs on `claude-opus-5-5-medium-fast`.', ' An agent that only dispatches, polls, or packs results keeps the parent route.'],
  ["Don't glob across `~/.cursor/projects/*/`.", "Don't glob across other workspaces' session folders."],
  [
    'pstack is built for Cursor, and it also installs in Claude Code with `/plugin marketplace add cursor/plugins`, then `/plugin install pstack@cursor-plugins`. There, each command takes a `pstack:` prefix, such as `/pstack:poteto-mode`. The [Claude Code adapter](../../docs/harness/claude-code.md) maps the Cursor names, and a step that needs a Cursor-only feature, such as Bugbot or Automations, is skipped with a one-line note.',
    'pstack runs here as a DSH plugin: the skills load through the `skill` tool or the `/` menu. [HARNESS.md](../../HARNESS.md) maps the Cursor names, and a step that needs a Cursor-only feature, such as Bugbot or Automations, is skipped with a one-line note.',
  ],
]

/** Whole-line rewrites, where the sentence itself is harness-specific. */
const LINE_RULES = [
  [
    /^3\. Pick the runners from the `arena runners` line.*$/m,
    "3. Pick the runners from the `arena runners` line in `$DSH_HOME/pstack-dsh.json`. Use `route_index` for each mapped seat. A missing line inherits this conversation; spawn at least two independent candidates. If a mapped route is unavailable or launch is rejected, use the nearest authorized catalog route of the same family or drop the seat and say so. Keep at least two runners or report the gap. Families use prefixes after dropping a leading `cursor-`; the longest match wins: `claude-fable-*`, `claude-*`, and `gemini-*`. Other families use the text before the first hyphen. Spawn more for multiple design directions, and repeat one route for generation-bound work. Pick each subagent's reasoning effort for the job, per the Subagents section, using catalog-supported overrides when needed.",
  ],
  [
    /^After all Phase B candidates complete, spawn one read-only judge.*$/m,
    "After all Phase B candidates complete, spawn one read-only judge from the `arena cross-judge pool` line in `$DSH_HOME/pstack-dsh.json`. The judge is never from the parent's vendor when the vendor is known. Fable is a separate family but counts as Claude for vendor selection. A provider adapter id is not necessarily the model vendor; establish vendor from reliable model information, not the provider string. Use the first known other-vendor mapped route with its `route_index`. If the parent vendor is unknown, use the first known explicit mapped route and disclose that the vendor check did not run. An inherited route is not a cross-vendor check. If no explicit suitable route exists, skip the judge and say why. Catalog listing does not guarantee authorization. If launch rejects a route, try an authorized catalog-listed route of the same family and suitable vendor, then the next suitable entry, or skip the judge and disclose why. While you read in Phase D, the judge scores each candidate by path label on each rubric criterion and recommends a base.",
  ],
  [
    /^3\. Pick the worker model from the `swarm workers` line.*$/m,
    "3. Pick the worker route from the `swarm workers` line in `$DSH_HOME/pstack-dsh.json`. A role with no routes inherits this conversation. Use `route_index` for mapped seats. If a route is unavailable or launch is rejected, choose the closest authorized catalog-listed route of the same family or report the gap. For a model race, name each arm's route up front. Pick each subagent's reasoning effort for the job, per the Subagents section, using catalog-supported overrides when needed.",
  ],
  [
    /^Spawn all N workers in one message with `role: poteto-agent`.*$/m,
    'Spawn all N workers in one message with `role: swarm workers` and `run_in_background: true`. Use the selected route from step 3. The parent prepares separate worktrees when isolation is needed and passes each path in the brief.',
  ],
  [
    /^When a worker must start from a non-default pushed branch, pass `cloud_base_branch`\.$/m,
    'When a worker must start from a non-default branch, the parent prepares a worktree at that branch and passes its path in the brief.',
  ],
  [
    /^\*\*Defaults for every `pstack_spawn` call\.\*\*[\s\S]*?Say so\.$/m,
    "**Defaults for every `pstack_spawn` call.** `run_in_background: true`, a brief that forbids edits when the job must not write, file pointers rather than inlined context, and one role name per delegate. `/setup-pstack` writes `$DSH_HOME/pstack-dsh.json`, whose nine role lines hold each role's starting route and effort. Each code playbook reads its own line (`feature, refactoring`, `bug-fix`, `perf-issue`, or `hillclimb`), prose and judgment read `judgment and prose`, and trivial mechanical edits read `swarm workers`. A role with no line inherits this conversation.\n\n**Match the model to the job.** The role line is the starting route, not a fence. Pass `model` or `reasoning_effort` only when the job needs a different route than its line. Raise the effort one step for the hardest or subtlest work, lower it one step for judgment, and two or more steps for routine work, such as read-only tracing, mechanical sweeps, or summarising a known diff. Stay in the role's model family when the catalog offers a family mate, because another family changes the character of the answer, not only its strength. Panel seats keep their listed level, and verification always runs on the `swarm workers` route. An unlisted model or an unsupported effort fails the call with the listed choices; read them, take the nearest route that exists, and say what you changed.",
  ],
  [/^- Before commit → `\/deslop` from the `cursor-team-kit` plugin\./m, '- Before commit → **unslop**.'],
  [
    /^## Writing the reply$/m,
    [
      '## Harness',
      '',
      'Read [`../../HARNESS.md`](../../HARNESS.md) before changing a skill or a call site. Three rules matter here.',
      '',
      '- `pstack_spawn` takes `description`, `prompt`, `role`, and optional `run_in_background`, `route_index`, `model`, `provider`, and `reasoning_effort`. The role line is the default route; a per-call model or effort adjusts one job.',
      '- Nine roles can hold a mapping. Any other role name, including `how-explainer` and `poteto-agent`, runs on this conversation\'s route.',
      '- A step that needs Cursor Automations, Bugbot, a cloud agent, or a plugin-provided tooling skill DSH does not ship gets one line, `Skipped in DSH: <step>. <reason>.`, and the work continues.',
      '',
      'Send a per-call `model` or `reasoning_effort` only to adjust one job\'s route, never to dodge the mapping silently. A call that names an unlisted model or an unsupported effort fails and lists the choices. Never write a rules file under a Cursor or Claude config path.',
      '',
      '## Writing the reply',
    ].join('\n'),
  ],
]

/**
 * Skills the model is told to load by name stay model-invocable here. Upstream
 * marks them user-only, but its prose tells the agent to read them, and DSH's
 * skill tool is the sanctioned way to do that.
 */
const MODEL_INVOCABLE = new Set([
  'unslop', 'typescript-best-practices', 'how', 'why', 'technical-writing', 'no-comments',
  'architect', 'arena', 'swarm', 'interrogate', 'figure-it-out', 'show-me-your-work',
  'benchmark-checklist', 'in-your-own-words', 'ketchup', 'tdd',
])

// Each entry names an upstream file and anchor. A changed anchor must be reviewed.
const LOOP_RULES = [
  ['poteto-mode/playbooks/autopilot-full.md', /Each owner is a Cursor cloud agent that builds/g, 'Each owner is a delegated agent with a parent-prepared worktree that builds'],
  ['poteto-mode/playbooks/shipping.md', /each a Cursor cloud agent/g, 'each a delegated agent with a parent-prepared worktree'],
  ['poteto-mode/playbooks/autopilot-full.md', /by the first tick/g, 'by the first audit'],
  ['poteto-mode/playbooks/autopilot-full.md', /A tick that changed something for the operator ends/g, 'An audit that changed something for the operator ends'],
  ['poteto-help/references/recipes.md', /\/loop until done/g, 'continue until done with `create_goal`'],
  ['poteto-help/references/prompting.md', /give `\/loop` that predicate/g, 'give `create_goal` that predicate for a finite autonomous objective'],
  ['poteto-help/SKILL.md', /Custom Modes and `\/loop` are Cursor features/g, 'Custom Modes are Cursor features'],
  ['poteto-help/SKILL.md', /`\/loop` and `\/the skill-authoring flow` are Cursor built-ins\./g, '`create_goal` supports finite autonomous objectives, not timed wakeups. Use managed background jobs for watchers. Scheduled tasks require an explicit human schedule request.'],
  ['poteto-help/SKILL.md', /`\/loop` needs a check that can pass or fail, not a duration\./g, 'An autonomous goal needs a check that can pass or fail, not a duration.'],
  ['poteto-mode/playbooks/bug-fix.md', /Drive a long or stubborn hunt with Cursor's `\/loop` command\./g, 'For a finite long hunt, use `create_goal` with a testable completion condition.'],
  ['poteto-mode/playbooks/visual-parity.md', /`\/loop` per component until the diff is zero\./g, 'Repeat each component check until the diff is zero. For a finite autonomous run, use `create_goal` with that completion condition.'],
  ['poteto-mode/playbooks/shipping.md', /under `\/loop` until it reports `COMPLETE` at the ceiling/g, 'as a managed background job until it reports `COMPLETE` at the ceiling'],
  ['poteto-mode/playbooks/autonomous-run.md', /^2\. Pick the wake mechanism.*$/m, "2. Define a finite autonomous objective and completion checks with `create_goal`. For an event, use a managed watcher or background job and collect its result. A goal does not provide fixed-time wakeups, and a time-based heartbeat is unavailable without a schedule explicitly requested by the human. Report this timing gap and audit progress whenever the session continues. Pick each subagent's reasoning effort for the job, per the Subagents section."],
  ['poteto-mode/playbooks/autopilot-full.md', /On the operator's go, arm `\/loop 1h` to audit until no delegated work is left, because long runs drift and agents stall silently\. Each tick/g, "On the operator's go, use `create_goal` for the finite objective of finishing delegated work. It does not provide hourly wakeups. Report that timed audits require an explicit human schedule request. Audit on each continuation until no delegated work is left, because long runs drift and agents stall silently. Each audit"],
  ['poteto-help/SKILL.md', /and mention once that a Custom Mode keeps it on\./g, 'and mention the **poteto workflow** row in the model menu, which keeps it on for the session.'],
  ['poteto-help/SKILL.md', /^1\. Install with `\/add-plugin pstack`.*$/m, '1. Install the DSH bundle `github:yuanv4/dsh-pstack` through Plugins.'],
  ['poteto-help/SKILL.md', /^2\. Run \[`\/setup-pstack`\].*$/m, '2. Optionally open Plugins → dsh-pstack to choose role routes. Without an overlay, roles inherit the conversation route.'],
  ['poteto-help/SKILL.md', /^- No `\$DSH_HOME\/pstack-dsh\.json` means.*$/m, '- No `$DSH_HOME/pstack-dsh.json` means every role inherits the conversation route.'],
  ['poteto-help/SKILL.md', /^When the model rule is missing[\s\S]*?Later:.*$/m, 'When role routing matters, point the user to Plugins → dsh-pstack. Without an overlay, every role inherits the conversation route.'],
  ['poteto-help/SKILL.md', /https:\/\/github\.com\/cursor\/plugins\/blob\/main\/pstack\//g, 'https://github.com/yuanv4/dsh-pstack/blob/main/'],
  ['poteto-help/SKILL.md', /^Installing changes nothing until.*$/m, 'Use the `/` menu or `skill` tool to load skills. The [README](../../README.md) and [HARNESS.md](../../HARNESS.md) describe DSH setup. Offer to word the first prompt per [`references/prompting.md`](references/prompting.md).'],
  ['poteto-help/SKILL.md', /^If cost is the worry,.*$/m, 'If cost is the worry, explain that subagents and review panels use tokens. Use Plugins → dsh-pstack to choose cheaper routes or fewer panel seats. An unmapped role inherits the conversation route.'],
  ['poteto-help/SKILL.md', /^Other tools can read the skills,.*$/m, 'DSH does not have Custom Modes or cloud agent machines. The parent prepares local worktrees when agents need isolation.'],
  ['poteto-help/SKILL.md', /Whether `\/poteto-mode` stays on depends on how the user starts it:[\s\S]*?Link \[Cursor's skills docs\]\(https:\/\/cursor\.com\/docs\/skills\) when this comes up\./m, 'The session mode is the **poteto workflow** row in the model menu: turn it on to apply the workflow to every step of the session and off to stop it. DSH has no per-message mode.'],
  ['poteto-help/SKILL.md', /as cloud agents \|/g, 'with delegated agents |'],
  ['poteto-help/SKILL.md', /^\| The mode stopped applying after a few turns \|.*$/m, '| The mode stopped applying after a few turns | Turn the **poteto workflow** row in the model menu on; it applies to every step of the session. |'],
  ['poteto-help/SKILL.md', /^\| Parallel agents overwrote each other \|.*$/m, '| Parallel agents overwrote each other | The parent prepares a separate local worktree for each isolated agent and passes its path in the brief. |'],
  ['poteto-help/SKILL.md', /^\| A new model choice had no effect \|.*$/m, '| A new model choice had no effect | Check the saved role route in Plugins → dsh-pstack and the current session route. |'],
  ['poteto-help/SKILL.md', /^\| A skill didn't load on its own \|.*$/m, '| A skill didn\'t load on its own | Invoke it from the slash menu or load it with the `skill` tool. |'],
  ['poteto-mode/playbooks/shipping.md', /`command -v origin`/g, '`Get-Command origin -ErrorAction SilentlyContinue`'],
  ['poteto-mode/playbooks/autopilot-full.md', /`command -v origin`/g, '`Get-Command origin -ErrorAction SilentlyContinue`'],
  ['poteto-mode/playbooks/shipping.md', /with the matching control skill \(such as drive the real surface yourself\)/g, 'by driving the real surface or using a named driver'],
  ['poteto-mode/playbooks/autopilot-full.md', /on the real surface through its control skill \(such as drive the real surface yourself\) or a named driver/g, 'by driving the real surface or using a named driver'],
  ['poteto-mode/playbooks/autopilot-stack.md', /Every loop tick prompt names this file, so each tick sees the no-merge rule\./g, 'Re-read this file on each continuation and enforce its no-merge rule.'],
  ['poteto-mode/playbooks/worktree-cleanup.md', /^1\. Snapshot and audit\..*$/m, '1. Snapshot and audit. Record free space on the relevant volume with a platform-appropriate tool. Run `scripts/worktree-audit.sh [-b <pr-base-ref>] [repo-path]` only when the script and a compatible shell are available. Without `-b` it checks `MERGED` against `origin/HEAD`; pass `-b origin/<branch>` for another base. Otherwise audit the paths from `git worktree list` for size, age, merge state, uncommitted work, PR state, and recent chat usage. Background a slow transcript scan.'],
  ['poteto-mode/playbooks/worktree-cleanup.md', /^5\. Prune the confirmed set\..*$/m, '5. Prune the confirmed set. Verify each resolved absolute target path is the intended worktree from `git worktree list` before any deletion. Run `git worktree remove --force <path>`. If ignored artifacts remain, verify the absolute path again before removing the directory using the native platform command, then run `git worktree prune`. Branch refs survive; uncommitted files do not. Record free space and re-list worktrees.'],
  ['poteto-mode/playbooks/worktree-cleanup.md', /^6\. Simulators and other reclaimers\..*$/m, '6. On macOS only, and only when `xcrun` and the relevant simulator tools are available, inspect simulator devices and runtimes before deleting the confirmed unused items. Inspect Xcode caches and other package caches as needed. Verify each resolved absolute target path before deletion. Clear only caches the user has not said to keep.'],
  ['poteto-mode/playbooks/worktree-cleanup.md', /^\*\*Reply:\*\* `df -h \/`.*$/m, '**Reply:** free space on the relevant volume before and after, the worktrees pruned, and a one-line reason for each held back.'],
]

/** Unsupported constructs in rewritten upstream text; local setup sources are copied separately. */
const LEFTOVER = [
  ['subagent_type', /subagent_type:/],
  ['Task tool', /\bTask\b/],
  ['cursor field', /`?readonly: (true|false)/],
  ['cursor path', /\.cursor\//],
  ['models file', /pstack-models/],
  ['AskQuestion', /AskQuestion/],
  ['TodoWrite', /TodoWrite/],
  ['cursor-team-kit', /cursor-team-kit/],
  ['/deslop', /\/deslop/],
  ['control skill', /control-(ui|cli)/],
  ['model slug', /\b(claude|gemini|gpt|grok)-[a-z0-9-]*\d[a-z0-9-]*/],
  ['model field', /\bmodel:\s/],
  ['cloud env', /environment: "(?:cloud|local)"/],
  ['cloud branch', /cloud_base_branch/],
  ['Cursor loop', /\/loop\b/],
  // The session switch is the Web row only; no command may be advertised.
  ['switch command', /\/pstack-poteto-mode/],
]

export function rewrite(text, rel, dest, failures) {
  for (const [pattern, value] of REWRITES) text = text.replace(pattern, value)
  for (const [from, to] of LITERALS) text = text.split(from).join(to)
  for (const [pattern, value] of LINE_RULES) text = text.replace(pattern, value)
  for (const [target, pattern, value] of LOOP_RULES) {
    if (rel !== target) continue
    pattern.lastIndex = 0
    if (!pattern.test(text)) failures.push(`${dest}/${rel}: missing required loop rewrite anchor ${pattern}`)
    pattern.lastIndex = 0
    text = text.replace(pattern, value)
  }
  if (rel === 'arena/SKILL.md' && (!text.includes('longest match') || !text.includes('recommends a base'))) failures.push(`${dest}/${rel}: missing arena rewrite anchor`)
  if (rel === 'swarm/SKILL.md' && !text.includes('catalog-supported overrides')) failures.push(`${dest}/${rel}: missing swarm rewrite anchor`)
  const skillName = rel.split('/')[0]
  if (rel.endsWith('/SKILL.md') && (skillName.startsWith('principle-') || MODEL_INVOCABLE.has(skillName))) {
    text = text.replace(/^disable-model-invocation: true\n/m, '')
  }
  for (const [label, pattern] of LEFTOVER) {
    if (pattern.test(text)) failures.push(`${dest}/${rel}: ${label}`)
  }
  return text
}
