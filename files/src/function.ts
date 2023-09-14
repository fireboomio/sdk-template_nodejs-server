import { FastifyInstance, FastifyPluginAsync } from "fastify"
import { ZodRawShape, z } from 'zod'
import { Endpoint, OperationType } from "./types/server";
import { replaceUrl } from "./utils";
import { JsonSchema7ObjectType } from 'zod-to-json-schema/src/parsers/object'
import { JsonSchema7Type } from 'zod-to-json-schema/src/parseDef'
import { BaseReuqestContext, Request } from "./types";

export type FunctionConfig<T extends ZodRawShape = any> = {
	input?: z.ZodObject<T> | JsonSchema7ObjectType
  response?: z.ZodFirstPartySchemaTypes | JsonSchema7Type
} & ({
  operationType?: OperationType.QUERY | OperationType.MUTATION
  handler: (req: Request, ctx: BaseReuqestContext) => Promise<any>
} | {
  operationType: OperationType.SUBSCRIPTION
  handler: (req: Request, ctx: BaseReuqestContext) => AsyncGenerator<any>
})

let fastify: FastifyInstance

let FunctionNameList: string[]

export async function registerFunctionHandler(path: string, config: FunctionConfig) {
  const routeUrl = replaceUrl(Endpoint.Function, { path })
  const operationType = config.operationType || OperationType.QUERY

  fastify.post(routeUrl, { config: { kind: 'function', functionPath: path } }, async (req, reply) => {
    const request = {
      body: req.body,
      headers: req.headers,
      method: req.method,
      query: req.query,
    };
    if (operationType === OperationType.QUERY || operationType === OperationType.MUTATION) {
      const data = await config.handler(request, req.ctx)
      reply.code(200).send({ response: { data }})
    } else {
      reply.hijack();
      const subscribeOnce = req.headers['x-wg-subscribe-once'] === 'true';
      const gen = config.handler(request, req.ctx) as AsyncGenerator<object>;

      reply.raw.once('close', async () => {
        // call return on the operation's `AsyncGenerator`
        await gen.return(0);
      });

      for await (const next of gen) {
        reply.raw.write(`${JSON.stringify({ data: next })}\n\n`);
        if (subscribeOnce) {
          await gen.return(0);
          return reply.raw.end();
        }
      }

      return reply.raw.end();
    }
  })
  FunctionNameList.push(path)
}

export const FireboomFunctionsPlugin: FastifyPluginAsync = async (_fastify) => {
  fastify = _fastify
  FunctionNameList = []
}

export function getFunctionNameList() {
  return FunctionNameList
}