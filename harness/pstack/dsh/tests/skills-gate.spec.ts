import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import { createSkillProvider, defaultSkillsRoot } from '../src/skills-provider.ts'

/**
 * The session switch reaches the catalog through this seam: the registry hands
 * its view options to every provider, so a provider can withdraw the bundle for
 * a viewer whose session never opted in. These tests pin that behavior against
 * the real registry, because a DSH upgrade that stops passing the scope would
 * silently reopen the leak.
 */
describe('bundled skill scope gate', () => {
  const root = defaultSkillsRoot()

  it('withdraws every bundled skill from both surfaces while the gate excludes the viewer', async () => {
    const denied = createSkillProvider(root, () => false)
    const allowed = createSkillProvider(root)
    const deniedSkills = await denied.list({ scope: { session: { id: 'session-a' } } })
    const authoredSkills = await allowed.list()
    assert.ok(deniedSkills.length > 20, 'the bundle is loaded')
    assert.equal(deniedSkills.length, authoredSkills.length)
    assert.deepEqual(deniedSkills.filter(skill => skill.invocation.modelInvocable || skill.invocation.userInvocable), [])
    const loaded = await denied.get({ name: 'architect' }, { scope: { session: { id: 'session-a' } } })
    assert.equal(loaded?.invocation.modelInvocable, false)
    assert.equal(loaded?.invocation.userInvocable, false)
    assert.ok((loaded?.content.length ?? 0) > 0, 'the body still loads through the provider')
  })

  it('keeps the authored policy when the gate admits the viewer', async () => {
    const provider = createSkillProvider(root, () => true)
    const listed = await provider.list()
    assert.equal(listed.find(skill => skill.name === 'architect')?.invocation.modelInvocable, true)
    assert.equal(listed.find(skill => skill.name === 'poteto-mode')?.invocation.modelInvocable, false)
    assert.equal(listed.find(skill => skill.name === 'poteto-mode')?.invocation.userInvocable, true)
  })

  it('receives the viewing agent from the registry and rebuilds after invalidation', async () => {
    const seen: unknown[] = []
    let admitted = false
    let invalidate = (): void => {}
    const ctx = new Context()
    const registry = new SkillRegistry(ctx)
    registry.registerProvider(control => {
      invalidate = control.invalidate
      return createSkillProvider(root, (scope) => {
        seen.push(scope)
        return admitted
      })
    })
    const agent = { session: { id: 'session-a' } }

    const hidden = await registry.snapshot({ scope: agent })
    assert.equal(seen.at(-1), agent, 'the registry passes its view scope to the provider')
    assert.ok(hidden.skills.length > 20)
    assert.equal(hidden.skills.find(skill => skill.name === 'architect')?.invocation.modelInvocable, false)

    admitted = true
    invalidate()
    const shown = await registry.snapshot({ scope: agent })
    assert.equal(shown.skills.find(skill => skill.name === 'architect')?.invocation.modelInvocable, true)
    assert.equal(shown.skills.find(skill => skill.name === 'poteto-mode')?.invocation.modelInvocable, false)
  })
})
