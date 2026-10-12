import { request } from './client';

export const mcpApi = {
  async getTools(): Promise<{ tools: any[] }> {
    return request('/api/mcp/tools');
  },

  async executeTool(name: string, args: Record<string, any>): Promise<any> {
    return request('/api/mcp/tools/execute', {
      method: 'POST',
      body: JSON.stringify({ name, arguments: args }),
    });
  },

  async sendJsonRpc(body: any): Promise<any> {
    return request('/api/mcp', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
};