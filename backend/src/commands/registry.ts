import {
  CommandDefinition,
  CommandContext,
  CommandCategory,
  CommandExecutionResult,
} from './types.ts';
import { tradeCommands } from './tradeCommands.ts';
import { marketCommands } from './marketCommands.ts';
import { accountCommands } from './accountCommands.ts';
import { botCommands } from './botCommands.ts';
import { knowledgeCommands } from './knowledgeCommands.ts';
import { systemCommands } from './systemCommands.ts';
import { mt5InsightCommands } from './mt5InsightCommands.ts';
import { logger } from '@core/utils/logger.ts';

export class CommandRegistry {
  private static instance: CommandRegistry;
  private commands: Map<string, CommandDefinition> = new Map();
  private aliasMap: Map<string, string> = new Map();

  private constructor() {
    this.registerAll([
      ...tradeCommands,
      ...marketCommands,
      ...accountCommands,
      ...botCommands,
      ...knowledgeCommands,
      ...systemCommands,
      ...mt5InsightCommands,
    ]);
  }

  public static getInstance(): CommandRegistry {
    if (!CommandRegistry.instance) {
      CommandRegistry.instance = new CommandRegistry();
    }
    return CommandRegistry.instance;
  }

  public register(command: CommandDefinition): void {
    const key = command.name.toUpperCase();
    this.commands.set(key, command);
    this.aliasMap.set(key, key);

    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliasMap.set(alias.toUpperCase(), key);
      }
    }

    if (command.mcpAliases) {
      for (const alias of command.mcpAliases) {
        this.aliasMap.set(alias.toUpperCase().replace(/^MT5_/, ''), key);
      }
    }
  }

  public registerAll(commands: CommandDefinition[]): void {
    for (const cmd of commands) {
      this.register(cmd);
    }
  }

  public get(nameOrAlias: string): CommandDefinition | undefined {
    if (!nameOrAlias) return undefined;
    const cleanKey = nameOrAlias.toUpperCase().trim();
    // Also support mt5_ prefix (e.g. mt5_execute_trade -> EXECUTE_TRADE)
    const normalizedKey = cleanKey.startsWith('MT5_') ? cleanKey.replace('MT5_', '') : cleanKey;
    const targetName = this.aliasMap.get(normalizedKey) || this.aliasMap.get(cleanKey);
    if (!targetName) return undefined;
    return this.commands.get(targetName);
  }

  public getAll(): CommandDefinition[] {
    return Array.from(this.commands.values());
  }

  public getByCategory(category: CommandCategory): CommandDefinition[] {
    return this.getAll().filter((c) => c.category === category);
  }

  public async execute(
    nameOrAlias: string,
    params: any = {},
    context: Partial<CommandContext> = {}
  ): Promise<CommandExecutionResult> {
    const cmd = this.get(nameOrAlias);
    const resolvedContext: CommandContext = {
      source: context.source || 'API',
      aiName: context.aiName || 'Unified Agent',
      sessionId: context.sessionId,
      notify: context.notify,
      metadata: context.metadata,
    };

    if (!cmd) {
      logger.warn('CommandRegistry', `Unrecognized command requested: ${nameOrAlias}`);
      return {
        success: false,
        action: nameOrAlias,
        message: `Unknown command or tool: ${nameOrAlias}`,
        error: `Command '${nameOrAlias}' not registered in Unified Command Architecture`,
        timestamp: Date.now(),
      };
    }

    try {
      logger.info('CommandRegistry', `Executing command: ${cmd.name} (via ${resolvedContext.source})`);
      const data = await cmd.handler(params, resolvedContext);
      return {
        success: data?.success !== false,
        action: cmd.name,
        commandId: data?.commandId,
        data,
        message: data?.message || `Command ${cmd.name} executed successfully`,
        timestamp: Date.now(),
      };
    } catch (err: any) {
      logger.error('CommandRegistry', `Execution failed for ${cmd.name}:`, err);
      return {
        success: false,
        action: cmd.name,
        message: err.message || 'Execution error',
        error: err.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Generates standard MCP Tool definitions for all commands
   */
  public toMcpTools(): any[] {
    const tools = new Map<string, any>();
    for (const cmd of this.getAll()) {
      for (const name of [`mt5_${cmd.name.toLowerCase()}`, ...(cmd.mcpAliases || [])]) {
        tools.set(name, { name, description: cmd.description, inputSchema: cmd.inputSchema });
      }
    }
    return Array.from(tools.values());
  }

  /**
   * Generates sanitized serializable metadata list for the UI
   */
  public toMetadataList(): any[] {
    return this.getAll().map((cmd) => ({
      name: cmd.name,
      aliases: cmd.aliases || [],
      mcpAliases: cmd.mcpAliases || [],
      category: cmd.category,
      description: cmd.description,
      inputSchema: cmd.inputSchema,
    }));
  }
}

export const commandRegistry = CommandRegistry.getInstance();
export const executeCommand = (
  action: string,
  params: any = {},
  context: Partial<CommandContext> = {}
) => commandRegistry.execute(action, params, context);
