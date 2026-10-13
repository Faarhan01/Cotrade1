import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { logger } from '@core/utils';

const execAsync = promisify(exec);

export interface MT5PackageInfo {
  installed: boolean;
  version?: string;
  pythonExecutable: string;
  pythonVersion?: string;
  packagePath?: string;
  terminalPath?: string;
  terminalFound: boolean;
  capabilities: string[];
  diagnostics: {
    canImport: boolean;
    error?: string;
    checkedAt: number;
  };
}

export class MT5PackageDetector {
  private static cachedInfo: MT5PackageInfo | null = null;
  private static lastCheckTime = 0;
  private static readonly CACHE_TTL_MS = 30000; // 30s cache

  public static async inspect(): Promise<MT5PackageInfo> {
    const now = Date.now();
    if (this.cachedInfo && now - this.lastCheckTime < this.CACHE_TTL_MS) {
      return this.cachedInfo;
    }

    const pythonExec = process.env.PYTHON_PATH || 'python3';
    let pythonVer = '';
    let installed = false;
    let version = '5.0.6231';
    let errorDetail: string | undefined;

    // 1. Check Python executable
    try {
      const { stdout } = await execAsync(`${pythonExec} --version`, { timeout: 3000 });
      pythonVer = stdout.trim();
    } catch {
      try {
        const { stdout } = await execAsync('python --version', { timeout: 3000 });
        pythonVer = stdout.trim();
      } catch {
        pythonVer = 'Not found in PATH';
      }
    }

    // 2. Check if MetaTrader5 module is importable
    try {
      const probe = `import sys; exec("try:\\n import MetaTrader5 as mt5\\n print('OK:' + getattr(mt5, '__version__', '5.0.6231'))\\nexcept Exception as e:\\n print('ERR:' + str(e))")`;
      const { stdout } = await execAsync(`${pythonExec} -c "${probe}"`, { timeout: 4000 });
      const out = stdout.trim();
      if (out.startsWith('OK:')) {
        installed = true;
        version = out.replace('OK:', '').trim() || '5.0.6231';
      } else if (out.startsWith('ERR:')) {
        errorDetail = out.replace('ERR:', '').trim();
      }
    } catch (e: any) {
      errorDetail = e.message || 'Execution error during package probe';
    }

    // 3. Check for terminal executable
    const envPath = process.env.MT5_TERMINAL_PATH;
    const defaultPaths = [
      'C:\\Program Files\\MetaTrader 5\\terminal64.exe',
      'C:\\Program Files (x86)\\MetaTrader 5\\terminal64.exe',
      '/wine/drive_c/Program Files/MetaTrader 5/terminal64.exe',
    ];
    let terminalFound = false;
    let detectedTerminalPath = envPath;

    if (envPath && fs.existsSync(envPath)) {
      terminalFound = true;
    } else {
      for (const p of defaultPaths) {
        if (fs.existsSync(p)) {
          terminalFound = true;
          detectedTerminalPath = p;
          break;
        }
      }
    }

    const capabilities = [
      'LIVE_TICK_STREAMING',
      'OHLCV_CANDLE_HISTORY',
      'LEVEL2_MARKET_DEPTH',
      'ACCOUNT_METRICS_SYNC',
      'POSITION_TRACKING',
      'PENDING_ORDER_MANAGEMENT',
      'HISTORICAL_DEALS_PULL',
      'HISTORICAL_ORDERS_PULL',
      'PRE_TRADE_MARGIN_CHECK',
      'PROFIT_PROJECTION_CALC',
      'DIRECT_ORDER_SEND',
      'SL_TP_MODIFICATION',
      'SUB_MILLISECOND_IPC',
    ];

    this.cachedInfo = {
      installed,
      version,
      pythonExecutable: pythonExec,
      pythonVersion: pythonVer,
      packagePath: process.env.PERON_PACKAGE_PATH || undefined,
      terminalPath: detectedTerminalPath,
      terminalFound,
      capabilities,
      diagnostics: {
        canImport: installed,
        error: errorDetail,
        checkedAt: now,
      },
    };
    this.lastCheckTime = now;

    return this.cachedInfo;
  }
}
