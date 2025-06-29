# Arquitetura do Chat Server

## Visão Geral

O Chat Server é uma aplicação Node.js que implementa um servidor WebSocket com polling condicional de uma API externa. A aplicação foi projetada seguindo princípios de Clean Architecture, SOLID e boas práticas de desenvolvimento.

## Arquitetura de Alto Nível

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   WebSocket     │    │   HTTP Server   │    │   External API  │
│   Clients       │◄──►│   (Express)     │◄──►│   (n8n)         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   Core Services │
                       │   & Middleware  │
                       └─────────────────┘
```

## Estrutura de Diretórios

```
src/
├── config/           # Configurações da aplicação
│   └── environment.ts
├── services/         # Lógica de negócio
│   ├── api.service.ts
│   └── polling.service.ts
├── middleware/       # Middleware de segurança
│   └── security.middleware.ts
├── types/           # Definições de tipos TypeScript
│   └── api.ts
├── utils/           # Utilitários
│   └── logger.ts
└── server.ts        # Ponto de entrada da aplicação
```

## Componentes Principais

### 1. ChatServer (Classe Principal)
- **Responsabilidade**: Orquestração geral da aplicação
- **Padrão**: Singleton/Factory
- **Funcionalidades**:
  - Inicialização de serviços
  - Configuração de middleware
  - Gerenciamento de ciclo de vida
  - Graceful shutdown

### 2. ApiService
- **Responsabilidade**: Comunicação com API externa
- **Padrão**: Service Layer
- **Funcionalidades**:
  - HTTP client com retry automático
  - Timeout e rate limiting
  - Sanitização de dados
  - Tratamento de erros

### 3. PollingService
- **Responsabilidade**: Gerenciamento de polling
- **Padrão**: State Manager
- **Funcionalidades**:
  - Controle de estado por cliente
  - Polling condicional
  - Performance monitoring
  - Cleanup automático

### 4. SecurityMiddleware
- **Responsabilidade**: Segurança e validação
- **Padrão**: Middleware Chain
- **Funcionalidades**:
  - Rate limiting
  - Validação de entrada
  - Sanitização de dados
  - Headers de segurança

### 5. Logger
- **Responsabilidade**: Logging estruturado
- **Padrão**: Strategy
- **Funcionalidades**:
  - Níveis de log configuráveis
  - Formatação estruturada
  - Sanitização de dados sensíveis
  - Cores no console

## Fluxo de Dados

### 1. Conexão de Cliente
```
Cliente WebSocket → ChatServer.handleConnection() → PollingService.setupClient()
```

### 2. Início de Polling
```
Cliente.startPolling() → SecurityMiddleware.validateInput() → PollingService.startPolling() → ApiService.fetchMessages()
```

### 3. Polling Periódico
```
setInterval() → PollingService.executePolling() → ApiService.fetchMessages() → Cliente.new_message
```

### 4. Desconexão
```
Cliente.disconnect() → PollingService.stopPolling() → Cleanup resources
```

## Design Patterns Implementados

### 1. Dependency Injection
- Serviços são injetados na classe principal
- Facilita testes e manutenção

### 2. Observer Pattern
- WebSocket events para comunicação cliente-servidor
- Event-driven architecture

### 3. Strategy Pattern
- Diferentes níveis de logging
- Configurações flexíveis

### 4. Factory Pattern
- Criação de instâncias de serviços
- Configuração centralizada

### 5. Middleware Pattern
- Chain de middleware para processamento de requisições
- Separação de responsabilidades

## Configuração e Ambiente

### Variáveis de Ambiente
```typescript
interface EnvironmentConfig {
  // Server
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  
  // API
  API_BASE_URL: string;
  AUTH_TOKEN: string;
  API_TIMEOUT: number;
  API_RETRY_ATTEMPTS: number;
  
  // WebSocket
  CORS_ORIGIN: string;
  PING_TIMEOUT: number;
  PING_INTERVAL: number;
  
  // Polling
  POLLING_INTERVAL: number;
  MAX_MESSAGES_PER_BATCH: number;
  
  // Security
  RATE_LIMIT_WINDOW: number;
  RATE_LIMIT_MAX_REQUESTS: number;
}
```

## Segurança

### 1. Validação de Entrada
- Sanitização de strings
- Validação de tipos
- Limitação de tamanho

### 2. Rate Limiting
- Controle por IP
- Janela de tempo configurável
- Limite de requisições

### 3. Headers de Segurança
- X-Frame-Options
- X-Content-Type-Options
- Content-Security-Policy
- X-XSS-Protection

### 4. CORS
- Configuração flexível
- Validação de origem
- Credenciais seguras

## Performance

### 1. Polling Condicional
- Só executa quando há clientes conectados
- Controle individual por cliente
- Cleanup automático

### 2. Retry com Exponential Backoff
- Tentativas configuráveis
- Delay exponencial
- Fallback graceful

### 3. Memory Management
- Limpeza automática de recursos
- Garbage collection otimizado
- Monitoramento de memória

### 4. Connection Pooling
- Reutilização de conexões HTTP
- Timeout configurável
- Keep-alive

## Monitoramento e Observabilidade

### 1. Logging Estruturado
- Níveis configuráveis
- Contexto por componente
- Timestamps ISO

### 2. Health Checks
- Endpoint `/health`
- Status da aplicação
- Métricas básicas

### 3. Métricas
- Número de clientes ativos
- Taxa de erro
- Tempo de resposta
- Uso de recursos

### 4. Error Handling
- Try-catch em todas as operações assíncronas
- Logging detalhado de erros
- Graceful degradation

## Testes

### Estrutura Recomendada
```
tests/
├── unit/           # Testes unitários
├── integration/    # Testes de integração
├── e2e/           # Testes end-to-end
└── fixtures/      # Dados de teste
```

### Cobertura
- Serviços: 90%+
- Middleware: 85%+
- Utilitários: 95%+

## Deploy e DevOps

### 1. Containerização
- Dockerfile otimizado
- Multi-stage build
- Alpine Linux base

### 2. Orquestração
- Docker Compose
- Health checks
- Restart policies

### 3. CI/CD
- Build automatizado
- Testes automatizados
- Deploy em múltiplos ambientes

## Escalabilidade

### 1. Horizontal Scaling
- Stateless design
- Load balancing ready
- Session management

### 2. Vertical Scaling
- Memory optimization
- CPU optimization
- Connection pooling

### 3. Caching
- Redis para sessões
- In-memory para polling state
- CDN para assets

## Manutenibilidade

### 1. Código Limpo
- Nomes descritivos
- Funções pequenas
- Responsabilidade única

### 2. Documentação
- JSDoc em todas as funções
- README atualizado
- Arquitetura documentada

### 3. Versionamento
- Semantic versioning
- Changelog mantido
- Tags de release

## Roadmap

### Versão 2.1
- [ ] Métricas com Prometheus
- [ ] Tracing com Jaeger
- [ ] Cache distribuído

### Versão 2.2
- [ ] Autenticação JWT
- [ ] Rate limiting por usuário
- [ ] Webhook notifications

### Versão 3.0
- [ ] Microservices architecture
- [ ] Event sourcing
- [ ] CQRS pattern 