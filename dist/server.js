"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// chat-server/src/server.ts
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const axios_1 = __importDefault(require("axios"));
const app = (0, express_1.default)();
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: { origin: '*' }
});
// endpoint base da Z-API
const BASE = 'https://n8n.546digitalservices.com/webhook/get_message_redis';
// seu token de autorização
const AUTH_TOKEN = 'eDmfkq$N^t0*NAPAfU$WaFXNE3*^ewqj!8Pop&DZ4F6CZPgG5!7f@Q44e%ZJYG6TxyKQOSgiumI3t';
io.on('connection', socket => {
    console.log('📱 Cliente conectado:', socket.id);
    let lastIndex = 0; // índice do último mensagem enviado
    let intervalId;
    // aguarda o cliente enviar a KEY
    socket.on('startPolling', async ({ key }) => {
        console.log(`🔑 Iniciando polling para chave "${key}"`);
        // dispara uma vez imediatamente
        await fetchAndEmit(key);
        // dispara polling a cada 3s
        intervalId = setInterval(() => fetchAndEmit(key), 3000);
    });
    // função genérica de polling + parse + emit
    async function fetchAndEmit(key) {
        try {
            const url = `${BASE}?key=${key}`;
            const res = await axios_1.default.get(url, {
                headers: { Authorization: AUTH_TOKEN }
            });
            const data = res.data;
            // pega dinamicamente a primeira propriedade (ex: "propertyName")
            const propName = Object.keys(data)[0];
            const rawMsgs = data[propName] || [];
            // envia só as novas mensagens
            while (lastIndex < rawMsgs.length) {
                const parsedMsg = JSON.parse(rawMsgs[lastIndex]);
                socket.emit('new_message', parsedMsg);
                lastIndex++;
            }
        }
        catch (err) {
            console.error('❌ Erro no polling:', err.message);
        }
    }
    socket.on('disconnect', () => {
        console.log('❌ Cliente desconectou:', socket.id);
        clearInterval(intervalId);
    });
});
const PORT = 4000;
server.listen(PORT, () => {
    console.log(`🔌 WS server rodando em ${BASE}:${PORT}`);
});
