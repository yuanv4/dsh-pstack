import assert from 'node:assert/strict'
import { it } from 'node:test'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SubagentRuntime } from '@deepseek-ai/dsh-subagent'
import { interruptTool, type ToolHost } from '../src/tools.ts'

it('resolves a child and interrupts it with ancestor authority', async () => {
  const parent = {} as Agent
  const signal = new AbortController().signal
  const resolutions: unknown[][] = []
  const interruptions: unknown[][] = []
  const subagents = {
    async resolveName(...args: Parameters<SubagentRuntime['resolveName']>) {
      resolutions.push(args)
      return 'session-id'
    },
    async interrupt(...args: Parameters<SubagentRuntime['interrupt']>) {
      interruptions.push(args)
    },
  } as unknown as ToolHost['subagents']
  const tool = interruptTool({ subagents })
  await assert.rejects(tool.execute({}, { agent: parent, signal }))
  await assert.rejects(tool.execute({ agent: '' }, { agent: parent, signal }))
  assert.deepEqual(resolutions, [])
  assert.deepEqual(interruptions, [])
  assert.deepEqual(await tool.execute({ agent: 'worker-a' }, { agent: parent, signal }), { interrupted: true, agent: 'session-id' })
  assert.deepEqual(resolutions, [[parent, 'worker-a', signal]])
  assert.deepEqual(interruptions, [['session-id', { kind: 'ancestor', agent: parent }]])
})
