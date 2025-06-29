/**
 * Configurações de ambiente da aplicação
 * Centraliza todas as variáveis de ambiente e configurações
 */
export interface EnvironmentConfig {
  // Server Configuration
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  
  // API Configuration
  API_BASE_URL: string;
  AUTH_TOKEN: string;
  API_TIMEOUT: number;
  API_RETRY_ATTEMPTS: number;
  
  // WebSocket Configuration
  CORS_ORIGIN: string;
  PING_TIMEOUT: number;
  PING_INTERVAL: number;
  
  // Polling Configuration
  POLLING_INTERVAL: number;
  MAX_MESSAGES_PER_BATCH: number;
  
  // Security Configuration
  RATE_LIMIT_WINDOW: number;
  RATE_LIMIT_MAX_REQUESTS: number;
}

/**
 * Valida e retorna as configurações de ambiente
 * @throws Error se configurações obrigatórias estiverem faltando
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const config: EnvironmentConfig = {
    // Server Configuration
    PORT: parseInt(process.env.PORT || '4000', 10),
    NODE_ENV: (process.env.NODE_ENV as EnvironmentConfig['NODE_ENV']) || 'development',
    
    // API Configuration
    API_BASE_URL: process.env.API_BASE_URL || 'https://n8n.546digitalservices.com/webhook/get_message_redis',
    AUTH_TOKEN: process.env.AUTH_TOKEN || 'eDmfkq$N^t0*NAPAfU$WaFXNE3*^ewqj!8Pop&DZ4F6CZPgG5!7f@Q44e%ZJYG6TxyKQOSgiumI3t',
    API_TIMEOUT: parseInt(process.env.API_TIMEOUT || '10000', 10),
    API_RETRY_ATTEMPTS: parseInt(process.env.API_RETRY_ATTEMPTS || '3', 10),
    
    // WebSocket Configuration
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    PING_TIMEOUT: parseInt(process.env.PING_TIMEOUT || '60000', 10),
    PING_INTERVAL: parseInt(process.env.PING_INTERVAL || '25000', 10),
    
    // Polling Configuration
    POLLING_INTERVAL: parseInt(process.env.POLLING_INTERVAL || '3000', 10),
    MAX_MESSAGES_PER_BATCH: parseInt(process.env.MAX_MESSAGES_PER_BATCH || '100', 10),
    
    // Security Configuration
    RATE_LIMIT_WINDOW: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
    RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  };

  // Validação de configurações obrigatórias
  validateConfig(config);
  
  return config;
}

/**
 * Valida as configurações obrigatórias
 * @param config Configurações a serem validadas
 * @throws Error se alguma configuração obrigatória estiver inválida
 */
function validateConfig(config: EnvironmentConfig): void {
  const errors: string[] = [];

  if (!config.API_BASE_URL || !isValidUrl(config.API_BASE_URL)) {
    errors.push('API_BASE_URL deve ser uma URL válida');
  }

  if (!config.AUTH_TOKEN || config.AUTH_TOKEN.length < 10) {
    errors.push('AUTH_TOKEN deve ter pelo menos 10 caracteres');
  }

  if (config.PORT < 1 || config.PORT > 65535) {
    errors.push('PORT deve estar entre 1 e 65535');
  }

  if (config.POLLING_INTERVAL < 1000) {
    errors.push('POLLING_INTERVAL deve ser pelo menos 1000ms');
  }

  if (errors.length > 0) {
    throw new Error(`Configurações inválidas: ${errors.join(', ')}`);
  }
}

/**
 * Valida se uma string é uma URL válida
 * @param url String a ser validada
 * @returns true se for uma URL válida
 */
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
} 