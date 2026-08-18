export interface Context {
  effect(fn: () => (() => void) | void, label?: string): () => void
  on(event: string, listener: (...args: unknown[]) => void): () => void
  inject(deps: readonly string[], callback: (ctx: Context) => void): () => void
  get<T = unknown>(name: string): T | undefined
  logger: {
    info(message: unknown, ...rest: unknown[]): void
    warn(message: unknown, ...rest: unknown[]): void
    error(message: unknown, ...rest: unknown[]): void
  }
  webServer: WebServer
  settings?: unknown
  systemPrompt?: {
    section(section: { name: string; order: number; text: string }): () => void
  }
}

export interface WebRoute {
  kind: 'exact' | 'prefix'
  path: string
  handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
}

export interface WebUpgradeRoute {
  path: string
  handler: (req: IncomingMessage, socket: Duplex, head: Buffer) => void | Promise<void>
}

export interface WebServer {
  host: string
  port: number
  register(route: WebRoute): () => void
  registerUpgrade(route: WebUpgradeRoute): () => void
}

export interface IncomingMessage {
  method?: string
  url?: string
  headers: Record<string, string | string[] | undefined>
  socket: { remoteAddress?: string }
  on(event: 'data', listener: (chunk: Buffer | string) => void): this
  on(event: 'end', listener: () => void): this
  on(event: 'error', listener: (err: Error) => void): this
}

export interface ServerResponse {
  statusCode: number
  headersSent: boolean
  setHeader(name: string, value: string | readonly string[]): this
  writeHead(status: number, headers?: Record<string, string | number | readonly string[]>): this
  end(chunk?: string | Buffer): this
}

export interface Duplex {
  write(chunk: string | Buffer): boolean
  end(chunk?: string | Buffer): this
  destroy(error?: Error): this
  on(event: string, listener: (...args: unknown[]) => void): this
  once(event: string, listener: (...args: unknown[]) => void): this
  off(event: string, listener: (...args: unknown[]) => void): this
}

export class Service {
  constructor(_ctx: Context, _name: string) {}
}
