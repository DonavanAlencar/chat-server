"use strict";
/**
 * Tipos e interfaces para a API
 * Define as estruturas de dados utilizadas na aplicação
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionStatus = exports.WebSocketEvents = void 0;
/**
 * Eventos WebSocket suportados
 */
var WebSocketEvents;
(function (WebSocketEvents) {
    WebSocketEvents["CONNECTION"] = "connection";
    WebSocketEvents["DISCONNECT"] = "disconnect";
    WebSocketEvents["START_POLLING"] = "startPolling";
    WebSocketEvents["NEW_MESSAGE"] = "new_message";
    WebSocketEvents["ERROR"] = "error";
    WebSocketEvents["PING"] = "ping";
    WebSocketEvents["PONG"] = "pong";
})(WebSocketEvents || (exports.WebSocketEvents = WebSocketEvents = {}));
/**
 * Status de conexão do cliente
 */
var ConnectionStatus;
(function (ConnectionStatus) {
    ConnectionStatus["CONNECTED"] = "connected";
    ConnectionStatus["DISCONNECTED"] = "disconnected";
    ConnectionStatus["POLLING"] = "polling";
    ConnectionStatus["IDLE"] = "idle";
})(ConnectionStatus || (exports.ConnectionStatus = ConnectionStatus = {}));
