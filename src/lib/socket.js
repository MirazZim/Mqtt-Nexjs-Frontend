"use client";

import { io } from 'socket.io-client';
import API_BASE_URL from '../config/api.js';

const SOCKET_URL = `${API_BASE_URL}`;

export const createSocket = (token) => {
    const socket = io(SOCKET_URL, {
        auth: { token },
        // allow upgrade instead of forcing polling
        transports: ['websocket', 'polling'], // try WebSocket first, then fallback [5]
        autoConnect: true,
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 10, // or remove to use unlimited default [7]
        timeout: 30000, // give initial handshake more time [1]
    });

    socket.on('connect', () => {
        console.log('🔌 Socket.IO connected:', socket.id);
        console.log('transport:', socket.io.engine.transport.name); // 'polling' initially [1]
        socket.io.engine.on('upgrade', () => {
            console.log('upgraded transport:', socket.io.engine.transport.name); // 'websocket' when upgraded [1]
        });
    });

    socket.on('disconnect', (reason) => {
        console.log('🔌 Socket.IO disconnected:', reason); // 'ping timeout' or 'transport close' [7]
    });

    socket.on('connect_error', (error) => {
        console.error('🔌 Socket.IO connection error:', error);
    });

    return socket;
};
