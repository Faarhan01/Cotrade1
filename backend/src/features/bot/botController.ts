import { Request, Response } from 'express';
import { botStore } from './botStore.ts';
import { botEngine } from './botEngine.ts';

export class BotController {
  public static async listBots(req: Request, res: Response) {
    try {
      const bots = botStore.getAllBots();
      res.json({ success: true, count: bots.length, bots });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getBot(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const bot = botStore.getBot(id);
      if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });
      res.json({ success: true, bot });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async createBot(req: Request, res: Response) {
    try {
      const created = await botStore.createBot(req.body);
      res.status(201).json({ success: true, bot: created });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async updateBot(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const existing = botStore.getBot(id);
      if (!existing) return res.status(404).json({ success: false, message: 'Bot not found' });

      const updated = await botStore.saveBot({
        ...existing,
        ...req.body,
        id,
      });
      res.json({ success: true, bot: updated });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async startBot(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const bot = await botStore.updateBotStatus(id, 'RUNNING', 'Started via API');
      if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });
      res.json({ success: true, bot });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async pauseBot(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const bot = await botStore.updateBotStatus(id, 'PAUSED', 'Paused via API');
      if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });
      res.json({ success: true, bot });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async stopBot(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const bot = await botStore.updateBotStatus(id, 'STOPPED', 'Stopped via API');
      if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });
      res.json({ success: true, bot });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async deleteBot(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const deleted = await botStore.deleteBot(id);
      if (!deleted) return res.status(404).json({ success: false, message: 'Bot not found' });
      res.json({ success: true, message: 'Bot deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async evaluateBot(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const bot = botStore.getBot(id);
      if (!bot) return res.status(404).json({ success: false, message: 'Bot not found' });

      const signal = await botEngine.processBot(bot);
      res.json({ success: true, botId: id, signal });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async closePositions(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const result = await botEngine.closeBotPositions(id, req.body.reason || 'Manual user closure');
      res.json({ success: true, ...result });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getExecutions(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const limit = Number(req.query.limit) || 50;
      const executions = await botStore.getExecutions(id, limit);
      res.json({ success: true, count: executions.length, executions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getLogs(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const limit = Number(req.query.limit) || 50;
      const logs = await botStore.getLogs(id, limit);
      res.json({ success: true, count: logs.length, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async getPositions(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const positions = await botEngine.getBotPositions(id);
      res.json({ success: true, count: positions.length, positions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  public static async forceSignal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const signalType = (req.body.signal || 'BUY').toUpperCase() as 'BUY' | 'SELL';
      const result = await botEngine.forceSignal(id, signalType);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }
}
