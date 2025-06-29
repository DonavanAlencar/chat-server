import { Socket } from 'socket.io';
import { getEnvironmentConfig } from '../config/environment';
import { ApiService } from './api.service';
import { Logger } from '../utils/logger';
import { PollingConfig, PollingResult, ProcessedMessage, ClientInfo, ConnectionStatus } from '../types/api';

/**
 * Serviço responsável por gerenciar polling de mensagens
 * Implementa controle de estado, performance e tratamento de erros
 */
export class PollingService {
  private readonly config = getEnvironmentConfig();
  private readonly logger = new Logger('PollingService');
  private readonly apiService: ApiService;
  private readonly clients = new Map<string, ClientInfo>();
  private readonly pollingConfigs = new Map<string, PollingConfig>();
  private readonly intervals = new Map<string, NodeJS.Timeout>();

  constructor() {
    this.apiService = new ApiService();
  }

  /**
   * Inicia polling para um cliente específico
   * @param socket Socket do cliente
   * @param key Chave para filtrar mensagens
   */
  async startPolling(socket: Socket, key: string): Promise<void> {
    const clientId = socket.id;
    
    try {
      // Validação de entrada
      if (!this.isValidKey(key)) {
        throw new Error('Chave inválida fornecida');
      }

      // Verifica se o cliente já está fazendo polling
      if (this.isClientPolling(clientId)) {
        this.logger.warn(`Cliente ${clientId} já está fazendo polling`);
        return;
      }

      // Configura o cliente
      this.setupClient(clientId, key);
      
      // Executa polling imediato
      await this.executePolling(clientId, key);
      
      // Configura polling periódico
      this.setupPeriodicPolling(clientId, key);
      
      this.logger.info(`Polling iniciado para cliente ${clientId} com chave "${key}"`);
      
    } catch (error) {
      this.logger.error(`Erro ao iniciar polling para cliente ${clientId}:`, error);
      this.cleanupClient(clientId);
      throw error;
    }
  }

  /**
   * Para polling de um cliente específico
   * @param clientId ID do cliente
   */
  stopPolling(clientId: string): void {
    try {
      const interval = this.intervals.get(clientId);
      if (interval) {
        clearInterval(interval);
        this.intervals.delete(clientId);
      }

      this.cleanupClient(clientId);
      this.logger.info(`Polling parado para cliente ${clientId}`);
      
    } catch (error) {
      this.logger.error(`Erro ao parar polling para cliente ${clientId}:`, error);
    }
  }

