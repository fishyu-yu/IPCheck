declare module 'cloudflare:sockets' {
  interface Socket {
    opened: Promise<{ remoteAddress: string | null }>;
    closed: Promise<void>;
    close(): Promise<void>;
    readable: ReadableStream<Uint8Array>;
    writable: WritableStream<Uint8Array>;
  }
  export function connect(
    address: { hostname: string; port: number },
    options?: { secureTransport?: 'off' | 'on' | 'starttls' },
  ): Socket;
}
