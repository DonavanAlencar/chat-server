/**
 * Tipos e interfaces para a API
 * Define as estruturas de dados utilizadas na aplicação
 */

/**
 * Resposta bruta da API externa
 */
export interface RawApiResponse {
  [propertyName: string]: string[];
}

/**
 * Mensagem processada enviada para o cliente
 */
export interface ProcessedMessage {
  id: string;
  content: string;
  timestamp: string;
  sender?: string;
  metadata?: Record<string, any>;
}

/**
 * Dados de entrada para iniciar polling
 */
export interface StartPollingRequest {
  key: string;
}

/**
 * Eventos WebSocket suportados
 */
export enum WebSocketEvents {
  CONNECTION = 'connection',
  DISCONNECT = 'disconnect',
  START_POLLING = 'startPolling',
  NEW_MESSAGE = 'new_message',
  ERROR = 'error',
  PING = 'ping',
  PONG = 'pong'
}

/**
 * Status de conexão do cliente
 */
export enum ConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  POLLING = 'polling',
  IDLE = 'idle'
}

/**
 * Informações do cliente conectado
 */
export interface ClientInfo {
  id: string;
  status: ConnectionStatus;
  connectedAt: Date;
  lastActivity: Date;
  pollingKey?: string;
  messageCount: number;
}

/**
 * Configuração de polling para um cliente
 */
export interface PollingConfig {
  key: string;
  interval: number;
  lastIndex: number;
  isActive: boolean;
  lastPollTime?: Date;
  errorCount: number;
}

/**
 * Resultado de uma operação de polling
 */
export interface PollingResult {
  success: boolean;
  messagesProcessed: number;
  error?: string;
  timestamp: Date;
}

/**
 * Estatísticas de performance
 */
export interface PerformanceStats {
  totalConnections: number;
  activeConnections: number;
  totalMessagesProcessed: number;
  averageResponseTime: number;
  errorRate: number;
  uptime: number;
} 