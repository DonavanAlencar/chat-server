import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { getEnvironmentConfig } from '../config/environment';
import { RawApiResponse, PollingResult } from '../types/api';
import { Logger } from '../utils/logger';

/**
 * Serviço responsável por gerenciar chamadas à API externa
 * Implementa retry, timeout, rate limiting e tratamento de erros
 */
export class ApiService {
  private readonly client: AxiosInstance;
  private readonly config = getEnvironmentConfig();
  private readonly logger = new Logger('ApiService');

  constructor() {
    this.client = axios.create({
      baseURL: this.config.API_BASE_URL,
      timeout: this.config.API_TIMEOUT,
      headers: {
        'Authorization': this.config.AUTH_TOKEN,
        'Content-Type': 'application/json',
        'User-Agent': 'ChatServer/1.0.0'
      }
    });

    this.setupInterceptors();
  }

  /**
   * Configura interceptors para logging e tratamento de erros
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        this.logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        this.logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        this.logger.debug(`API Response: ${response.status} ${response.config.url}`);
        return response;
      },
      (error) => {
        this.logger.error('Response interceptor error:', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Busca mensagens da API externa com retry automático
   * @param key Chave para filtrar mensagens
   * @returns Resultado do polling com mensagens processadas
   */
  async fetchMessages(key: string): Promise<PollingResult> {
    const startTime = Date.now();
    
    try {
      // Validação de entrada
      if (!this.isValidKey(key)) {
        throw new Error('Chave inválida fornecida');
      }

      const response = await this.makeRequestWithRetry(key);
      const messages = this.processApiResponse(response.data);
      
      const duration = Date.now() - startTime;
      
      this.logger.info(`Polling successful for key "${key}": ${messages.length} messages in ${duration}ms`);
      
      return {
        success: true,
        messagesProcessed: messages.length,
        timestamp: new Date()
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = this.getErrorMessage(error);
      
      this.logger.error(`Polling failed for key "${key}" after ${duration}ms:`, errorMessage);
      
      return {
        success: false,
        messagesProcessed: 0,
        error: errorMessage,
        timestamp: new Date()
      };
    }
  }

  /**
   * Faz requisição com retry automático
   * @param key Chave para a requisição
   * @returns Resposta da API
   */
  private async makeRequestWithRetry(key: string): Promise<AxiosResponse<RawApiResponse>> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.API_RETRY_ATTEMPTS; attempt++) {
      try {
        const url = `?key=${encodeURIComponent(key)}`;
        return await this.client.get<RawApiResponse>(url);
        
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.config.API_RETRY_ATTEMPTS) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          this.logger.warn(`API request failed (attempt ${attempt}/${this.config.API_RETRY_ATTEMPTS}), retrying in ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError!;
  }

  /**
   * Processa a resposta da API e extrai as mensagens
   * @param data Dados brutos da API
   * @returns Array de mensagens processadas
   */
  private processApiResponse(data: RawApiResponse): string[] {
    try {
      // Pega dinamicamente a primeira propriedade
      const propertyName = Object.keys(data)[0];
      
      if (!propertyName) {
        this.logger.warn('API response has no properties');
        return [];
      }
      
      const rawMessages = data[propertyName];
      
      if (!Array.isArray(rawMessages)) {
        this.logger.warn('API response property is not an array');
        return [];
      }
      
      // Sanitiza e valida as mensagens
      return rawMessages
        .filter(msg => this.isValidMessage(msg))
        .slice(0, this.config.MAX_MESSAGES_PER_BATCH);
        
    } catch (error) {
      this.logger.error('Error processing API response:', error);
      return [];
    }
  }

  /**
   * Valida se uma chave é válida
   * @param key Chave a ser validada
   * @returns true se a chave for válida
   */
  private isValidKey(key: string): boolean {
    return typeof key === 'string' && 
           key.length > 0 && 
           key.length <= 100 &&
           /^[a-zA-Z0-9_-]+$/.test(key);
  }

  /**
   * Valida se uma mensagem é válida
   * @param message Mensagem a ser validada
   * @returns true se a mensagem for válida
   */
  private isValidMessage(message: string): boolean {
    return typeof message === 'string' && 
           message.length > 0 && 
           message.length <= 10000;
  }

  /**
   * Extrai mensagem de erro de forma segura
   * @param error Erro a ser processado
   * @returns Mensagem de erro
   */
  private getErrorMessage(error: any): string {
    if (error?.response?.status) {
      return `HTTP ${error.response.status}: ${error.response.statusText}`;
    }
    
    if (error?.code === 'ECONNABORTED') {
      return 'Timeout na requisição';
    }
    
    if (error?.code === 'ENOTFOUND') {
      return 'Servidor não encontrado';
    }
    
    return error?.message || 'Erro desconhecido';
  }

  /**
   * Aguarda um tempo específico
   * @param ms Milissegundos para aguardar
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Testa a conectividade com a API
   * @returns true se a API estiver acessível
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('?key=test');
      return true;
    } catch (error) {
      this.logger.error('API connection test failed:', error);
      return false;
    }
  }
} 