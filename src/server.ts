/**
 * Chat Server - Servidor WebSocket com polling condicional
 * 
 * Funcionalidades:
 * - WebSocket server com Socket.IO
 * - Polling condicional da API (só quando há clientes conectados)
 * - Suporte a múltiplos clientes simultâneos
 * - Controle individual de polling por cliente
 * - Segurança e validação de entrada
 * - Logging estruturado
 * - Configuração flexível
 * 
 * @author Chat Server Team
 * @version 2.0.0
 */

import express from 'express'
import http from 'http'
import { Server as IOServer, Socket } from 'socket.io'
import axios from 'axios'
import { getEnvironmentConfig } from './config/environment'
import { ApiService } from './services/api.service'
import { PollingService } from './services/polling.service'
import { SecurityMiddleware } from './middleware/security.middleware'
import { Logger } from './utils/logger'
import { WebSocketEvents, StartPollingRequest, ProcessedMessage } from './types/api'

/**
 * Classe principal do servidor
 * Gerencia conexões WebSocket e polling da API
 */
export class ChatServer {
  private readonly app: express.Application
  private readonly server: http.Server
  private readonly io: IOServer
  private readonly config = getEnvironmentConfig()
  private readonly logger = new Logger('ChatServer')
  private readonly apiService: ApiService
  private readonly pollingService: PollingService
  private readonly securityMiddleware: SecurityMiddleware
  private readonly sockets = new Map<string, Socket>()
  private isShuttingDown = false

  constructor() {
    this.app = express()
    this.server = http.createServer(this.app)
    this.io = new IOServer(this.server, {
      cors: {
        origin: this.config.CORS_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true
      },
      pingTimeout: this.config.PING_TIMEOUT,
      pingInterval: this.config.PING_INTERVAL,
      transports: ['websocket', 'polling']
    })

    // Inicializa serviços
    this.apiService = new ApiService()
    this.pollingService = new PollingService()
    this.securityMiddleware = new SecurityMiddleware()

    this.setupMiddleware()
    this.setupRoutes()
    this.setupWebSocketHandlers()
    this.setupGracefulShutdown()
  }

