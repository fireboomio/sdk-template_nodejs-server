import { Logger } from 'pino'
import type { User, WunderGraphRequest } from './types/server'
import { OperationsClient } from './operations.client'
import { FireboomOperationsDefinition } from './index'

declare module 'fastify' {
  export interface FastifyRequest {
    ctx: {
      user: User,
      logger: Logger,
      clientRequest: WunderGraphRequest
      operationsClient: OperationsClient<FireboomOperationsDefinition>
    }
  }
}
