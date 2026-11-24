import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const tempRoot = realpathSync(tmpdir())
const temp = realpathSync(mkdtempSync(join(tempRoot, 'pstack-pack-')))
const previousHome = process.env.DSH_HOME
try {
  const sourceManifest = JSON.parse(readFileSync('package.json', 'utf8'))
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  execFileSync(npm, ['pack', '--silent', '--pack-destination', temp], { stdio: 'inherit', shell: process.platform === 'win32' })
  const archiveName = `${sourceManifest.name.replace(/^@/, '').replaceAll('/', '-')}-${sourceManifest.version}.tgz`
  execFileSync('tar', ['-xzf', join(temp, archiveName), '-C', temp], { stdio: 'inherit' })
  const pkg = join(temp, 'package')
  symlinkSync(resolve('node_modules'), join(pkg, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  const manifest = JSON.parse(readFileSync(join(pkg, 'package.json'), 'utf8'))
  assert.equal(manifest.name, sourceManifest.name)
  assert.equal(manifest.version, sourceManifest.version)
  for (const path of ['harness/pstack/dsh/dist/index.js', 'harness/pstack/dsh/dist/index.d.ts', 'harness/pstack/dsh/dist/client.js', 'cordis.patch.yml', 'harness/pstack/dsh/generated/HARNESS.md']) assert.ok(readFileSync(join(pkg, path)).length > 0)
  assert.match(readFileSync(join(pkg, 'cordis.patch.yml'), 'utf8'), /pstack-dsh/)
  assert.equal(manifest.exports['.'].default, './harness/pstack/dsh/dist/index.js')
  assert.equal(manifest.exports['./client'], './harness/pstack/dsh/dist/client.js')
  assert.equal(existsSync(join(pkg, 'HARNESS.md')), false, 'root HARNESS must not be packaged')
  const platformMap = readFileSync(join(pkg, 'harness/pstack/dsh/generated/docs/harness/dsh.md'), 'utf8')
  assert.ok(platformMap.trim(), 'platform map must be nonempty')
  assert.match(platformMap, /^# pstack in DeepSeek Harness\s*$/m)

  process.env.DSH_HOME = join(temp, 'home')
  const PSTACK_TOOLS = ['pstack_catalog', 'pstack_overlay_read', 'pstack_overlay_write', 'pstack_spawn', 'pstack_interrupt']
  const NATIVE_DELEGATION_TOOLS = ['subagent', 'subagent_fork']
  const { apply } = await import(pathToFileURL(join(pkg, 'harness/pstack/dsh/dist/index.js')).href)
  /** One fake host boot: what the packaged apply registered and what it withheld. */
  const boot = () => {
    const providers = []
    const sections = []
    const registeredTools = []
    const denied = []
    const names = [...PSTACK_TOOLS, ...NATIVE_DELEGATION_TOOLS]
    const prompt = { section: section => { sections.push(section); return () => {} } }
    const tools = {
      get: name => names.includes(name) ? { name } : undefined,
      restrict: filter => { denied.push([...(filter.deny ?? [])]); return () => {} },
    }
    const agent = { session: { id: 'smoke-session', header: { origin: 'user' } }, ctx: { get: name => ({ tools, systemPrompt: prompt })[name] } }
    const services = { agents: { list: () => [agent], get: id => id === agent.session.id ? agent : undefined } }
    const ctx = {
      get: name => services[name],
      tools: { register: tool => { registeredTools.push(tool) } },
      skills: { registerProvider: factory => { providers.push(factory({ invalidate() {} })) } },
      on: () => () => {},
      inject: () => {},
    }
    apply(ctx)
    return { agent, providers, sections, registeredTools, denied }
  }

  const off = boot()
  assert.equal(off.providers.length, 1)
  assert.deepEqual(off.denied.at(-1), PSTACK_TOOLS, 'switch off must withhold every bundled tool')
  const spawn = off.registeredTools.find(tool => tool.name === 'pstack_spawn')
  const interrupt = off.registeredTools.find(tool => tool.name === 'pstack_interrupt')
  assert.ok(spawn && 'name' in spawn.parameters.properties, 'packaged pstack_spawn must accept name')
  assert.ok(interrupt && 'agent' in interrupt.parameters.properties, 'packaged pstack_interrupt must accept agent')
  const provider = off.providers[0]
  const skills = await provider.list()
  const hidden = await provider.list({ scope: off.agent })
  assert.equal(hidden.length, skills.length)
  assert.equal(hidden.filter(skill => skill.invocation.modelInvocable || skill.invocation.userInvocable).length, 0, 'switch off must withdraw the bundle from both surfaces')
  const hiddenLoad = await provider.get({ name: 'architect' }, { scope: off.agent })
  assert.equal(hiddenLoad?.invocation.modelInvocable, false)
  assert.equal(hiddenLoad?.invocation.userInvocable, false)
  assert.ok(hiddenLoad?.content.trim())
  const skillsRoot = join(pkg, 'harness/pstack/dsh/generated/skills')
  const skillDirs = readdirSync(skillsRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .filter(entry => existsSync(join(skillsRoot, entry.name, 'SKILL.md')))
    .map(entry => entry.name).sort()
  assert.ok(skillDirs.length > 0)
  assert.deepEqual(skills.map(skill => relative(skillsRoot, dirname(skill.path))).sort(), skillDirs)
  assert.equal(new Set(skills.map(skill => skill.name)).size, skills.length)
  for (const skill of skills) {
    assert.ok(skill.name && skill.description?.trim(), 'skill name and description must be nonempty')
    assert.equal(skill.provider, provider.name)
    assert.equal(skill.source, 'bundled')
    assert.equal(typeof skill.invocation.modelInvocable, 'boolean')
    assert.equal(typeof skill.invocation.userInvocable, 'boolean')
    assert.equal(skill.resourceBase.kind, 'directory')
    assert.equal(skill.resourceBase.path, dirname(skill.path))
    assert.equal(skill.locator, dirname(skill.path))
    assert.equal(skill.path, join(skillsRoot, relative(skillsRoot, dirname(skill.path)), 'SKILL.md'))
    const file = readFileSync(skill.path, 'utf8').replace(/\r\n/g, '\n')
    const body = /^---\n[\s\S]*?\n---\s*\n([\s\S]*)$/.exec(file)?.[1]?.trimStart()
    assert.ok(body?.trim(), `${skill.name} must have nonempty packaged content`)
    const loaded = await provider.get({ name: skill.name, locator: skill.locator })
    assert.ok(loaded, `${skill.name} must load`)
    for (const key of ['name', 'description', 'whenToUse', 'invocation', 'provider', 'source', 'resourceBase', 'path']) assert.deepEqual(loaded[key], skill[key], `${skill.name} ${key}`)
    assert.equal(loaded.content, body, `${skill.name} content must match the packaged file`)
  }
  assert.equal(await provider.get({ name: 'not-a-packaged-skill' }), undefined)
  const poteto = await provider.get({ name: 'poteto-mode' })
  assert.ok(poteto?.content.trim())
  assert.match(poteto.content, /pstack_spawn/)
  mkdirSync(join(temp, 'home'), { recursive: true })
  writeFileSync(join(temp, 'home', 'pstack-poteto.json'), `${JSON.stringify({ version: 1, sessions: ['smoke-session'] })}\n`)
  const on = boot()
  assert.deepEqual(on.denied.at(-1), NATIVE_DELEGATION_TOOLS, 'switch on must withhold the native delegation tools')
  assert.equal(on.sections.length, 1, 'enabling poteto must register a prompt section')
  assert.equal(on.sections[0].name, 'pstack:poteto-workflow')
  assert.equal(on.sections[0].text, poteto.content)
  const shown = await on.providers[0].list({ scope: on.agent })
  assert.equal(shown.find(skill => skill.name === 'architect')?.invocation.modelInvocable, true, 'switch on must return the bundled skills to a model catalog')
  assert.equal(shown.find(skill => skill.name === 'poteto-mode')?.invocation.modelInvocable, false)
  assert.equal(shown.find(skill => skill.name === 'poteto-mode')?.invocation.userInvocable, true)
  console.log(`Package smoke passed using packed apply: ${skills.length} skills, ${off.registeredTools.length} tools, withheld tools on both switch states, and matching nonempty poteto prompt (fake host, not live DSH activation)`)
} finally {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  const tempRelative = relative(tempRoot, temp)
  assert.ok(tempRelative && !tempRelative.startsWith(`..${sep}`) && tempRelative !== '..' && !tempRelative.includes(sep) && tempRelative.startsWith('pstack-pack-'), 'refusing to remove an unexpected temporary path')
  assert.equal(realpathSync(temp), temp, 'temporary directory changed before cleanup')
  rmSync(temp, { recursive: true, force: true })
}