  /**
   * Configura middleware da aplicação
   */
  private setupMiddleware(): void {
    // Middleware de segurança
    this.app.use(this.securityMiddleware.securityHeaders.bind(this.securityMiddleware))
    this.app.use(this.securityMiddleware.rateLimit.bind(this.securityMiddleware))

    // Middleware de parsing
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }))

    // Middleware de logging
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path} - ${req.ip}`)
      next()
    })
  }

  /**
   * Configura rotas HTTP
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: this.config.NODE_ENV,
        version: '2.0.0'
      })
    })

    // Status da aplicação
    this.app.get('/status', (req, res) => {
      const stats = this.pollingService.getClientStats()
      res.json({
        clients: stats,
        server: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        }
      })
    })

    // Rota padrão
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Chat Server',
        version: '2.0.0',
        description: 'WebSocket server com polling condicional da API',
        endpoints: {
          websocket: '/socket.io',
          health: '/health',
          status: '/status'
        }
      })
    })

    // Tratamento de rotas não encontradas
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `Route ${req.method} ${req.originalUrl} not found`
      })
    })

    // Tratamento de erros
    this.app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      this.logger.error('HTTP Error:', error)
      res.status(500).json({
        error: 'Internal Server Error',
        message: this.config.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      })
    })
  }

  /**
   * Configura handlers do WebSocket
   */
  private setupWebSocketHandlers(): void {
    // Middleware de autenticação WebSocket
    this.io.use((socket, next) => {
      try {
        // Validação básica de origem
        const origin = socket.handshake.headers.origin
        if (origin && !this.securityMiddleware.validateCors(origin)) {
          return next(new Error('CORS not allowed'))
        }

        // Log de conexão
        this.logger.info(`Nova conexão WebSocket: ${socket.id} from ${socket.handshake.address}`)
        next()
      } catch (error) {
        this.logger.error('WebSocket middleware error:', error)
        next(new Error('Authentication failed'))
      }
    })

    // Handler de conexão
    this.io.on(WebSocketEvents.CONNECTION, (socket: Socket) => {
      this.handleConnection(socket)
    })
  }

  /**
   * Gerencia nova conexão WebSocket
   * @param socket Socket do cliente
   */
  private handleConnection(socket: Socket): void {
    try {
      // Armazena referência do socket
      this.sockets.set(socket.id, socket)

      // Log de conexão
      this.logger.info(`📱 Cliente conectado: ${socket.id}`)

      // Handler para iniciar polling
      socket.on(WebSocketEvents.START_POLLING, async (data: StartPollingRequest) => {
        await this.handleStartPolling(socket, data)
      })

      // Handler para ping/pong
      socket.on(WebSocketEvents.PING, () => {
        socket.emit(WebSocketEvents.PONG, { timestamp: Date.now() })
      })

      // Handler de desconexão
      socket.on(WebSocketEvents.DISCONNECT, (reason: string) => {
        this.handleDisconnection(socket, reason)
      })

      // Handler de erro
      socket.on('error', (error: Error) => {
        this.logger.error(`WebSocket error for ${socket.id}:`, error)
      })

      // Envia confirmação de conexão
      socket.emit('connected', {
        id: socket.id,
        timestamp: new Date().toISOString(),
        config: {
          pollingInterval: this.config.POLLING_INTERVAL,
          maxMessagesPerBatch: this.config.MAX_MESSAGES_PER_BATCH
        }
      })

    } catch (error) {
      this.logger.error(`Error handling connection for ${socket.id}:`, error)
      socket.disconnect(true)
    }
  }

  /**
   * Gerencia início de polling
   * @param socket Socket do cliente
   * @param data Dados de início de polling
   */
  private async handleStartPolling(socket: Socket, data: StartPollingRequest): Promise<void> {
    try {
      // Validação e sanitização de entrada
      const sanitizedData = this.securityMiddleware.sanitizeInput(data)
      
      if (!this.securityMiddleware.validateWebSocketInput(socket, sanitizedData)) {
        return
      }

      const { key } = sanitizedData

      this.logger.info(`🔑 Iniciando polling para cliente ${socket.id} com chave "${key}"`)

      // Inicia polling
      await this.pollingService.startPolling(socket, key)

      // Confirma início do polling
      socket.emit('polling_started', {
        key,
        timestamp: new Date().toISOString(),
        interval: this.config.POLLING_INTERVAL
      })

    } catch (error) {
      this.logger.error(`Erro ao iniciar polling para ${socket.id}:`, error)
      socket.emit('error', {
        message: 'Erro ao iniciar polling',
        details: error instanceof Error ? error.message : 'Erro desconhecido',
        timestamp: new Date().toISOString()
      })
    }
  }

  /**
   * Gerencia desconexão de cliente
   * @param socket Socket do cliente
   * @param reason Razão da desconexão
   */
  private handleDisconnection(socket: Socket, reason: string): void {
    try {
      this.logger.info(`❌ Cliente desconectou: ${socket.id} (${reason})`)

      // Para polling do cliente
      this.pollingService.stopPolling(socket.id)

      // Remove referência do socket
      this.sockets.delete(socket.id)

      // Log de estatísticas
      const stats = this.pollingService.getClientStats()
      this.logger.info(`Estatísticas após desconexão: ${JSON.stringify(stats)}`)

    } catch (error) {
      this.logger.error(`Erro ao processar desconexão de ${socket.id}:`, error)
    }
  }

  /**
   * Configura shutdown graceful
   */
  private setupGracefulShutdown(): void {
    const shutdown = (signal: string) => {
      if (this.isShuttingDown) return
      
      this.isShuttingDown = true
      this.logger.info(`Recebido sinal ${signal}, iniciando shutdown graceful...`)

      // Para de aceitar novas conexões
      this.server.close(() => {
        this.logger.info('Servidor HTTP fechado')
      })

      // Desconecta todos os clientes WebSocket
      this.io.close(() => {
        this.logger.info('Servidor WebSocket fechado')
      })

      // Limpa recursos de polling
      this.pollingService.cleanup()

      // Aguarda um tempo para conexões existentes terminarem
      setTimeout(() => {
        this.logger.info('Shutdown graceful concluído')
        process.exit(0)
      }, 5000)
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
  }

  /**
   * Inicia o servidor
   */
  async start(): Promise<void> {
    try {
      // Testa conectividade com a API
      const apiConnected = await this.apiService.testConnection()
      if (!apiConnected) {
        this.logger.warn('API externa não está acessível')
      }

      // Inicia o servidor
      this.server.listen(this.config.PORT, () => {
        this.logger.info(`🔌 Chat Server rodando na porta ${this.config.PORT}`)
        this.logger.info(`📊 Ambiente: ${this.config.NODE_ENV}`)
        this.logger.info(`🌐 CORS Origin: ${this.config.CORS_ORIGIN}`)
        this.logger.info(`⏱️  Polling Interval: ${this.config.POLLING_INTERVAL}ms`)
        this.logger.info(`🔗 WebSocket: ws://localhost:${this.config.PORT}`)
        this.logger.info(`📈 Health Check: http://localhost:${this.config.PORT}/health`)
      })

    } catch (error) {
      this.logger.error('Erro ao iniciar servidor:', error)
      process.exit(1)
    }
  }

  /**
   * Para o servidor
   */
  async stop(): Promise<void> {
    this.logger.info('Parando servidor...')
    this.server.close()
    this.io.close()
    this.pollingService.cleanup()
  }
}

// Inicialização da aplicação
if (require.main === module) {
  const server = new ChatServer()
  server.start().catch(error => {
    console.error('Erro fatal ao iniciar servidor:', error)
    process.exit(1)
  })
}