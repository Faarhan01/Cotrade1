import { commandRegistry } from '@commands';

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
  };
}

export async function executeMcpTool(name: string, args: Record<string, any> = {}): Promise<any> {
  const result = await commandRegistry.execute(name, args, { source: 'MCP' });
  if (!result.success) {
    throw new Error(result.error || result.message || `Command failed: ${name}`);
  }
  return result.data;
}

export async function handleMcpJsonRpc(body: any): Promise<any> {
  const { jsonrpc = '2.0', id, method, params } = body || {};

  if (method === 'initialize') {
    return {
      jsonrpc,
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'Peron MT5 AI MCP Server', version: '3.0.0' },
      },
    };
  }

  if (method === 'tools/list') {
    return { jsonrpc, id, result: { tools: commandRegistry.toMcpTools() } };
  }

  if (method === 'tools/call') {
    const { name, arguments: toolArgs } = params || {};
    try {
      const result = await executeMcpTool(name, toolArgs || {});
      return {
        jsonrpc,
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          isError: false,
        },
      };
    } catch (err: any) {
      return {
        jsonrpc,
        id,
        result: {
          content: [{ type: 'text', text: err.message || 'Command execution failed' }],
          isError: true,
        },
      };
    }
  }

  return {
    jsonrpc,
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}