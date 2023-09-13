import 'dotenv/config'

import closeWithGrace from 'close-with-grace'
import Fastify from 'fastify'
import { glob } from 'fast-glob'
import { resolve } from 'node:path'
import { Client } from '@fireboom/client'

import logger from './logger'
import { HookServerConfiguration } from './hook.config'
import { FBFastifyRequest, FireboomHooksPlugun, HooksRouteConfig } from './hooks'
import { BaseRequestBody } from './types/server'
import { FireboomHealthPlugun } from './health'

export async function startServer(config: HookServerConfiguration, operationsClient: Client) {
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

  fastify.decorateRequest('ctx', null);

  // health
  fastify.register(FireboomHealthPlugun)

  fastify.addHook('onRoute', (routeOptions) => {
    const routeConfig = routeOptions.config as HooksRouteConfig | undefined;
    if (routeConfig?.kind === 'hook') {
      if (routeConfig.operationName) {
        fastify.log.debug(
          `Registered Operation Hook '${routeConfig.operationName}' with (${routeOptions.method}) '${routeOptions.url}'`
        );
      } else {
        fastify.log.debug(`Registered Global Hook (${routeOptions.method}) '${routeOptions.url}'`);
      }
    }
  });

  await fastify.register(async fastify => {
    fastify.addHook<FBFastifyRequest<BaseRequestBody, any>>('preHandler', async (req, reply) => {
      // @ts-ignore
      req.ctx = {
        logger,
        user: req.body.__wg.user!,
        clientRequest: req.body.__wg.clientRequest,
        operationsClient: operationsClient
      };
    });

    // hooks
    await fastify.register(FireboomHooksPlugun)

    // auto require all hook functions
    const entries = await glob(resolve(__dirname, `./{customize,global,operation,storage,proxy}/**/*.${process.env.NODE_ENV === 'production' ? 'js' : 'ts'}`))
    for (const entry of entries) {
      require(entry)
    }
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
