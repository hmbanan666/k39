import type { McpToolDefinition } from '@nuxtjs/mcp-toolkit/server'
import type { ZodRawShape } from 'zod'
import { z } from 'zod'

/**
 * Toolkit 0.24 types only raw shapes, but SDK registerTool accepts schemas.
 * Keep the cast here until the toolkit supports strict objects natively.
 * Protocol tests exercise tools/list and tools/call with the installed SDK.
 */
export function mcpStrictInput(schema: z.ZodType): ZodRawShape {
  return schema as unknown as ZodRawShape
}

/** Every tool rejects unknown arguments, including tools with no parameters. */
export function defineStrictMcpTool<
  const Input extends ZodRawShape = ZodRawShape,
  const Output extends ZodRawShape = ZodRawShape,
>(definition: McpToolDefinition<Input, Output> & { inputSchema: Input }): McpToolDefinition<Input, Output> {
  const input = definition.inputSchema
  const schema = input instanceof z.ZodType ? input : z.strictObject(input)
  return { ...definition, inputSchema: mcpStrictInput(schema) as Input }
}
