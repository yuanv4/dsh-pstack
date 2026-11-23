import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseSkillMarkdown } from '../src/frontmatter.ts'
import { emptyOverlay, parseOverlay } from '../src/overlay.ts'
import { applyRoleConfig } from '../src/request-overlay.ts'
import { normalizeRole } from '../src/roles.ts'
import { resolveSpawn } from '../src/spawn.ts'

describe('frontmatter', () => {
  it('maps Poteto Mode to kebab-case poteto-mode', () => {
    const parsed = parseSkillMarkdown(
      '---\nname: Poteto Mode\ndescription: poteto style\ndisable-model-invocation: true\n---\n\nBody\n',
      'poteto-mode',
    )
    assert.equal(parsed?.frontmatter.name, 'poteto-mode')
    assert.equal(parsed?.frontmatter.modelInvocable, false)
    assert.equal(parsed?.frontmatter.userInvocable, true)
  })

  it('drops a name that is not kebab-case', () => {
    const parsed = parseSkillMarkdown(
      '---\nname: Not Valid Name\ndescription: x\n---\n\nBody\n',
      'fallback',
    )
    assert.equal(parsed, undefined)
  })
})

describe('resolveSpawn', () => {
  it('inherits when the overlay is missing a mapping', () => {
    const resolved = resolveSpawn(emptyOverlay(), {
      role: 'feature, refactoring',
      description: 'build flag',
      prompt: 'add --json',
      runInBackground: true,
    })
    assert.equal(resolved.inherit, true)
    assert.equal(resolved.agentOptions, undefined)
    assert.equal(resolved.reasoningEffort, undefined)
  })

  it('maps a logged-in route without putting effort on the spawn schema', () => {
    const overlay = parseOverlay(JSON.stringify({
      version: 1,
      roles: {
        feature: {
          inherit: false,
          routes: [{ provider: 'deepseek-official', model: 'deepseek-chat', reasoningEffort: 'high' }],
        },
      },
    }))
    const resolved = resolveSpawn(overlay, {
      role: 'generalPurpose',
      description: 'ad hoc',
      prompt: 'help',
      runInBackground: true,
    })
    assert.equal(normalizeRole('generalPurpose'), 'poteto-agent')
    assert.equal(resolved.role, 'poteto-agent')
    assert.equal(resolved.inherit, true)

    const feature = resolveSpawn(overlay, {
      role: 'feature, refactoring',
      description: 'build flag',
      prompt: 'add --json',
      runInBackground: true,
    })
    assert.equal(feature.inherit, false)
    assert.deepEqual(feature.agentOptions, { provider: 'deepseek-official', model: 'deepseek-chat' })
    assert.equal(feature.reasoningEffort, 'high')
  })
})

describe('per-call route precedence', () => {
  const overlay = parseOverlay(JSON.stringify({
    version: 1,
    roles: {
      'feature, refactoring': { inherit: false, routes: [{ provider: 'codex', model: 'terra', reasoningEffort: 'high' }] },
      'swarm workers': { inherit: false, routes: [{ provider: 'opencode-go', model: 'flash', reasoningEffort: 'low' }] },
    },
  }))

  it('lets an explicit model beat the role line', () => {
    const resolved = resolveSpawn(overlay, {
      role: 'feature, refactoring',
      description: 'cheap sweep',
      prompt: 'scan',
      runInBackground: true,
      model: { provider: 'opencode-go', model: 'flash' },
      reasoningEffort: 'low',
    })
    assert.equal(resolved.inherit, false)
    assert.equal(resolved.routeSource, 'call')
    assert.deepEqual(resolved.agentOptions, { provider: 'opencode-go', model: 'flash' })
    assert.equal(resolved.reasoningEffort, 'low')
  })

  it('keeps the role model when only the effort is overridden', () => {
    const resolved = resolveSpawn(overlay, {
      role: 'feature, refactoring',
      description: 'hard job',
      prompt: 'refactor',
      runInBackground: true,
      reasoningEffort: 'xhigh',
    })
    assert.equal(resolved.routeSource, 'role')
    assert.deepEqual(resolved.agentOptions, { provider: 'codex', model: 'terra' })
    assert.equal(resolved.reasoningEffort, 'xhigh')
  })

  it('runs an unmapped role on an explicit model instead of inheriting', () => {
    const resolved = resolveSpawn(overlay, {
      role: 'how-explorer',
      description: 'trace',
      prompt: 'read',
      runInBackground: true,
      model: { provider: 'opencode-go', model: 'flash' },
    })
    assert.equal(resolved.inherit, false)
    assert.equal(resolved.routeSource, 'call')
    assert.deepEqual(resolved.agentOptions, { provider: 'opencode-go', model: 'flash' })
    assert.equal(resolved.reasoningEffort, undefined)
  })
})

describe('applyRoleConfig', () => {
  it('overlays effort onto LlmCallConfig, not onto a spawn field', () => {
    const next = applyRoleConfig(
      { provider: 'parent', model: 'parent-model' },
      { provider: 'deepseek-official', model: 'deepseek-chat', reasoningEffort: 'high' },
    )
    assert.equal(next.provider, 'deepseek-official')
    assert.equal(next.model, 'deepseek-chat')
    assert.equal(next.reasoningEffort, 'high')
  })
})
