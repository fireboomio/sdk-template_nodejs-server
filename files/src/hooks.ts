import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { BaseRequestBody, MiddlewareHookResponse, OnRequestHookPayload, OnResponseHookPayload, OperationHookPayload, OperationHookPayload_response, RequestHeaders, UploadHookPayload } from './types/server'

export interface GlobalHooksRouteConfig {
  kind: 'global-hook'
  category: string
  hookName: string
}

export interface HooksRouteConfig {
  kind: 'hook'
  operationName: string
  hookName: string
}

export interface UploadHooksRouteConfig {
  kind: 'upload-hook'
  hookName: string
  providerName: string
  profileName: string
}

export type SKIP = 'skip'
export type CANCEL = 'cancel'

export type PromiseFunction = (...args: any) => Promise<any>
export type AppendResponse<T extends PromiseFunction, Append> = (...args: Parameters<T>) => Promise<{ response: Awaited<ReturnType<T>> } & Append>
export type HeaderMutableFunction<T extends PromiseFunction> = AppendResponse<T, { headers?: RequestHeaders }>
export type InputMutableFunction<T extends PromiseFunction> = AppendResponse<T, { input?: MiddlewareHookResponse['input'] }>
export type HeaderAndInputMutableFunction<T extends PromiseFunction> = AppendResponse<T, { headers?: RequestHeaders, input?: MiddlewareHookResponse['input'] }>

export type VoidHookFunction = (ctx: FastifyRequest['ctx']) => Promise<void>
export type WithResponseHookFunction<R = MiddlewareHookResponse['response']> = (ctx: FastifyRequest['ctx']) => Promise<R>
export type GlobalHookFunction<R = MiddlewareHookResponse['response']> = (ctx: FastifyRequest['ctx'] & (OnRequestHookPayload | OnResponseHookPayload)) => Promise<R | SKIP | CANCEL>
export type OperationHookFunction<I = OperationHookPayload['input'], R = MiddlewareHookResponse['response']> = (ctx: FastifyRequest['ctx'] & { input: I }) => Promise<R>
export type OperationWithoutResponseHookFunction<I = OperationHookPayload['input']> = (ctx: FastifyRequest['ctx'] & { input: I }) => Promise<void>
export type OperationWithResponseHookFunction<I = OperationHookPayload['input'], R = MiddlewareHookResponse['response']> = (ctx: FastifyRequest['ctx'] & { input: I; response: OperationHookPayload_response }) => Promise<R>

export type PreUploadHookFunction<R = MiddlewareHookResponse['response']> = (ctx: FastifyRequest['ctx'] & Omit<UploadHookPayload, '__wg' | 'error'>) => Promise<R>
export type PostUploadHookFunction<R = MiddlewareHookResponse['response']> = (ctx: FastifyRequest['ctx'] & Omit<UploadHookPayload, '__wg'>) => Promise<R>

export type FBHookResponse = Required<Pick<MiddlewareHookResponse, 'hook'> & { error: unknown }> | Partial<Pick<MiddlewareHookResponse, 'hook' | 'response' | 'op' | 'setClientRequestHeaders'>>
export type FBFastifyInterface<B, R = FBHookResponse> = { Body: B, Reply: R }

let fastify: FastifyInstance

function authenticationPreHandler(req: FastifyRequest, reply: FastifyReply): boolean {
  if (req.ctx.user === undefined) {
    req.log.error("User context doesn't exist")
    reply.code(400).send({ error: "User context doesn't exist" })
    return false
  }
  return true
}

export function registerPostAuthentication(fn: VoidHookFunction) {
  fastify.post<FBFastifyInterface<BaseRequestBody>>(
    '/authentication/postAuthentication',
    { config: { kind: 'global-hook', category: 'authentication', hookName: 'postAuthentication' } },
    async (request, reply) => {
      if (authenticationPreHandler(request, reply)) {
        try {
          await fn(request.ctx)
        } catch (err) {
          request.log.error(err)
          reply.code(500).send({ hook: 'postAuthentication', error: err })
        }
        reply.code(200).send({
          hook: 'postAuthentication'
        })
      }
    }
  )
}

