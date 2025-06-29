import { getEnvironmentConfig } from '../config/environment';

/**
 * Níveis de log disponíveis
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

/**
 * Sistema de logging centralizado
 * Implementa diferentes níveis de log e formatação estruturada
 */
export class Logger {
  private readonly context: string;
  private readonly config = getEnvironmentConfig();

  constructor(context: string) {
    this.context = context;
  }

  /**
   * Log de erro - sempre exibido
   * @param message Mensagem principal
   * @param error Erro opcional
   */
  error(message: string, error?: any): void {
    this.log(LogLevel.ERROR, message, error);
  }

  /**
   * Log de aviso
   * @param message Mensagem principal
   * @param data Dados adicionais opcionais
   */
  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  /**
   * Log de informação
   * @param message Mensagem principal
   * @param data Dados adicionais opcionais
   */
  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  /**
   * Log de debug - só exibido em desenvolvimento
   * @param message Mensagem principal
   * @param data Dados adicionais opcionais
   */
  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  /**
   * Método principal de logging
   * @param level Nível do log
   * @param message Mensagem principal
   * @param data Dados adicionais
   */
  private log(level: LogLevel, message: string, data?: any): void {
    const currentLevel = this.getCurrentLogLevel();
    
    if (level > currentLevel) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelName = LogLevel[level];
    const logEntry = this.formatLogEntry(timestamp, levelName, message, data);
    
    this.writeLog(level, logEntry);
  }

  /**
   * Obtém o nível de log atual baseado no ambiente
   * @returns Nível de log atual
   */
  private getCurrentLogLevel(): LogLevel {
    switch (this.config.NODE_ENV) {
      case 'production':
        return LogLevel.INFO;
      case 'test':
        return LogLevel.WARN;
      case 'development':
      default:
        return LogLevel.DEBUG;
    }
  }

  /**
   * Formata a entrada de log
   * @param timestamp Timestamp ISO
   * @param level Nível do log
   * @param message Mensagem principal
   * @param data Dados adicionais
   * @returns String formatada do log
   */
  private formatLogEntry(timestamp: string, level: string, message: string, data?: any): string {
    const baseEntry = `[${timestamp}] ${level} [${this.context}] ${message}`;
    
    if (data) {
      const dataString = this.sanitizeData(data);
      return `${baseEntry} ${dataString}`;
    }
    
    return baseEntry;
  }

  /**
   * Sanitiza dados para logging seguro
   * @param data Dados a serem sanitizados
   * @returns String sanitizada
   */
  private sanitizeData(data: any): string {
    try {
      if (data instanceof Error) {
        return `Error: ${data.message}${data.stack ? `\n${data.stack}` : ''}`;
      }
      
      if (typeof data === 'object') {
        // Remove informações sensíveis
        const sanitized = this.removeSensitiveData(data);
        return JSON.stringify(sanitized, null, 2);
      }
      
      return String(data);
    } catch (error) {
      return '[Data serialization error]';
    }
  }

  /**
   * Remove dados sensíveis do objeto
   * @param obj Objeto a ser sanitizado
   * @returns Objeto sem dados sensíveis
   */
  private removeSensitiveData(obj: any): any {
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth'];
    const sanitized = { ...obj };
    
    for (const key of sensitiveKeys) {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  /**
   * Escreve o log no console com cores apropriadas
   * @param level Nível do log
   * @param entry Entrada formatada
   */
  private writeLog(level: LogLevel, entry: string): void {
    const colors = {
      [LogLevel.ERROR]: '\x1b[31m', // Vermelho
      [LogLevel.WARN]: '\x1b[33m',  // Amarelo
      [LogLevel.INFO]: '\x1b[36m',  // Ciano
      [LogLevel.DEBUG]: '\x1b[90m'  // Cinza
    };
    
    const reset = '\x1b[0m';
    const color = colors[level] || '';
    
    if (level === LogLevel.ERROR) {
      console.error(`${color}${entry}${reset}`);
    } else {
      console.log(`${color}${entry}${reset}`);
    }
  }

  /**
   * Cria um logger filho com contexto adicional
   * @param subContext Contexto adicional
   * @returns Novo logger
   */
  child(subContext: string): Logger {
    return new Logger(`${this.context}:${subContext}`);
  }
} 