  /**
   * Executa uma rodada de polling
   * @param clientId ID do cliente
   * @param key Chave para filtrar mensagens
   */
  private async executePolling(clientId: string, key: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await this.apiService.fetchMessages(key);
      
      if (result.success) {
        await this.processMessages(clientId, key, result);
        this.updateClientActivity(clientId);
        this.resetErrorCount(clientId);
        
        const duration = Date.now() - startTime;
        this.logger.debug(`Polling executado para ${clientId} em ${duration}ms`);
        
      } else {
        this.handlePollingError(clientId, result.error || 'Erro desconhecido');
      }
      
    } catch (error) {
      this.handlePollingError(clientId, error);
    }
  }

  /**
   * Processa mensagens recebidas da API
   * @param clientId ID do cliente
   * @param key Chave de polling
   * @param result Resultado do polling
   */
  private async processMessages(clientId: string, key: string, result: PollingResult): Promise<void> {
    const config = this.pollingConfigs.get(clientId);
    if (!config) return;

    try {
      // Busca mensagens da API
      const apiResult = await this.apiService.fetchMessages(key);
      
      if (apiResult.success && apiResult.messagesProcessed > 0) {
        // Processa e envia mensagens para o cliente
        const socket = this.getSocketById(clientId);
        if (socket) {
          // Aqui você implementaria a lógica de processamento das mensagens
          // Por enquanto, apenas incrementa o contador
          this.incrementMessageCount(clientId, apiResult.messagesProcessed);
        }
      }
      
    } catch (error) {
      this.logger.error(`Erro ao processar mensagens para ${clientId}:`, error);
    }
  }

  /**
   * Configura polling periódico para um cliente
   * @param clientId ID do cliente
   * @param key Chave de polling
   */
  private setupPeriodicPolling(clientId: string, key: string): void {
    const interval = setInterval(async () => {
      try {
        await this.executePolling(clientId, key);
      } catch (error) {
        this.logger.error(`Erro no polling periódico para ${clientId}:`, error);
      }
    }, this.config.POLLING_INTERVAL);

    this.intervals.set(clientId, interval);
  }

  /**
   * Configura informações do cliente
   * @param clientId ID do cliente
   * @param key Chave de polling
   */
  private setupClient(clientId: string, key: string): void {
    const clientInfo: ClientInfo = {
      id: clientId,
      status: ConnectionStatus.POLLING,
      connectedAt: new Date(),
      lastActivity: new Date(),
      pollingKey: key,
      messageCount: 0
    };

    const pollingConfig: PollingConfig = {
      key,
      interval: this.config.POLLING_INTERVAL,
      lastIndex: 0,
      isActive: true,
      lastPollTime: new Date(),
      errorCount: 0
    };

    this.clients.set(clientId, clientInfo);
    this.pollingConfigs.set(clientId, pollingConfig);
  }

  /**
   * Limpa recursos de um cliente
   * @param clientId ID do cliente
   */
  private cleanupClient(clientId: string): void {
    this.clients.delete(clientId);
    this.pollingConfigs.delete(clientId);
    this.intervals.delete(clientId);
  }

  /**
   * Atualiza atividade do cliente
   * @param clientId ID do cliente
   */
  private updateClientActivity(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastActivity = new Date();
    }
  }

  /**
   * Incrementa contador de mensagens
   * @param clientId ID do cliente
   * @param count Quantidade a incrementar
   */
  private incrementMessageCount(clientId: string, count: number): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.messageCount += count;
    }
  }

  /**
   * Reseta contador de erros
   * @param clientId ID do cliente
   */
  private resetErrorCount(clientId: string): void {
    const config = this.pollingConfigs.get(clientId);
    if (config) {
      config.errorCount = 0;
    }
  }

  /**
   * Trata erros de polling
   * @param clientId ID do cliente
   * @param error Erro ocorrido
   */
  private handlePollingError(clientId: string, error: any): void {
    const config = this.pollingConfigs.get(clientId);
    if (config) {
      config.errorCount++;
      
      // Para polling se houver muitos erros consecutivos
      if (config.errorCount >= 5) {
        this.logger.error(`Muitos erros consecutivos para ${clientId}, parando polling`);
        this.stopPolling(clientId);
      }
    }
    
    this.logger.error(`Erro de polling para ${clientId}:`, error);
  }

  /**
   * Verifica se um cliente está fazendo polling
   * @param clientId ID do cliente
   * @returns true se estiver fazendo polling
   */
  private isClientPolling(clientId: string): boolean {
    return this.intervals.has(clientId);
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
   * Obtém socket por ID (implementação simplificada)
   * @param clientId ID do cliente
   * @returns Socket ou null
   */
  private getSocketById(clientId: string): Socket | null {
    // Esta é uma implementação simplificada
    // Em uma implementação real, você precisaria manter uma referência aos sockets
    return null;
  }

  /**
   * Obtém estatísticas de clientes ativos
   * @returns Estatísticas dos clientes
   */
  getClientStats(): { total: number; active: number; polling: number } {
    const total = this.clients.size;
    const active = Array.from(this.clients.values()).filter(c => 
      c.status === ConnectionStatus.POLLING
    ).length;
    const polling = this.intervals.size;

    return { total, active, polling };
  }

  /**
   * Limpa todos os recursos (útil para shutdown)
   */
  cleanup(): void {
    for (const [clientId] of this.intervals) {
      this.stopPolling(clientId);
    }
    
    this.clients.clear();
    this.pollingConfigs.clear();
    this.intervals.clear();
    
    this.logger.info('PollingService cleanup completed');
  }
} 