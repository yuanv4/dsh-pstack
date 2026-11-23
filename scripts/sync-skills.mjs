/**
 * Generate the mirrored trees from the `upstream/` snapshot.
 *
 * `skills/` and `agents/` get the DSH rewrites below, because this harness has
 * no `Task` tool, no per-call model, and no Cursor-only plugins. `docs/guide/` is
 * upstream's guide copied unchanged: it documents Cursor first, and rewriting it
 * here would invent documentation. `HARNESS.md` states the differences.
 *
 * Run `node scripts/sync-skills.mjs`. The build fails on any Cursor name that
 * survives a rewrite, and `tests/skills-generated.spec.ts` fails when the tree
 * drifts from this function.
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname, relative } from 'node:path'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const TREES = [
  { source: 'upstream/pstack/skills', dest: 'skills', mode: 'rewrite' },
  { source: 'upstream/pstack/agents', dest: 'agents', mode: 'rewrite' },
  { source: 'upstream/pstack/docs/guide', dest: 'docs/guide', mode: 'verbatim' },
]

/** Files this port owns: they describe the DSH editor, not a Cursor rules file. */
const SKIP = new Set([
  'setup-pstack/SKILL.md',
  'setup-pstack/references/spawn.md',
  'setup-pstack/references/catalog.md',
])

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
  ["Pick each subagent's reasoning level for the job, per the Subagents section.", "Reasoning effort comes from that role's line; do not try to set it per call."],
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
    "3. Pick the runners from the `arena runners` line in `$DSH_HOME/pstack-dsh.json`. A role with no routes inherits this conversation. When the line has routes, run one candidate per route and keep at least two runners; if a mapped route is no longer listed by DSH, drop that seat and say so. A route's family is its model name before the first hyphen. Spawn more for multiple design directions, and repeat one route when the work is generation-bound, not judgment-sensitive. Reasoning effort comes from the route; do not try to set it per call.",
  ],
  [
    /^After all Phase B candidates complete, spawn one read-only judge.*$/m,
    "After all Phase B candidates complete, spawn one read-only judge from the `arena cross-judge pool` line in `$DSH_HOME/pstack-dsh.json`. The judge is never from the parent's vendor, so use the first entry from another vendor. A role with no routes inherits this conversation. If a mapped route is no longer listed by DSH, take the next entry, or skip the judge, and say so.",
  ],
  [
    /^3\. Pick the worker model from the `swarm workers` line.*$/m,
    "3. Pick the worker route from the `swarm workers` line in `$DSH_HOME/pstack-dsh.json`. A role with no routes inherits this conversation. For a model race, name each arm's route up front. Reasoning effort comes from the route; do not try to set it per call.",
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
const MODEL_INVOCABLE = /^(principle-|unslop\/|typescript-best-practices\/|how\/|why\/|technical-writing\/|no-comments\/)/

/** Surviving Cursor names that are real defects. Port-owned files may name them. */
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
  ['model slug', /\b(claude|gemini|gpt|grok)-[a-z0-9-]+/],
  ['model field', /\bmodel:\s/],
  ['cloud env', /environment: "cloud"/],
]

function walk(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else out.push(full)
  }
  return out
}

/**
 * Build every generated tree in memory: output path to either file text, or
 * `{ copyFrom }` for a binary or non-Markdown asset copied byte for byte.
 */
export function buildSkills() {
  const files = new Map()
  const failures = []
  for (const { source, dest, mode } of TREES) {
    for (const file of walk(source)) {
      const rel = relative(source, file).replaceAll('\\', '/')
      if (!file.endsWith('.md')) {
        files.set(`${dest}/${rel}`, { copyFrom: file })
        continue
      }
      if (mode === 'rewrite' && SKIP.has(rel)) continue
      let text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '\n')
      if (mode === 'rewrite') {
        for (const [pattern, value] of REWRITES) text = text.replace(pattern, value)
        for (const [from, to] of LITERALS) text = text.split(from).join(to)
        for (const [pattern, value] of LINE_RULES) text = text.replace(pattern, value)
        if (MODEL_INVOCABLE.test(rel)) text = text.replace(/^disable-model-invocation: true\n/m, '')
        for (const [label, pattern] of LEFTOVER) {
          if (pattern.test(text)) failures.push(`${dest}/${rel}: ${label}`)
        }
      }
      files.set(`${dest}/${rel}`, text)
    }
  }
  return { files, failures }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { files, failures } = buildSkills()
  if (failures.length > 0) {
    console.error(`${failures.length} Cursor names survived the rewrite:`)
    for (const row of failures) console.error('  ' + row)
    process.exit(1)
  }
  // The mirrored trees are generated wholesale: anything a previous upstream
  // shipped and this one does not is stale, so remove it.
  const keep = new Set(files.keys())
  let pruned = 0
  for (const { dest } of TREES) {
    for (const file of walk(dest)) {
      const target = relative('.', file).replaceAll('\\', '/')
      if (keep.has(target) || SKIP.has(target.slice(dest.length + 1))) continue
      unlinkSync(file)
      pruned += 1
    }
  }
  let copied = 0
  for (const [target, value] of files) {
    mkdirSync(dirname(target), { recursive: true })
    if (typeof value === 'string') writeFileSync(target, value)
    else {
      copyFileSync(value.copyFrom, target)
      copied += 1
    }
  }
  console.log(`generated ${files.size - copied} text files and ${copied} copied assets, pruned ${pruned} stale files`)
}
