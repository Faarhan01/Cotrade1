/**
 * MT5 Connection and Trading Configuration
 */

export type MT5ProviderType = 'peron' | 'remote_peron' | 'simulation' | 'ea';

export interface MT5Config {
  provider: MT5ProviderType;
  pythonPath: string;
  peronBridgePort: number;
  peronBridgeHost: string;
  autoStartBridge: boolean;
  pollIntervalMs: number;
  login?: number;
  password?: string;
  server?: string;
  terminalPath?: string;
  timeoutSeconds: number;
  defaultTimeframe: string;
}

export const defaultMT5Config: MT5Config = {
  provider: (process.env.MT5_PROVIDER as MT5ProviderType) || 'peron',
  pythonPath: process.env.PYTHON_PATH || 'python3',
  peronBridgePort: Number(process.env.PERON_PORT) || 8888,
  peronBridgeHost: process.env.PERON_HOST || '127.0.0.1',
  autoStartBridge: process.env.AUTO_START_PERON !== 'false',
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS) || 1000,
  login: process.env.MT5_LOGIN ? Number(process.env.MT5_LOGIN) : undefined,
  password: process.env.MT5_PASSWORD || undefined,
  server: process.env.MT5_SERVER || undefined,
  terminalPath: process.env.MT5_TERMINAL_PATH || undefined,
  timeoutSeconds: 30,
  defaultTimeframe: 'M1',
};
