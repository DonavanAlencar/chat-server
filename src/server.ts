// chat-server/src/server.ts
import express from 'express'
import http from 'http'
import { Server as IOServer } from 'socket.io'
import axios from 'axios'

const app = express()
const server = http.createServer(app)
const io = new IOServer(server, {
  cors: { origin: '*' }
})

// endpoint base da Z-API
const BASE = 'https://n8n.546digitalservices.com/webhook/get_message_redis'
// seu token de autorização
const AUTH_TOKEN = 'eDmfkq$N^t0*NAPAfU$WaFXNE3*^ewqj!8Pop&DZ4F6CZPgG5!7f@Q44e%ZJYG6TxyKQOSgiumI3t'

type RawResponse = { [prop: string]: string[] }

io.on('connection', socket => {
  console.log('📱 Cliente conectado:', socket.id)

  let lastIndex = 0          // índice do último mensagem enviado
  let intervalId: NodeJS.Timeout

  // aguarda o cliente enviar a KEY
  socket.on('startPolling', async ({ key }: { key: string }) => {
    console.log(`🔑 Iniciando polling para chave "${key}"`)

    // dispara uma vez imediatamente
    await fetchAndEmit(key)

    // dispara polling a cada 3s
    intervalId = setInterval(() => fetchAndEmit(key), 3000)
  })

  // função genérica de polling + parse + emit
  async function fetchAndEmit(key: string) {
    try {
      const url = `${BASE}?key=${key}`
      const res = await axios.get<RawResponse>(url, {
        headers: { Authorization: AUTH_TOKEN }
      })
      const data = res.data

      // pega dinamicamente a primeira propriedade (ex: "propertyName")
      const propName = Object.keys(data)[0]
      const rawMsgs = data[propName] || []

      // envia só as novas mensagens
      while (lastIndex < rawMsgs.length) {
        const parsedMsg = JSON.parse(rawMsgs[lastIndex])
        socket.emit('new_message', parsedMsg)
        lastIndex++
      }
    } catch (err: any) {
      console.error('❌ Erro no polling:', err.message)
    }
  }

  socket.on('disconnect', () => {
    console.log('❌ Cliente desconectou:', socket.id)
    clearInterval(intervalId)
  })
})

const PORT = 4000
server.listen(PORT, () => {
  console.log(`🔌 WS server rodando em ${BASE}:${PORT}`)
})