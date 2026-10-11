/**
 * Backend Logger Utility
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

class AppLogger {
  private format(level: LogLevel, prefix: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level.toUpperCase()}] [${prefix}] ${message}${metaStr}`;
  }

  debug(prefix: string, message: string, meta?: any) {
    if (process.env.DEBUG === 'true') {
      console.log(this.format('debug', prefix, message, meta));
    }
  }

  info(prefix: string, message: string, meta?: any) {
    console.log(this.format('info', prefix, message, meta));
  }

  warn(prefix: string, message: string, meta?: any) {
    console.warn(this.format('warn', prefix, message, meta));
  }

  error(prefix: string, message: string, meta?: any) {
    console.error(this.format('error', prefix, message, meta));
  }
}

export const logger = new AppLogger();
