import { Logger } from 'pino'
import type { User, WunderGraphRequest } from './server'
import { OperationsClient } from '../operations.client'
import { FireboomOperationsDefinition } from '../index'
import { IncomingHttpHeaders } from 'http'

declare module 'fastify' {
  export interface FastifyRequest {
    ctx: BaseReuqestContext
  }
}

export type BaseReuqestContext = {
  user: User,
  logger: Logger,
  clientRequest: WunderGraphRequest
  operationsClient: OperationsClient<FireboomOperationsDefinition>
}

export interface Request {
  body?: any;
  headers: IncomingHttpHeaders;
  method: string;
  query: any;
}