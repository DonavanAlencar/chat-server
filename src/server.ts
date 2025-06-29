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


let globalInterval: NodeJS.Timeout | null = null
let lastIndex = 0
let currentKey = ''

io.on('connection', socket => {
  console.log('📱 Cliente conectado:', socket.id)

  // espera o cliente enviar a chave para iniciar o polling
  socket.on('startPolling', async ({ key }: { key: string }) => {
    currentKey = key
    console.log(`🔑 Iniciando polling para chave "${key}"`)

    // se ainda não há interval ativo, inicia
    if (!globalInterval) {
      await fetchAndEmit()
      globalInterval = setInterval(fetchAndEmit, 3000)
    }
  })

  socket.on('disconnect', () => {
    console.log('❌ Cliente desconectou:', socket.id)
    // se nenhum cliente permanecer conectado, encerra o polling
    if (io.engine.clientsCount === 0 && globalInterval) {
      clearInterval(globalInterval)
      globalInterval = null
      lastIndex = 0
      currentKey = ''
    }
  })
})

// funcao de polling + parse + broadcast
async function fetchAndEmit() {
  if (!currentKey) return

  try {
    const url = `${BASE}?key=${currentKey}`
    const res = await axios.get<RawResponse>(url, {
      headers: { Authorization: AUTH_TOKEN }
    })
    const data = res.data

    const propName = Object.keys(data)[0]
    const rawMsgs = data[propName] || []

    while (lastIndex < rawMsgs.length) {
      const parsedMsg = JSON.parse(rawMsgs[lastIndex])
      io.emit('new_message', parsedMsg)
      lastIndex++
    }
  } catch (err: any) {
    console.error('❌ Erro no polling:', err.message)
  }
}

const PORT = 4000
server.listen(PORT, () => {
  console.log(`🔌 WS server rodando em ${BASE}:${PORT}`)
})