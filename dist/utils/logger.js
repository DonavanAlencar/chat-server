"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = exports.LogLevel = void 0;
const environment_1 = require("../config/environment");
/**
 * Níveis de log disponíveis
 */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
/**
 * Sistema de logging centralizado
 * Implementa diferentes níveis de log e formatação estruturada
 */
class Logger {
    constructor(context) {
        this.config = (0, environment_1.getEnvironmentConfig)();
        this.context = context;
    }
    /**
     * Log de erro - sempre exibido
     * @param message Mensagem principal
     * @param error Erro opcional
     */
    error(message, error) {
        this.log(LogLevel.ERROR, message, error);
    }
    /**
     * Log de aviso
     * @param message Mensagem principal
     * @param data Dados adicionais opcionais
     */
    warn(message, data) {
        this.log(LogLevel.WARN, message, data);
    }
    /**
     * Log de informação
     * @param message Mensagem principal
     * @param data Dados adicionais opcionais
     */
    info(message, data) {
        this.log(LogLevel.INFO, message, data);
    }
    /**
     * Log de debug - só exibido em desenvolvimento
     * @param message Mensagem principal
     * @param data Dados adicionais opcionais
     */
    debug(message, data) {
        this.log(LogLevel.DEBUG, message, data);
    }
    /**
     * Método principal de logging
     * @param level Nível do log
     * @param message Mensagem principal
     * @param data Dados adicionais
     */
    log(level, message, data) {
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
    getCurrentLogLevel() {
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
    formatLogEntry(timestamp, level, message, data) {
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
    sanitizeData(data) {
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
        }
        catch (error) {
            return '[Data serialization error]';
        }
    }
    /**
     * Remove dados sensíveis do objeto
     * @param obj Objeto a ser sanitizado
     * @returns Objeto sem dados sensíveis
     */
    removeSensitiveData(obj) {
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
    writeLog(level, entry) {
        const colors = {
            [LogLevel.ERROR]: '\x1b[31m', // Vermelho
            [LogLevel.WARN]: '\x1b[33m', // Amarelo
            [LogLevel.INFO]: '\x1b[36m', // Ciano
            [LogLevel.DEBUG]: '\x1b[90m' // Cinza
        };
        const reset = '\x1b[0m';
        const color = colors[level] || '';
        if (level === LogLevel.ERROR) {
            console.error(`${color}${entry}${reset}`);
        }
        else {
            console.log(`${color}${entry}${reset}`);
        }
    }
    /**
     * Cria um logger filho com contexto adicional
     * @param subContext Contexto adicional
     * @returns Novo logger
     */
    child(subContext) {
        return new Logger(`${this.context}:${subContext}`);
    }
}
exports.Logger = Logger;
