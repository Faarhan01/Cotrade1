import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import { tradeStore } from '@services/tradeStore';
import { appendEvent } from '@services/eventBuffer';

let wss: WebSocketServer | null = null;
const clients: Set<WebSocket> = new Set();
const sseClients: Set<any> = new Set();

let totalEventsBroadcasted = 0;

export function addSseClient(res: any) {
  sseClients.add(res);
}

export function removeSseClient(res: any) {
  sseClients.delete(res);
}

export function getStreamStats() {
  return {
    wsClientsCount: clients.size,
    sseClientsCount: sseClients.size,
    totalEventsBroadcasted,
  };
}

export function setupWebSocketServer(server: Server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    clients.add(ws);

    // Send initial snapshot immediately upon connect
    const initialState = tradeStore.getState();
    ws.send(
      JSON.stringify({
        type: 'init',
        payload: initialState,
      })
    );

    ws.on('message', (message: string) => {
      try {
        const data = JSON.parse(message.toString());
        handleClientMessage(ws, data);
      } catch (e) {
        // Ignore malformed client message
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });

  return wss;
}

export function broadcast(message: { type: string; payload: any }, options: { persist?: boolean } = {}) {
  totalEventsBroadcasted++;
  const raw = JSON.stringify(message);

  // 1. Also buffer the event to file for persistence and querying
  if (options.persist !== false) appendEvent(message);

  // 2. Broadcast to WebSockets
  if (wss && clients.size > 0) {
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(raw);
      }
    }
  }

  // 3. Broadcast to Server-Sent Events (SSE) streams (External AI Agents)
  if (sseClients.size > 0) {
    for (const res of sseClients) {
      try {
        res.write(`event: ${message.type}\ndata: ${raw}\n\n`);
      } catch (e) {
        sseClients.delete(res);
      }
    }
  }
}

function handleClientMessage(ws: WebSocket, data: any) {
  if (data.type === 'ping') {
    ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
    return;
  }

  if (data.type === 'get_state') {
    ws.send(JSON.stringify({ type: 'init', payload: tradeStore.getState() }));
    return;
  }
}