export function registerMutatingPostAuthentication(fn: HeaderMutableFunction<WithResponseHookFunction>) {
  fastify.post<FBFastifyInterface<BaseRequestBody>, GlobalHooksRouteConfig>(
    '/authentication/mutatingPostAuthentication',
    { config: { kind: 'global-hook', category: 'authentication', hookName: 'mutatingPostAuthentication' } },
    async (request, reply) => {
      if (authenticationPreHandler(request, reply)) {
        try {
          const out = await fn(request.ctx)
          reply.code(200).send({
            hook: 'mutatingPostAuthentication',
            response: out.response,
            setClientRequestHeaders: out.headers
          })
        } catch (err) {
          request.log.error(err)
          reply.code(500).send({ hook: 'mutatingPostAuthentication', error: err })
        }
      }
    }
  )
}

export function registerRevalidate(fn: HeaderMutableFunction<WithResponseHookFunction>) {
  fastify.post<FBFastifyInterface<BaseRequestBody>, GlobalHooksRouteConfig>(
    '/authentication/revalidateAuthentication',
    { config: { kind: 'global-hook', category: 'authentication', hookName: 'postLogout' } },
    async (request, reply) => {
      if (authenticationPreHandler(request, reply)) {
        try {
          const out = await fn(request.ctx)
          reply.code(200).send({
            hook: 'revalidateAuthentication',
            response: out.response,
            setClientRequestHeaders: out.headers
          })
        } catch (err) {
          request.log.error(err)
          reply.code(500).send({ hook: 'revalidateAuthentication', error: err })
        }
      }
    }
  )
}

export function registerPostLogout(fn: HeaderMutableFunction<WithResponseHookFunction>) {
  fastify.post<FBFastifyInterface<BaseRequestBody>, GlobalHooksRouteConfig>(
    '/authentication/postLogout',
    { config: { kind: 'global-hook', category: 'authentication', hookName: 'postLogout' } },
    async (request, reply) => {
      if (authenticationPreHandler(request, reply)) {
        try {
          const out = await fn(request.ctx)
          reply.code(200).send({
            hook: 'postLogout',
            response: out.response,
            setClientRequestHeaders: out.headers
          })
        } catch (err) {
          request.log.error(err)
          reply.code(500).send({ hook: 'postLogout', error: err })
        }
      }
    }
  )
}

export function registerBeforeOriginRequest(fn: GlobalHookFunction) {
  fastify.post<FBFastifyInterface<OnRequestHookPayload>, GlobalHooksRouteConfig>(
    '/global/httpTransport/beforeOriginRequest',
    { config: { kind: 'global-hook', category: 'httpTransport', hookName: 'beforeOriginRequest' } },
    async (request, reply) => {
      reply.type('application/json').code(200)
      try {
        const maybeHookOut = await fn({ ...request.ctx, ...request.body })
        const hookOut = maybeHookOut || 'skip'
        return {
          op: request.body.operationName,
          hook: 'beforeOriginRequest',
          response: {
            skip: hookOut === 'skip',
            cancel: hookOut === 'cancel',
            request: hookOut !== 'skip' && hookOut !== 'cancel' ? { ...hookOut } : undefined
          }
        }
      } catch (err) {
        request.log.error(err)
        reply.code(500)
        return { hook: 'beforeOriginRequest', error: err }
      }
    }
  )
}

