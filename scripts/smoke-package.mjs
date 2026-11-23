import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs'
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
  const providers = []
  const commands = []
  const sections = []
  const prompt = { section: section => { sections.push(section); return () => {} } }
  const registeredTools = []
  const tools = { get: () => undefined, restrict: () => () => {} }
  const agent = { session: { id: 'smoke-session', header: { origin: 'user' } }, ctx: { get: name => ({ tools, systemPrompt: prompt })[name] } }
  const services = {
    commands: { register: command => { commands.push(command); return () => {} } },
    agents: { list: () => [agent], get: id => id === agent.session.id ? agent : undefined },
  }
  const ctx = {
    get: name => services[name],
    tools: { register: tool => { registeredTools.push(tool) } },
    skills: { registerProvider: factory => { providers.push(factory) } },
    on: () => () => {},
    inject: () => {},
  }
  const { apply } = await import(pathToFileURL(join(pkg, 'harness/pstack/dsh/dist/index.js')).href)
  apply(ctx)
  assert.equal(providers.length, 1)
  const spawn = registeredTools.find(tool => tool.name === 'pstack_spawn')
  const interrupt = registeredTools.find(tool => tool.name === 'pstack_interrupt')
  assert.ok(spawn && 'name' in spawn.parameters.properties, 'packaged pstack_spawn must accept name')
  assert.ok(interrupt && 'agent' in interrupt.parameters.properties, 'packaged pstack_interrupt must accept agent')
  const provider = providers[0]()
  const skills = await provider.list()
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
  const command = commands.find(entry => entry.name === 'pstack-poteto-mode')
  assert.ok(command, 'poteto command must register')
  assert.equal((await command.handler({ agent, rawInput: 'on' })).kind, 'success')
  assert.equal(sections.length, 1, 'enabling poteto must register a prompt section')
  assert.equal(sections[0].name, 'pstack:poteto-workflow')
  assert.equal(sections[0].text, poteto.content)
  console.log(`Package smoke passed using packed apply: ${skills.length} skills, ${registeredTools.length} tools, and matching nonempty poteto prompt (fake host, not live DSH activation)`)
} finally {
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  const tempRelative = relative(tempRoot, temp)
  assert.ok(tempRelative && !tempRelative.startsWith(`..${sep}`) && tempRelative !== '..' && !tempRelative.includes(sep) && tempRelative.startsWith('pstack-pack-'), 'refusing to remove an unexpected temporary path')
  assert.equal(realpathSync(temp), temp, 'temporary directory changed before cleanup')
  rmSync(temp, { recursive: true, force: true })
}
