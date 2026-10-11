import { request } from './client';
import { MCPToolDefinition } from '../../types';

export const mcpApi = {
  getTools(): Promise<{ tools: MCPToolDefinition[]; serverInfo?: any }> {
    return request('/api/mcp/tools');
  },

  executeTool(name: string, args: Record<string, any>): Promise<any> {
    return request('/api/mcp/tools/execute', {
      method: 'POST',
      body: JSON.stringify({ name, arguments: args }),
    });
  },

  sendJsonRpc(body: any): Promise<any> {
    return request('/api/mcp', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};
