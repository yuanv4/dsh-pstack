import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { createSkillProvider } from '../src/skills-provider.ts'
import { spawnTool } from '../src/tools.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKILLS = join(ROOT, 'generated', 'skills')

const FORBIDDEN: { id: string; re: RegExp; allow?: string[] }[] = [
  { id: 'AskQuestion', re: /AskQuestion/, allow: ['skills/setup-pstack/references/spawn.md'] },
  { id: 'TodoWrite', re: /TodoWrite/ },
  { id: 'pstack-models.mdc', re: /pstack-models\.mdc/ },
  { id: 'claude-fable-5-thinking-max', re: /claude-fable-5-thinking-max/ },
  { id: 'gpt-5.6-sol-max', re: /gpt-5\.6-sol-max/ },
  { id: 'grok-4.6-fast-xhigh', re: /grok-4\.6-fast-xhigh/ },
  { id: 'claude-opus-5-thinking-xhigh', re: /claude-opus-5-thinking-xhigh/ },
  { id: 'subagent_type assignment', re: /subagent_type:/, allow: ['skills/setup-pstack/references/spawn.md'] },
  { id: 'get_task_output', re: /get_task_output/ },
  { id: 'cursor-team-kit', re: /cursor-team-kit/ },
  { id: '/deslop', re: /\/deslop/ },
  { id: 'environment cloud', re: /environment:\s*"cloud"/ },
]

async function walkMd(dir: string): Promise<string[]> {
  const out: string[] = []
  for (const name of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, name.name)
    if (name.isDirectory()) out.push(...await walkMd(path))
    else if (name.name.endsWith('.md')) out.push(path)
  }
  return out
}

