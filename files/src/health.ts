import { FastifyPluginAsync } from "fastify"
import { Health } from "./types/server"

const startTime = new Date().toISOString()

export const FireboomHealthPlugun: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Reply: Health }>('/health', async (request, reply) => {
    return {
      status: 'ok',
      report: {
        // TODO
        customizes: ['freetalk'],
        functions: ['a/b/c'],
        proxys: ['a/b/c'],
        time: startTime
      }
    }
  })
}