export function registerOnOriginRequest(fn: GlobalHookFunction) {
  fastify.post<FBFastifyInterface<OnRequestHookPayload>, GlobalHooksRouteConfig>(
    '/global/httpTransport/onOriginRequest',
    { config: { kind: 'global-hook', category: 'httpTransport', hookName: 'onOriginRequest' } },
    async (request, reply) => {
      reply.type('application/json').code(200)
      try {
        const maybeHookOut = await fn({ ...request.ctx, ...request.body })
        const hookOut = maybeHookOut || 'skip'
        return {
          op: request.body.operationName,
          hook: 'onOriginRequest',
          response: {
            skip: hookOut === 'skip',
            cancel: hookOut === 'cancel',
            request: hookOut !== 'skip' && hookOut !== 'cancel' ? { ...hookOut } : undefined
          }
        }
      } catch (err) {
        request.log.error(err)
        reply.code(500)
        return { hook: 'onOriginRequest', error: err }
      }
    }
  )
}

export function registerOnOriginResponse(fn: GlobalHookFunction) {
  fastify.post<FBFastifyInterface<OnResponseHookPayload>, GlobalHooksRouteConfig>(
    '/global/httpTransport/onOriginResponse',
    { config: { kind: 'global-hook', category: 'httpTransport', hookName: 'onOriginResponse' } },
    async (request, reply) => {
      reply.type('application/json').code(200)
      try {
        const maybeHookOut = await fn({ ...request.ctx, ...request.body })
        const hookOut = maybeHookOut || 'skip'
        return {
          op: request.body.operationName,
          hook: 'onOriginResponse',
          response: {
            skip: hookOut === 'skip',
            cancel: hookOut === 'cancel',
            response: hookOut !== 'skip' && hookOut !== 'cancel' ? { ...hookOut } : undefined
          }
        }
      } catch (err) {
        request.log.error(err)
        reply.code(500)
        return { hook: 'onOriginResponse', error: err }
      }
    }
  )
}

export function registerMockResolve(operationName: string, fn: HeaderMutableFunction<OperationHookFunction>) {
  fastify.post<FBFastifyInterface<OperationHookPayload>, HooksRouteConfig>(
    `/operation/${operationName}/mockResolve`,
    { config: { operationName, kind: 'hook', hookName: 'mockResolve' } },
    async (request, reply) => {
      reply.type('application/json').code(200)
      try {
        const out = await fn({ ...request.ctx, input: request.body.input })
        return {
          op: operationName,
          hook: 'mock',
          response: out.response,
          setClientRequestHeaders: out.headers
        }
      } catch (err) {
        request.log.error(err)
        reply.code(500)
        return { op: operationName, hook: 'mock', error: err }
      }
    }
  )
}

export function registerPreResolve(operationName: string, fn: OperationHookFunction) {
  fastify.post<FBFastifyInterface<OperationHookPayload>, HooksRouteConfig>(
    `/operation/${operationName}/preResolve`,
    { config: { operationName, kind: 'hook', hookName: 'preResolve' } },
    async (request, reply) => {
      reply.type('application/json').code(200)
      try {
        await fn({ ...request.ctx, input: request.body.input })
        return {
          op: operationName,
          hook: 'preResolve',
          setClientRequestHeaders: request.ctx.clientRequest.headers
        }
      } catch (err) {
        request.log.error(err)
        reply.code(500)
        return { op: operationName, hook: 'preResolve', error: err }
      }
    }
  )
}

export function registerPostResolve(operationName: string, fn: OperationWithResponseHookFunction) {
  fastify.post<FBFastifyInterface<OperationHookPayload>, HooksRouteConfig>(
    `/operation/${operationName}/postResolve`,
    { config: { operationName, kind: 'hook', hookName: 'postResolve' } },
    async (request, reply) => {
      reply.type('application/json').code(200)
      try {
        await fn({
          ...request.ctx,
          input: request.body.input,
          response: request.body.response
        })
        return {
          op: operationName,
          hook: 'postResolve',
          setClientRequestHeaders: request.ctx.clientRequest.headers
        }
      } catch (err) {
        request.log.error(err)
        reply.code(500)
        return { op: operationName, hook: 'postResolve', error: err }
      }
    }
  )
}

