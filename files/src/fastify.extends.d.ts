// import fastify from 'fastify'
import { Logger } from 'pino'
import type { User, WunderGraphRequest } from './types/server'
declare module 'fastify' {
  export interface FastifyRequest {
    ctx: {
      user: User,
      logger: Logger,
      clientRequest: WunderGraphRequest
      operationClient: any
    }
  }
}
