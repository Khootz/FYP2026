/**
 * Centralized Logging Utility
 * 
 * Easy to enable/disable all logs by changing LOG_ENABLED flag
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info('Restaurant', 'Fetching restaurants...');
 *   logger.error('OpenRice', 'Failed to fetch images', error);
 */

// ============================================================================
// CONFIGURATION - Change this to disable all logs
// ============================================================================
const LOG_ENABLED = true; // Set to false to disable all logs
const LOG_LEVELS = {
  debug: true,    // Detailed debugging info
  info: true,     // General information
  warn: true,     // Warnings
  error: true,    // Errors
  api: true,      // API calls
  timing: true,   // Performance timing
};

// ============================================================================
// Logger Class
// ============================================================================
class Logger {
  private enabled: boolean;
  private levels: typeof LOG_LEVELS;

  constructor() {
    this.enabled = LOG_ENABLED;
    this.levels = LOG_LEVELS;
  }

  private shouldLog(level: keyof typeof LOG_LEVELS): boolean {
    return this.enabled && this.levels[level];
  }

  private formatMessage(level: string, module: string, message: string, data?: any): void {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0]; // HH:MM:SS
    const emoji = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      api: '🌐',
      timing: '⏱️',
    }[level] || '📝';

    const prefix = `${emoji} [${timestamp}] [${module}]`;
    
    if (data !== undefined) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }

  /**
   * Debug level - detailed information for debugging
   */
  debug(module: string, message: string, data?: any): void {
    if (this.shouldLog('debug')) {
      this.formatMessage('debug', module, message, data);
    }
  }

  /**
   * Info level - general information
   */
  info(module: string, message: string, data?: any): void {
    if (this.shouldLog('info')) {
      this.formatMessage('info', module, message, data);
    }
  }

  /**
   * Warn level - warning messages
   */
  warn(module: string, message: string, data?: any): void {
    if (this.shouldLog('warn')) {
      this.formatMessage('warn', module, message, data);
    }
  }

  /**
   * Error level - error messages
   */
  error(module: string, message: string, error?: any): void {
    if (this.shouldLog('error')) {
      this.formatMessage('error', module, message, error);
      if (error?.stack) {
        console.error(error.stack);
      }
    }
  }

  /**
   * API level - API call logging
   */
  api(module: string, method: string, url: string, data?: any): void {
    if (this.shouldLog('api')) {
      const message = `${method} ${url}`;
      this.formatMessage('api', module, message, data);
    }
  }

  /**
   * Timing level - performance measurements
   */
  timing(module: string, operation: string, durationMs: number): void {
    if (this.shouldLog('timing')) {
      const message = `${operation} completed in ${durationMs}ms`;
      this.formatMessage('timing', module, message);
    }
  }

  /**
   * Group related logs together
   */
  group(label: string): void {
    if (this.enabled) {
      console.group(`📦 ${label}`);
    }
  }

  groupEnd(): void {
    if (this.enabled) {
      console.groupEnd();
    }
  }

  /**
   * Create a timer for measuring operation duration
   */
  startTimer(module: string, operation: string): () => void {
    const startTime = performance.now();
    this.debug(module, `⏱️ Starting: ${operation}`);
    
    return () => {
      const duration = Math.round(performance.now() - startTime);
      this.timing(module, operation, duration);
    };
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================
export const logger = new Logger();

// ============================================================================
// Quick enable/disable functions
// ============================================================================
export function enableLogs(): void {
  (LOG_ENABLED as any) = true;
  console.log('✅ Logging enabled');
}

export function disableLogs(): void {
  (LOG_ENABLED as any) = false;
  console.log('🔇 Logging disabled');
}
