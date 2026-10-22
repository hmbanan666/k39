import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { normalizeObjectSchema, safeParse } from '@modelcontextprotocol/sdk/server/zod-compat.js'
import { describe, expect, it } from 'vitest'
import { mcpStrictInput } from '../server/utils/mcp/tool'
import { venueDuplicatesInput, venueListItem, venueListResult, venuesListInput } from '../server/utils/mcp/venues'

function repoRoot() {
  const candidates = [process.cwd(), resolve(process.cwd(), '../..')]
  return candidates.find((dir) => existsSync(resolve(dir, 'pnpm-workspace.yaml'))) ?? process.cwd()
}

const toolDir = resolve(repoRoot(), 'apps/web-app/server/mcp/tools')

function toolSource(name: string) {
  return readFileSync(resolve(toolDir, name), 'utf8')
}

describe('venues_list input', () => {
  it('lists additionalProperties false and rejects offset through the MCP server', async () => {
    // `@nuxtjs/mcp-toolkit/server` imports nitropack virtual storage and cannot
    // load in vitest. `registerToolFromDefinition` forwards inputSchema to this
    // same `McpServer.registerTool` call.
    const server = new McpServer({ name: 'k39-test', version: '0.0.0' })
    let handlerRan = false
    server.registerTool('venues_list', {
      description: 'List venues',
      inputSchema: mcpStrictInput(venuesListInput),
    }, async () => {
      handlerRan = true
      return { content: [{ type: 'text', text: 'ok' }] }
    })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 'k39-test-client', version: '0.0.0' })
    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ])
    try {
      const listed = await client.listTools()
      const tool = listed.tools.find((row) => row.name === 'venues_list')
      expect(tool?.inputSchema.additionalProperties).toBe(false)
      const result = await client.callTool({ name: 'venues_list', arguments: { offset: 20 } })
      expect(result.isError).toBe(true)
      const text = Array.isArray(result.content)
        ? result.content.map((part) => 'text' in part ? part.text : '').join('\n')
        : ''
      expect(text).toContain('Unrecognized key')
      expect(text).toContain('offset')
      expect(handlerRan).toBe(false)
    } finally {
      await client.close()
      await server.close()
    }
  })

  it('rejects offset and limit and keeps page as the 1-based offset', () => {
    const schema = normalizeObjectSchema(venuesListInput)
    expect(schema).toBe(venuesListInput)
    expect(safeParse(venuesListInput, { offset: 50, page: 2 }).success).toBe(false)
    expect(safeParse(venuesListInput, { limit: 200 }).success).toBe(false)
    expect(venuesListInput.parse({ page: 2, pageSize: 50, query: ' Ёлка ' })).toEqual({
      page: 2,
      pageSize: 50,
      query: 'Ёлка',
    })
    expect(toolSource('venues-list.ts')).toContain('inputSchema: mcpStrictInput(venuesListInput)')
    expect(toolSource('venues-list.ts')).toContain('db.venues.listPage')
    expect(toolSource('venues-list.ts')).not.toContain('.shape')
  })

  it('returns items with the page and the filtered total', () => {
    const now = new Date('2026-10-21T00:00:00.000Z')
    const row = {
      id: 'venue-1',
      slug: 'elka',
      name: 'Ёлка',
      kind: 'cafe',
      status: 'archived',
      regionId: null,
      latitude: 54.7,
      longitude: 20.5,
      lastVerifiedAt: null,
      priceBand: null,
      priceBandComputedAt: null,
      priceBandBasis: null,
      osmId: null,
      distanceKm: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-20T00:00:00.000Z',
    }
    const page = venueListResult([row], 3, 2, 1, now)
    expect(page).toMatchObject({ total: 3, page: 2, pageSize: 1 })
    expect(page.items).toEqual([venueListItem(row, now)])
    expect(page.items[0]).toMatchObject({
      slug: 'elka',
      status: 'archived',
      stale: true,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-20T00:00:00.000Z',
    })
    expect(toolSource('venue-get.ts')).toContain('createdAt: venue.createdAt')
    expect(toolSource('venue-get.ts')).toContain('updatedAt: venue.updatedAt')
    expect(toolSource('venues-list.ts')).toContain('createdAt and updatedAt')
    expect(toolSource('venue-update.ts')).toContain('unchanged is true only for the venue row')
    expect(toolSource('venue-update.ts')).toContain('their own tables')
    expect(toolSource('venue-update.ts')).toContain('updateVenue(input)')
    expect(toolSource('venue-create.ts')).toContain('SOURCE_LINK_LIMIT')
    expect(toolSource('venue-update.ts')).toContain('SOURCE_LINK_LIMIT')
  })
})

describe('venue_find_duplicates input', () => {
  it('requires a name or a point and rejects an unknown key', () => {
    expect(venueDuplicatesInput.safeParse({}).success).toBe(false)
    expect(venueDuplicatesInput.safeParse({ latitude: 54.7 }).success).toBe(false)
    expect(venueDuplicatesInput.safeParse({ offset: 0, name: 'Ёлка' }).success).toBe(false)
    expect(venueDuplicatesInput.parse({ name: ' Кафе «Ёлка» ', radiusM: 150 })).toMatchObject({
      name: 'Кафе «Ёлка»',
      radiusM: 150,
    })
    expect(normalizeObjectSchema(venueDuplicatesInput)).toBe(venueDuplicatesInput)
    const source = toolSource('venue-find-duplicates.ts')
    expect(source).toContain('readOnlyHint: true')
    expect(source).toContain('venue_find_duplicates')
    expect(source).toContain('findDuplicates')
  })
})

describe('content_score_preview tool', () => {
  it('is read-only and does not refresh stored scores', () => {
    const source = toolSource('content-score-preview.ts')
    expect(source).toContain('readOnlyHint: true')
    expect(source).toContain('previewContentScore')
    expect(source).toContain('mcpStrictInput')
    expect(source).not.toContain('refreshContentScores')
    expect(toolSource('content-score-get.ts')).toContain('content_score_preview')
  })
})
