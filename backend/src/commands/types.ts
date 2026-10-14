/**
 * Unified Command Architecture
 * Standardized across Bot, Daemon, MCP, and UI Terminals.
 */

export type CommandCategory = 'trading' | 'market' | 'account' | 'bot' | 'knowledge' | 'system';

export interface CommandContext {
  source: 'DAEMON' | 'MCP' | 'BOT' | 'API' | 'UI' | 'SYSTEM';
  aiName?: string;
  sessionId?: string;
  notify?: (type: string, payload: any) => void;
  metadata?: Record<string, any>;
}

export interface CommandDefinition<TParams = any, TResult = any> {
  name: string;
  aliases?: string[];
  mcpAliases?: string[];
  category: CommandCategory;
  description: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, any>;
    required?: string[];
  };
  handler: (params: TParams, context: CommandContext) => Promise<TResult>;
}

export interface CommandExecutionResult<T = any> {
  success: boolean;
  action: string;
  commandId?: string;
  data?: T;
  message?: string;
  error?: string;
  timestamp: number;
}
