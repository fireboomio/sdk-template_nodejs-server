import 'dotenv/config'

// import { Headers } from '@whatwg-node/fetch'
import closeWithGrace from 'close-with-grace'
import Fastify from 'fastify'

// import { type FireboomConfiguration, resolveConfigurationVariable } from './configuration'
import logger from './logger'
import { HookServerConfiguration } from './hook.config'
// import { FastifyRequestBody } from './types/types'


export async function startServer(config: HookServerConfiguration) {
  logger.level = config.logLevel || 'info'
  let id = 0
  const fastify = Fastify({
    logger,
    disableRequestLogging: true,
    genReqId: req => {
      if (req.headers['x-request-id']) {
        return req.headers['x-request-id']?.toString()
      }
      return `${++id}`
    }
  })

  fastify.addHook('onRequest', (req, _reply, done) => {
    req.log.debug({ req }, 'received request')
    done()
  })

  fastify.addHook('onResponse', (req, reply, done) => {
    req.log.debug(
      { res: reply, url: req.raw.url, responseTime: reply.getResponseTime() },
      'request completed'
    )
    done()
  })

  await fastify.register(async _fastify => {
    //
  })

  // graceful shutdown
  closeWithGrace({ delay: 500 }, async ({ err }) => {
    if (err) {
      logger.error('Error when graceful shutdown Fireboom hook server', err)
    }
    await fastify.close()
    logger.info('Fireboom hook server is closed')
  })

  // start listen
  fastify.listen(config.listen, (err, address) => {
      if (err) {
        logger.error('Error when start Fireboom hook server', err)
      } else {
        logger.info(`Fireboom hook server is listening on: ${address}`)
      }
    }
  )
}

// /**
//  * createClientRequest returns a decoded client request, used for passing it to user code
//  * @param body Request body
//  * @returns Decoded client request
//  */
// export const createClientRequest = (body: FastifyRequestBody) => {
//   // clientRequest represents the original client request that was sent initially to the WunderNode.
//   const raw = rawClientRequest(body)
//   return {
//     headers: new Headers(raw?.headers),
//     requestURI: raw?.requestURI || '',
//     method: raw?.method || 'GET'
//   }
// }

// /**
//  * rawClientRequest returns the raw JSON encoded client request
//  * @param body Request body
//  * @returns Client request as raw JSON, as received in the request body
//  */
// export const rawClientRequest = (body: FastifyRequestBody) => {
//   return body.__wg.clientRequest
// }
