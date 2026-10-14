import { Request, Response } from 'express';
import { executeMcpTool, handleMcpJsonRpc } from '@/services/mcpServer';
import { commandRegistry } from '@commands';

export class MCPController {
  // Enumerate all available MCP tools
  public static listTools(req: Request, res: Response) {
    res.json({
      tools: commandRegistry.toMcpTools(),
      serverInfo: {
        name: 'Peron MT5 AI MCP Server',
        version: '3.0.0',
        transport: 'http-json-rpc',
        engine: 'Faarhan01/peron-python',
      },
    });
  }

  // Execute an MCP tool via REST POST
  public static async executeTool(req: Request, res: Response) {
    const { name, arguments: args } = req.body;
    if (!name) {
      return res.status(400).json({
        isError: true,
        content: [{ type: 'text', text: 'Tool name is required' }],
      });
    }

    try {
      const result = await executeMcpTool(name, args || {});
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        isError: true,
        content: [{ type: 'text', text: `Execution failed: ${err.message}` }],
      });
    }
  }

  // Handle standard JSON-RPC 2.0 messages from AI agents
  public static async handleJsonRpc(req: Request, res: Response) {
    const response = await handleMcpJsonRpc(req.body);
    res.json(response);
  }
}
