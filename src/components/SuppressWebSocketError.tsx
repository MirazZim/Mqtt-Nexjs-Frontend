'use client';

import { useEffect } from 'react';

export default function SuppressWebSocketError() {
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args) => {
      if (
        typeof args[0] === 'string' &&
        (args[0].includes('websocket error') ||
          args[0].includes('WebSocket') ||
          args[0].includes('[HMR]'))
      ) {
        return; // Suppress WebSocket-related errors
      }
      originalError.apply(console, args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);

  return null;
}
