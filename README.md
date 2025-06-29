# Chat Server

Servidor WebSocket para chat com polling condicional da API.

## Funcionalidades

- WebSocket server com Socket.IO
- Polling condicional da API (só quando há clientes conectados)
- Suporte a múltiplos clientes simultâneos
- Controle individual de polling por cliente

## Pré-requisitos

- Node.js 18+
- npm ou yarn
- Docker (opcional)

## Instalação Local

```bash
# Instalar dependências
npm install

# Executar em desenvolvimento
npm run dev

# Build para produção
npm run build

# Executar em produção
npm start
```

## Deploy com Docker

### Opção 1: Docker Compose (Recomendado)

```bash
# Build e executar
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar
docker-compose down
```

### Opção 2: Docker Build

```bash
# Build da imagem
docker build -t chat-server .

# Executar container
docker run -d -p 4000:4000 --name chat-server chat-server

# Ver logs
docker logs -f chat-server

# Parar e remover
docker stop chat-server && docker rm chat-server
```

## Deploy em Produção

### Heroku

```bash
# Instalar Heroku CLI
# Criar app
heroku create seu-app-name

# Deploy
git push heroku main

# Ver logs
heroku logs --tail
```

### Railway

```bash
# Instalar Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
railway up
```

### Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## Configuração

A aplicação usa as seguintes variáveis de ambiente:

- `PORT`: Porta do servidor (padrão: 4000)
- `NODE_ENV`: Ambiente (development/production)
- `CORS_ORIGIN`: Origem permitida para CORS (padrão: *)

## Endpoints

- **WebSocket**: `ws://localhost:4000`
- **HTTP**: `http://localhost:4000`

## Eventos WebSocket

### Cliente → Servidor
- `startPolling`: Inicia polling com chave específica
  ```javascript
  socket.emit('startPolling', { key: 'sua-chave' })
  ```

### Servidor → Cliente
- `new_message`: Nova mensagem recebida
  ```javascript
  socket.on('new_message', (message) => {
    console.log('Nova mensagem:', message)
  })
  ```

## Monitoramento

A aplicação inclui healthcheck automático quando executada com Docker Compose.