describe('skill call sites', () => {
  it('does not keep Cursor/Grok spawn fields in playbooks', async () => {
    const files = await walkMd(SKILLS)
    const hits: string[] = []
    for (const file of files) {
      const rel = `skills/${file.slice(SKILLS.length + 1).replaceAll('\\', '/')}`
      const text = await readFile(file, 'utf8')
      for (const rule of FORBIDDEN) {
        if (rule.allow?.includes(rel)) continue
        if (rule.re.test(text)) hits.push(`${rel}: ${rule.id}`)
      }
    }
    assert.deepEqual(hits, [])
  })

  it('does not invoke the retired how-critics role from skills', async () => {
    const hits: string[] = []
    for (const file of await walkMd(SKILLS)) {
      const text = await readFile(file, 'utf8')
      // Match JSON, YAML, and JavaScript role arguments while allowing retirement notes.
      if (/["']?role["']?\s*[:=]\s*["'`]?how-critics\b/.test(text)
        || /pstack_spawn[^\n]*\bhow-critics\b/.test(text)) {
        hits.push(`skills/${file.slice(SKILLS.length + 1).replaceAll('\\', '/')}`)
      }
    }
    assert.deepEqual(hits, [])
  })

  it('registers poteto-mode as kebab-case', async () => {
    const provider = createSkillProvider(SKILLS)
    const listed = await provider.list()
    assert.ok(listed.some(skill => skill.name === 'poteto-mode'))
    assert.ok(!listed.some(skill => skill.name === 'Poteto Mode'))
    const loaded = await provider.get({ name: 'poteto-mode' })
    assert.ok(loaded)
    assert.match(loaded.content, /pstack_spawn/)
  })

  it('keeps the arena runner and judge seats on the DSH role lines', async () => {
    const arena = await readFile(join(SKILLS, 'arena', 'SKILL.md'), 'utf8')
    assert.match(arena, /Read every candidate end to end/)
    assert.match(arena, /If a candidate produces no output, proceed with N-1 and note the dropout\./)
    assert.match(arena, /The judge is never from the parent's vendor/)
    assert.match(arena, /`arena runners` line in `\$DSH_HOME\/pstack-dsh\.json`/)
    assert.match(arena, /`arena cross-judge pool` line in `\$DSH_HOME\/pstack-dsh\.json`/)
  })

  it('preserves arena judging, routing and job-specific effort guidance', async () => {
    const arena = await readFile(join(SKILLS, 'arena', 'SKILL.md'), 'utf8')
    assert.match(arena, /longest match/)
    assert.match(arena, /Fable.*Claude/)
    assert.match(arena, /provider.*not.*vendor/i)
    assert.match(arena, /route_index/)
    assert.match(arena, /unknown.*parent|parent.*unknown/i)
    assert.match(arena, /rubric criterion/)
    assert.match(arena, /path label/)
    assert.match(arena, /recommends a base/)
    assert.doesNotMatch(arena, /do not try to set it per call/)
    const swarm = await readFile(join(SKILLS, 'swarm', 'SKILL.md'), 'utf8')
    assert.doesNotMatch(swarm, /do not try to set it per call/)
    assert.match(swarm, /reasoning.*job/i)
  })

  it('does not invoke Cursor loop in generated skills', async () => {
    const hits: string[] = []
    for (const file of await walkMd(SKILLS)) {
      if (/\/loop\b/.test(await readFile(file, 'utf8'))) hits.push(`skills/${file.slice(SKILLS.length + 1).replaceAll('\\', '/')}`)
    }
    assert.deepEqual(hits, [])
  })

  it('gives DSH setup and isolation guidance without Cursor mode instructions', async () => {
    const help = await readFile(join(SKILLS, 'poteto-help', 'SKILL.md'), 'utf8')
    assert.match(help, /github:yuanv4\/dsh-pstack/)
    assert.match(help, /Plugins.*Configure/)
    assert.match(help, /DSH does not have Custom Modes/)
    assert.match(help, /parent.*worktree/i)
    assert.doesNotMatch(help, /\/add-plugin|Customize in the sidebar|Option\+Enter|Alt\+Enter|Use as Mode|cloud agents, which each get their own machine|spawn Cursor subagents/)
    assert.match(help, /Bugbot or Automations/)
  })

  it('keeps shipping and continuation instructions portable and coherent', async () => {
    for (const file of ['shipping.md', 'autopilot-full.md']) {
      const text = await readFile(join(SKILLS, 'poteto-mode', 'playbooks', file), 'utf8')
      assert.doesNotMatch(text, /command -v origin|(?:matching control skill|through its control skill) \(such as drive/)
      assert.match(text, /Get-Command origin/)
      assert.match(text, /driv(?:e|ing) the real surface/i)
    }
    const stack = await readFile(join(SKILLS, 'poteto-mode', 'playbooks', 'autopilot-stack.md'), 'utf8')
    assert.doesNotMatch(stack, /loop tick/)
    assert.match(stack, /re-read.*each continuation/i)
    assert.match(stack, /do not merge/i)
    const swarm = await readFile(join(SKILLS, 'swarm', 'SKILL.md'), 'utf8')
    assert.match(swarm, /Spawn all N workers in one message/)
  })

  it('guards platform-specific cleanup and checks paths before deletion', async () => {
    const cleanup = await readFile(join(SKILLS, 'poteto-mode', 'playbooks', 'worktree-cleanup.md'), 'utf8')
    assert.doesNotMatch(cleanup, /`rm -rf`|`df -h \/`/)
    assert.match(cleanup, /verify.*absolute.*path.*before.*delet/i)
    assert.match(cleanup, /macOS.*(?:available|availability)/i)
    assert.match(cleanup, /(?:shell|bash).*available/i)
  })

  it('exposes pstack_spawn with an optional per-call route and nothing else', () => {
    const tool = spawnTool({})
    const keys = Object.keys(tool.parameters)
    assert.deepEqual(keys.sort(), ['description', 'model', 'prompt', 'provider', 'reasoning_effort', 'role', 'route_index', 'run_in_background'])
    assert.ok(!('thinking' in tool.parameters))
    assert.ok(!('isolation' in tool.parameters))
    assert.ok(!('subagent_type' in tool.parameters))
    // The role line stays the default; the call only adjusts this one child.
    assert.match(tool.description, /role line .* supplies the default route/)
    assert.match(tool.description, /send model or reasoning_effort only to adjust one job/)
  })
})
