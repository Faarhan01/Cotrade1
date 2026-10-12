import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { setupWebSocketServer } from './backend/src/services/websocketServer/websocketServer.ts';
import { mt5Router } from './backend/src/routes/mt5Routes.ts';
import { apiRouter } from './backend/src/routes/apiRoutes.ts';
import { corsMiddleware, requestLogger, errorHandler } from './backend/src/middleware/index.ts';
import { connectorManager } from './backend/src/features/mt5/ConnectorManager.ts';
import { logger } from './backend/src/core/utils/logger.ts';
import { Database } from './backend/src/core/database/database.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProd = process.env.NODE_ENV === 'production';
const PORT = 3000;
const MT5_PORT = 7777;

async function startServer() {
  const app = express();

  // Core Express Middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(corsMiddleware);
  app.use(requestLogger);

  // Mount API & MT5 routes
  app.use('/api', apiRouter);
  app.use('/', mt5Router);
  app.use('/api/mt5', mt5Router);

  // Error handling middleware
  app.use(errorHandler);

  const server = http.createServer(app);

  // Attach WebSocket server for real-time tick streaming and order events
  setupWebSocketServer(server);

  // Initialize Database
  try {
    await Database.initialize();
    logger.info("Server", "Database initialized");
  } catch (err: any) {
    logger.warn("Server", `Database initialization notice: ${err.message}`);
  }

  // Initialize Peron Python MT5 Connector Provider
  try {
    await connectorManager.initialize();
    logger.info('Server', 'Peron Python MT5 Connector initialized and active');
  } catch (err: any) {
    logger.warn('Server', `Connector initialization notice: ${err.message}`);
  }

  // Vite middleware in dev or static files in production
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  }

  // Start Main Server on Port 3000
  server.listen(PORT, '0.0.0.0', () => {
    logger.info('Server', `Web UI & Peron MT5 Terminal running at http://localhost:${PORT}`);
  });

  // Start Dedicated MT5 Listener on Port 7777 (for backward compatibility if needed)
  try {
    const mt5App = express();
    mt5App.use(express.json({ limit: '10mb' }));
    mt5App.use(corsMiddleware);
    mt5App.use('/', mt5Router);
    mt5App.use('/api/mt5', mt5Router);
    mt5App.use('/api', apiRouter);

    const mt5Server = http.createServer(mt5App);
    mt5Server.listen(MT5_PORT, '0.0.0.0', () => {
      logger.info('Server', `Dedicated MT5 Bridge port listening at http://127.0.0.1:${MT5_PORT}`);
    });
    mt5Server.on('error', (err: any) => {
      logger.warn('Server', `Port ${MT5_PORT} notice: ${err.message}. Port ${PORT} remains active.`);
    });
  } catch (err: any) {
    logger.warn('Server', `Could not bind port ${MT5_PORT}: ${err.message}`);
  }

  // Clean shutdown
  const shutdown = async () => {
    logger.info('Server', 'Shutting down services...');
    await connectorManager.shutdown();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer().catch((err) => {
  logger.error('Server', 'Failed to start server:', err);
  process.exit(1);
});
