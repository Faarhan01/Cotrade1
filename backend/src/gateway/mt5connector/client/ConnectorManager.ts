import { IMT5Connector } from './mt5Provider.ts';
import { PeronMT5Connector } from './PeronMT5Connector.ts';
import { tradeStore } from '@services/tradeStore';
import { defaultMT5Config, MT5ProviderType } from '@core/config';
import { logger } from '@core/utils';
import { ingestPackageSnapshot } from '../dataflow/mt5Dataflow.ts';

class ConnectorManager {
  private activeConnector: IMT5Connector;
  private currentProvider: MT5ProviderType = defaultMT5Config.provider;
  private customConnectors: Map<string, IMT5Connector> = new Map();

  constructor() {
    this.activeConnector = new PeronMT5Connector();
    this.setupActiveConnector();
  }

  private setupActiveConnector() {
    if (this.activeConnector instanceof PeronMT5Connector) {
      this.activeConnector.setOnSyncCallback((data) => {
        ingestPackageSnapshot(data);

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

  /**
   * Registers a custom broker or API connector (e.g. cTrader, CCXT, FixAPI, Interactive Brokers)
   */
  public registerCustomConnector(name: string, connector: IMT5Connector): void {
    logger.info('ConnectorManager', `Registered custom connector provider: ${name}`);
    this.customConnectors.set(name, connector);
  }

  public async setCustomProvider(name: string): Promise<boolean> {
    const custom = this.customConnectors.get(name);
    if (!custom) {
      throw new Error(`Custom connector '${name}' not found`);
    }
    await this.activeConnector.shutdown();
    this.activeConnector = custom;
    this.currentProvider = name as any;
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
