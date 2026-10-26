import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { defineStrictMcpTool } from '../server/utils/mcp/tool'

// Only Nitro's cache/request context is virtual. Registration, schemas, SDK,
// transports, tools/list and tools/call are the installed production code.
vi.mock('nitropack/runtime', () => ({
  defineCachedFunction: (fn: unknown) => fn,
  useEvent: () => null,
}))

const modules = import.meta.glob('../server/mcp/tools/*.ts')

describe('strict MCP tool registration', () => {
  it('lists and enforces strict inputs for every actual tool', async () => {
    const path = new URL('tools.js', import.meta.resolve('@nuxtjs/mcp-toolkit/server'))
    const { registerToolFromDefinition } = await import(path.href)
    const server = new McpServer({ name: 'strict-input-test', version: '1.0.0' })
    const handler = vi.fn(() => ({ content: [{ type: 'text', text: 'ok' }] }))
    const definitions = await Promise.all(
      Object.values(modules).map(
        async (load) => ((await load()) as { default: ReturnType<typeof defineStrictMcpTool> }).default,
      ),
    )
    expect(definitions.length).toBeGreaterThan(80)
    for (const definition of definitions) {
      registerToolFromDefinition(server, { ...definition, cache: undefined, handler })
    }
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 'test-client', version: '1.0.0' })
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)])
    try {
      const { tools } = await client.listTools()
      expect(tools).toHaveLength(definitions.length)
      for (const tool of tools) {
        expect(tool.inputSchema.additionalProperties, tool.name).toBe(false)
        const result = await client.callTool({ name: tool.name, arguments: { __unexpected: true } })
        expect(result.isError, tool.name).toBe(true)
        expect(JSON.stringify(result.content), tool.name).toContain('__unexpected')
      }
      expect(handler).not.toHaveBeenCalled()
    } finally {
      await client.close()
      await server.close()
    }
  })

  it('preserves defaults, transformations and inferred handler arguments', () => {
    const tool = defineStrictMcpTool({
      inputSchema: { page: z.number().default(1), query: z.string().trim() },
      handler: ({ page, query }) => `${page}:${query}`,
    })
    const schema = tool.inputSchema as unknown as z.ZodType
    expect(schema.parse({ query: ' форт ' })).toEqual({ page: 1, query: 'форт' })
    expect(schema.safeParse({ query: 'форт', offset: 20 }).success).toBe(false)
  })
})
