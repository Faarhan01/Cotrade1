import { IMT5Connector } from './mt5Provider.js';
import { PeronMT5Connector } from './PeronMT5Connector.js';
import { tradeStore } from '@services/tradeStore';
import { broadcast } from '@services/websocket';
import { defaultMT5Config, MT5ProviderType } from '@core/config';
import { logger } from '@core/utils';

class ConnectorManager {
  private activeConnector: IMT5Connector;
  private currentProvider: MT5ProviderType = defaultMT5Config.provider;

  constructor() {
    this.activeConnector = new PeronMT5Connector();
    this.setupActiveConnector();
  }

  private setupActiveConnector() {
    if (this.activeConnector instanceof PeronMT5Connector) {
      this.activeConnector.setOnSyncCallback((data) => {
        // Feed real-time synced data from Peron package directly into tradeStore
        tradeStore.handleDirectSync({
          account: data.account,
          positions: data.positions,
          pendingOrders: data.pendingOrders,
          ticks: data.ticks,
          symbols: data.symbols,
        });

        // Check for risk guard or trailing stop commands that need execution
        const pendingRiskCommands = tradeStore.getState().commandQueue.filter(
          (c) => c.status === 'pending' && c.source === 'RISK_GUARD'
        );
        for (const cmd of pendingRiskCommands) {
          cmd.status = 'dispatched';
          if (cmd.action === 'MODIFY_POSITION' && cmd.ticket) {
            this.activeConnector.modifyPosition(cmd.ticket, cmd.sl, cmd.tp).then((res) => {
              tradeStore.resolveExecutionResult({
                commandId: cmd.id,
                success: res.success,
                errorMessage: res.message,
              });
            });
          } else if (cmd.action === 'CLOSE_ALL') {
            for (const pos of data.positions) {
              this.activeConnector.closePosition(pos.ticket).then((res) => {
                tradeStore.addLog('warn', `Liquidated Position #${pos.ticket}`, res.message || '', 'RISK_GUARD');
              });
            }
          }
        }

        // Broadcast to frontend terminal clients
        broadcast({
          type: 'ea:sync',
          payload: {
            account: data.account,
            positions: data.positions,
            pendingOrders: data.pendingOrders,
            ticks: data.ticks,
            allSymbols: data.symbols,
            currentChart: tradeStore.getCurrentChart(),
            chartHistory: tradeStore.getChartHistory(),
            tickHistory: tradeStore.getTickHistory(),
            connection: tradeStore.getState().connection,
            isEaConnected: true,
            provider: this.activeConnector.name,
            lastEaSync: Date.now(),
          },
        });
      });
    }
  }

  public getConnector(): IMT5Connector {
    return this.activeConnector;
  }

  public getProviderName(): MT5ProviderType {
    return this.currentProvider;
  }

  public async setProvider(type: MT5ProviderType, config?: any): Promise<boolean> {
    logger.info('ConnectorManager', `Switching MT5 provider to ${type}`);
    await this.activeConnector.shutdown();

    if (type === 'peron' || type === 'simulation') {
      const port = config?.port || defaultMT5Config.peronBridgePort;
      const host = config?.host || defaultMT5Config.peronBridgeHost;
      this.activeConnector = new PeronMT5Connector(port, host);
    } else {
      // Default to Peron
      this.activeConnector = new PeronMT5Connector();
    }

    this.currentProvider = type;
    this.setupActiveConnector();
    return await this.activeConnector.initialize();
  }

  public async initialize(): Promise<boolean> {
    return await this.activeConnector.initialize();
  }

  public async shutdown(): Promise<void> {
    await this.activeConnector.shutdown();
  }
}

export const connectorManager = new ConnectorManager();