export function registerMutatingPreResolve(operationName: string, fn: HeaderAndInputMutableFunction<OperationWithoutResponseHookFunction>) {
  fastify.post<FBFastifyInterface<OperationHookPayload>, HooksRouteConfig>(
    `/operation/${operationName}/mutatingPreResolve`,
    { config: { operationName, kind: 'hook', hookName: 'mutatingPreResolve' } },
    async (request, reply) => {
      reply.type('application/json').code(200)
      try {
        const out = await fn({ ...request.ctx, input: request.body.input })
        return {
          op: operationName,
          hook: 'mutatingPreResolve',
          input: out.input,
          setClientRequestHeaders: out.headers
        }
      } catch (err) {
        request.log.error(err)
        reply.code(500)
        return { op: operationName, hook: 'mutatingPreResolve', error: err }
      }
    }
  )
}

export function registerMutatingPostResolve(operationName: string, fn: HeaderMutableFunction<OperationWithResponseHookFunction>) {
  fastify.post<FBFastifyInterface<OperationHookPayload>, HooksRouteConfig>(
    `/operation/${operationName}/mutatingPostResolve`,
    { config: { operationName, kind: 'hook', hookName: 'mutatingPostResolve' } },
    async (request, reply) => {
      reply.type('application/json').code(200)
      try {
        const out = await fn({
          ...request.ctx,
          input: request.body.input,
          response: request.body.response
        })
        return {
          op: operationName,
          hook: 'mutatingPostResolve',
          response: out.response,
          setClientRequestHeaders: out.headers
        }
      } catch (err) {
        request.log.error(err)
        reply.code(500)
        return { op: operationName, hook: 'mutatingPostResolve', error: err }
      }
    }
  )
}

export function registerCustomResolve(operationName: string, fn: HeaderMutableFunction<OperationHookFunction>) {
  fastify.post<FBFastifyInterface<OperationHookPayload>, HooksRouteConfig>(
    `/operation/${operationName}/customResolve`,
    { config: { operationName, kind: 'hook', hookName: 'customResolve' } },
    async (request, reply) => {
      reply.type('application/json').code(200)
      try {
        const out = await fn({
          ...request.ctx,
          input: request.body.input
        })
        return {
          op: operationName,
          hook: 'customResolve',
          response: out.response || null,
          setClientRequestHeaders: out.headers
        }
      } catch (err) {
        request.log.error(err)
        reply.code(500)
        return { op: operationName, hook: 'customResolve', error: err }
      }
    }
  )
}

export function registerPreUpload(providerName: string, profileName: string, fn: PreUploadHookFunction) {
  fastify.post<FBFastifyInterface<UploadHookPayload>, UploadHooksRouteConfig>(
    `/upload/${providerName}/${profileName}/preUpload`,
    { config: { kind: 'upload-hook', hookName: 'preUpload', profileName, providerName } },
    async (request, reply) => {
      reply.type('application/json').code(200)
      try {
        const out = await fn({
          ...request.ctx,
          file: request.body.file,
          meta: request.body.meta,
        })
        return {
          hook: 'preUpload',
          response: out
        }
      } catch (err) {
        request.log.error(err)
        reply.code(500)
        return { error: err }
      }
    })
}

export function registerPostUpload(providerName: string, profileName: string, fn: PostUploadHookFunction) {
  fastify.post<FBFastifyInterface<UploadHookPayload>, UploadHooksRouteConfig>(
    `/upload/${providerName}/${profileName}/postUpload`,
    { config: { kind: 'upload-hook', hookName: 'postUpload', profileName, providerName } },
    async (request, reply) => {
      reply.type('application/json').code(200)
      try {
        const out = await fn({
          ...request.ctx,
          file: request.body.file,
          meta: request.body.meta,
          error: request.body.error
        })
        return {
          hook: 'postUpload',
          response: out
        }
      } catch (err) {
        request.log.error(err)
        reply.code(500)
        return { error: err }
      }
    })
}

export const FireboomHooksPlugun: FastifyPluginAsync = async (_fastify) => {
  fastify = _fastify
}
