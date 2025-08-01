"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecurityMiddleware = void 0;
const environment_1 = require("../config/environment");
const logger_1 = require("../utils/logger");
/**
 * Middleware de segurança para a aplicação
 * Implementa rate limiting, validação e sanitização
 */
class SecurityMiddleware {
    constructor() {
        this.config = (0, environment_1.getEnvironmentConfig)();
        this.logger = new logger_1.Logger('SecurityMiddleware');
        this.requestCounts = new Map();
    }
    /**
     * Rate limiting para requisições HTTP
     * @param req Requisição HTTP
     * @param res Resposta HTTP
     * @param next Próxima função
     */
    rateLimit(req, res, next) {
        const clientIp = this.getClientIp(req);
        const now = Date.now();
        // Limpa contadores expirados
        this.cleanupExpiredCounters(now);
        // Verifica rate limit
        const clientData = this.requestCounts.get(clientIp);
        if (!clientData || now > clientData.resetTime) {
            // Primeira requisição ou reset do período
            this.requestCounts.set(clientIp, {
                count: 1,
                resetTime: now + this.config.RATE_LIMIT_WINDOW
            });
            next();
            return;
        }
        if (clientData.count >= this.config.RATE_LIMIT_MAX_REQUESTS) {
            this.logger.warn(`Rate limit exceeded for IP: ${clientIp}`);
            res.status(429).json({
                error: 'Too Many Requests',
                message: 'Rate limit exceeded. Please try again later.',
                retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
            });
            return;
        }
        // Incrementa contador
        clientData.count++;
        next();
    }
    /**
     * Validação de entrada para WebSocket
     * @param socket Socket do cliente
     * @param data Dados recebidos
     * @returns true se os dados são válidos
     */
    validateWebSocketInput(socket, data) {
        try {
            // Validação básica de estrutura
            if (!data || typeof data !== 'object') {
                this.sendError(socket, 'Dados inválidos: deve ser um objeto');
                return false;
            }
            // Validação específica para startPolling
            if (data.event === 'startPolling') {
                return this.validateStartPollingData(socket, data);
            }
            return true;
        }
        catch (error) {
            this.logger.error('Erro na validação de entrada WebSocket:', error);
            this.sendError(socket, 'Erro interno na validação');
            return false;
        }
    }
    /**
     * Sanitiza dados de entrada
     * @param data Dados a serem sanitizados
     * @returns Dados sanitizados
     */
    sanitizeInput(data) {
        if (typeof data === 'string') {
            return this.sanitizeString(data);
        }
        if (Array.isArray(data)) {
            return data.map(item => this.sanitizeInput(item));
        }
        if (typeof data === 'object' && data !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(data)) {
                const sanitizedKey = this.sanitizeString(key);
                sanitized[sanitizedKey] = this.sanitizeInput(value);
            }
            return sanitized;
        }
        return data;
    }
    /**
     * Validação de CORS
     * @param origin Origem da requisição
     * @returns true se a origem for permitida
     */
    validateCors(origin) {
        if (this.config.CORS_ORIGIN === '*') {
            return true;
        }
        const allowedOrigins = this.config.CORS_ORIGIN.split(',').map(o => o.trim());
        return allowedOrigins.includes(origin);
    }
    /**
     * Headers de segurança para HTTP
     * @param req Requisição HTTP
     * @param res Resposta HTTP
     * @param next Próxima função
     */
    securityHeaders(req, res, next) {
        // Previne clickjacking
        res.setHeader('X-Frame-Options', 'DENY');
        // Previne MIME type sniffing
        res.setHeader('X-Content-Type-Options', 'nosniff');
        // Política de segurança de conteúdo
        res.setHeader('Content-Security-Policy', "default-src 'self'");
        // Previne XSS
        res.setHeader('X-XSS-Protection', '1; mode=block');
        // Referrer policy
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        next();
    }
    /**
     * Valida dados específicos do startPolling
     * @param socket Socket do cliente
     * @param data Dados a serem validados
     * @returns true se os dados são válidos
     */
    validateStartPollingData(socket, data) {
        if (!data.key || typeof data.key !== 'string') {
            this.sendError(socket, 'Chave obrigatória para iniciar polling');
            return false;
        }
        if (data.key.length === 0 || data.key.length > 100) {
            this.sendError(socket, 'Chave deve ter entre 1 e 100 caracteres');
            return false;
        }
        if (!/^[a-zA-Z0-9_-]+$/.test(data.key)) {
            this.sendError(socket, 'Chave contém caracteres inválidos');
            return false;
        }
        return true;
    }
    /**
     * Sanitiza uma string
     * @param str String a ser sanitizada
     * @returns String sanitizada
     */
    sanitizeString(str) {
        return str
            .replace(/[<>]/g, '') // Remove caracteres potencialmente perigosos
            .trim()
            .slice(0, 10000); // Limita tamanho
    }
    /**
     * Obtém IP do cliente
     * @param req Requisição HTTP
     * @returns IP do cliente
     */
    getClientIp(req) {
        return req.ip ||
            req.connection.remoteAddress ||
            req.socket.remoteAddress ||
            'unknown';
    }
    /**
     * Limpa contadores expirados
     * @param now Timestamp atual
     */
    cleanupExpiredCounters(now) {
        for (const [ip, data] of this.requestCounts.entries()) {
            if (now > data.resetTime) {
                this.requestCounts.delete(ip);
            }
        }
    }
    /**
     * Envia erro para o cliente WebSocket
     * @param socket Socket do cliente
     * @param message Mensagem de erro
     */
    sendError(socket, message) {
        socket.emit('error', {
            message,
            timestamp: new Date().toISOString()
        });
    }
    /**
     * Log de tentativa de acesso suspeito
     * @param ip IP do cliente
     * @param reason Razão da suspeita
     */
    logSuspiciousActivity(ip, reason) {
        this.logger.warn(`Atividade suspeita detectada - IP: ${ip}, Razão: ${reason}`);
    }
}
exports.SecurityMiddleware = SecurityMiddleware;
