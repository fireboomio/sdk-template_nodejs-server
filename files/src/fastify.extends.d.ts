import fastify from 'fastify'

import { ClientRequest, FireboomUser } from './types'
declare module 'fastify' {
  export interface FastifyRequest {
    ctx: {
      user?: FireboomUser
      clientRequest: ClientRequest
    }
  }
}
