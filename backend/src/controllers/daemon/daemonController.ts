import { Request, Response } from 'express';
import { daemonService } from '@features/daemon/daemonService';
import { readEvents, clearEvents } from '@services/eventBuffer';

export class DaemonController {
  // Get Daemon Status
  public static getStatus(req: Request, res: Response) {
    res.json({
      success: true,
      daemon: daemonService.getStatus(),
    });
  }

  // AI Registration & Heartbeat
  public static heartbeat(req: Request, res: Response) {
    const { aiName, sessionId, metadata } = req.body;
    const result = daemonService.registerHeartbeat(aiName, sessionId, metadata);
    res.json(result);
  }

  // External AI Dispatches Action or Command
  public static async dispatch(req: Request, res: Response) {
    try {
      const result = await daemonService.dispatchAICommand(req.body);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Post Custom Event to Buffer
  public static postEvent(req: Request, res: Response) {
    const { type, payload } = req.body;
    if (!type) {
      return res.status(400).json({ success: false, message: 'Event type is required' });
    }
    daemonService.notify(type, payload || {});
    res.json({ success: true, message: 'Event buffered successfully' });
  }

  // Query Filtered Events
  public static getEvents(req: Request, res: Response) {
    try {
      const options = {
        limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 100,
        type: req.query.type as string | undefined,
        startTime: req.query.startTime ? parseInt(req.query.startTime as string, 10) : undefined,
        endTime: req.query.endTime ? parseInt(req.query.endTime as string, 10) : undefined,
      };

      const events = readEvents(options);
      res.json({
        success: true,
        count: events.length,
        events,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // Clear Event Buffer
  public static clearEvents(req: Request, res: Response) {
    clearEvents();
    res.json({ success: true, message: 'Daemon event buffer cleared' });
  }

  // Update Daemon Config
  public static updateConfig(req: Request, res: Response) {
    const updated = daemonService.updateConfig(req.body);
    res.json({ success: true, config: updated });
  }

  // Update Watchlist
  public static updateWatchlist(req: Request, res: Response) {
    const { symbols } = req.body;
    if (!Array.isArray(symbols)) {
      return res.status(400).json({ success: false, message: 'symbols must be an array of strings' });
    }
    const updated = daemonService.updateWatchlist(symbols);
    res.json({ success: true, watchlist: updated });
  }

  // SSE Real-time Daemon Stream
  public static stream(req: Request, res: Response) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.flushHeaders?.();

    // Initial snapshot
    const initial = daemonService.getStatus();
    res.write(`event: snapshot\ndata: ${JSON.stringify(initial)}\n\n`);

    daemonService.addSseClient(res);

    req.on('close', () => {
      daemonService.removeSseClient(res);
    });
  }
}
