export * from './packageDetector.ts';

export interface MT5GatewayConfig {
  bridgeHost: string;
  bridgePort: number;
  pythonExecutable: string;
  customPackagePath?: string;
  terminalPath?: string;
  autoReconnectIntervalMs: number;
  marketDepthSymbols: string[];
}

export const defaultGatewayConfig: MT5GatewayConfig = {
  bridgeHost: process.env.PERON_HOST || '127.0.0.1',
  bridgePort: Number(process.env.PERON_PORT) || 8888,
  pythonExecutable: process.env.PYTHON_PATH || 'python3',
  customPackagePath: process.env.PERON_PACKAGE_PATH,
  terminalPath: process.env.MT5_TERMINAL_PATH,
  autoReconnectIntervalMs: 15000,
  marketDepthSymbols: ['EURUSD', 'GBPUSD', 'XAUUSD', 'USDJPY', 'BTCUSD'],
};
