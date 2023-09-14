import { FastifyInstance, FastifyPluginAsync } from "fastify"
import { ZodRawShape, z } from 'zod'
import { Endpoint, HookParent, OperationExecutionEngine, OperationType } from "./types/server";
import { replaceUrl } from "./utils";
import { zodToJsonSchema } from 'zod-to-json-schema'
import { JsonSchema7ObjectType } from 'zod-to-json-schema/src/parsers/object'
import { JsonSchema7Type } from 'zod-to-json-schema/src/parseDef'
import { BaseReuqestContext, Request } from "./types";
import { Readable } from "node:stream";
import { saveOperationConfig } from "./operation.json";

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

let functionNameList: string[]

export async function registerFunctionHandler(path: string, config: FunctionConfig) {
  const routeUrl = replaceUrl(Endpoint.Function, { path })
  const operationType = config.operationType || OperationType.QUERY
  const inputSchema = config.input instanceof z.ZodObject ? zodToJsonSchema(config.input) : config.input
  const responseSchema = config.response instanceof z.Schema ? zodToJsonSchema(config.response) : config.input

  fastify.post(routeUrl, {
    config: { kind: 'function', functionPath: path },
    schema: { body: inputSchema }
  }, async (req, reply) => {
    const request = {
      body: req.body,
      headers: req.headers,
      method: req.method,
      query: req.query,
    };
    reply.type('application/json');
    if (operationType === OperationType.QUERY || operationType === OperationType.MUTATION) {
      try {
        const data = await config.handler(request, req.ctx)
        reply.code(200).send({ response: { data } })
      } catch (error) {
        reply.code(500).send({ response: { error } })
      }
    } else {
      const subscribeOnce = req.headers['x-wg-subscribe-once'] === 'true';

      const readableStream = new Readable();
      readableStream._read = () => { };
      reply.send(readableStream);
      try {
        const gen = config.handler(request, req.ctx) as AsyncGenerator<object>;

        for await (const next of gen) {
          readableStream.push(`${JSON.stringify({ data: next })}\n\n`);
          if (subscribeOnce) {
            readableStream.push(null)
            break
          }
        }
      } catch (error) {
        readableStream.push(`${JSON.stringify({ error })}`)
      }
      readableStream.destroy()

      return reply;
    }
  })

  saveOperationConfig(HookParent.Function, path, {
    engine: OperationExecutionEngine.ENGINE_PROXY,
    variablesSchema: JSON.stringify(inputSchema),
    responseSchema: JSON.stringify(responseSchema)
  })
  functionNameList.push(path)
}

export const FireboomFunctionsPlugin: FastifyPluginAsync = async (_fastify) => {
  fastify = _fastify
  functionNameList = []
}

export function getFunctionNameList() {
  return functionNameList
}