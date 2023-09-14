import { FastifyInstance, FastifyPluginAsync } from "fastify"

import { GraphQLSchema, printIntrospectionSchema } from 'graphql';
import {
  getGraphQLParameters,
  processRequest,
  renderGraphiQL,
  sendResult,
  shouldRenderGraphiQL,
  type ExecutionContext as HelixExecutionContext,
} from 'graphql-helix';
import { Endpoint, HookParent } from "./types/server";
import { replaceUrl } from "./utils";
import { BaseReuqestContext } from "./types";
import { saveOperationConfig } from "./operation.json";

export interface FireboomExecutionContext {
  fireboomContext: BaseReuqestContext
}

export interface GraphQLServerConfig {
  schema: GraphQLSchema | Promise<GraphQLSchema>;
  enableGraphQLEndpoint?: boolean;
  // use baseContext to pass global data to the graphql context
  baseContext?: Object | Promise<Object>;
  // use the contextFactory to create a context for each request
  // the callback needs to be called with your object
  contextFactory?: (callback: (ctx: Object) => void) => Promise<void>;
  // implement resolverFactory to create a custom resolver
  customResolverFactory?: (executionContext: HelixExecutionContext & FireboomExecutionContext) => Promise<{}>;
}

let fastify: FastifyInstance

let customizeNameList: string[]

export async function registerCustomizeGraphQL(name: string, config: GraphQLServerConfig) {
  const routeUrl = replaceUrl(Endpoint.Customize, { name })
  const schema = await config.schema
  const baseContext = await config.baseContext

  fastify.route({
    method: ['GET', 'POST'],
    url: routeUrl,
    config: { kind: 'customize', customizeName: name },
    async handler(req, reply) {
      const request = {
        body: req.body,
        headers: req.headers,
        method: req.method,
        query: req.query,
      };

      // const pluginLogger = req.ctx.log.withFields({ server: config.serverName, plugin: 'graphql' });

      if (config.enableGraphQLEndpoint && shouldRenderGraphiQL(request)) {
        reply.type('text/html');
        reply.send(
          renderGraphiQL({
            endpoint: routeUrl,
          })
        );
      } else {
        // https://www.fastify.io/docs/latest/Reference/Reply/#hijack
        // We hand over the response handling to "graphql-helix"
        // No fastify hooks are called for the response.
        reply.hijack();
        try {
          const { operationName, query, variables } = getGraphQLParameters(request);
  
          if (config.contextFactory) {
            await config.contextFactory(async (ctx) => {
              const result = await processRequest<FireboomExecutionContext>({
                operationName,
                query,
                variables,
                request,
                schema,
                // @ts-ignore
                rootValueFactory: config.customResolverFactory,
                contextFactory: (): FireboomExecutionContext => ({
                  ...baseContext,
                  ...ctx,
                  fireboomContext: req.ctx,
                }),
              });
  
              await sendResult(result, reply.raw);
            });
            return;
          }
  
          const result = await processRequest<FireboomExecutionContext>({
            operationName,
            query,
            variables,
            request,
            schema,
            // @ts-ignore
            rootValueFactory: config.customResolverFactory,
            contextFactory: (): FireboomExecutionContext => ({
              ...baseContext,
              fireboomContext: req.ctx,
            }),
          });
  
          await sendResult(result, reply.raw);
        } catch (error) {
          reply.code(500).send(error);
        }
      }
    },
  });
  saveOperationConfig(HookParent.Customize, name, printIntrospectionSchema(schema))
  customizeNameList.push(name)
}

export const FireboomCustomizesPlugin: FastifyPluginAsync = async (_fastify) => {
  fastify = _fastify
  customizeNameList = []
}

export function getCustomizeNameList() {
  return customizeNameList
}