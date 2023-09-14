import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { BaseRequestBody, Endpoint, MiddlewareHookResponse, OnRequestHookPayload, OnRequestHookResponse, OnResponseHookPayload, OnResponseHookResponse, OperationHookPayload, OperationHookPayload_response, RequestHeaders, UploadHookPayload, UploadHookResponse } from './types/server'

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

// make some key as partial
export type PartialKey<T extends Record<string, any>, K extends keyof T> = Omit<T, K> & { [P in K]?: T[P] }
// remove void type
export type OmitVoid<T> = Pick<T, Exclude<keyof T, "void">>

export type PromiseFunction = (...args: any) => Promise<any>
export type AppendResponse<T extends PromiseFunction, Append> = (...args: Parameters<T>) => Promise<{ response: Awaited<ReturnType<T>> } & Append>
export type HeaderMutableFunction<T extends PromiseFunction> = AppendResponse<T, { headers?: RequestHeaders }>
export type InputMutableFunction<T extends PromiseFunction> = AppendResponse<T, { input?: MiddlewareHookResponse['input'] }>

export type MutatingPreResolveFunction<T extends PromiseFunction> = (...args: Parameters<T>) => Promise<OmitVoid<Awaited<ReturnType<T>>> & { headers?: RequestHeaders, input?: MiddlewareHookResponse['input'] }>

export type VoidHookFunction = (ctx: FastifyRequest['ctx']) => Promise<void>
export type CommonResponse = MiddlewareHookResponse['response']
export type WithResponseHookFunction<R = CommonResponse> = (ctx: FastifyRequest['ctx']) => Promise<R>
export type GlobalHookFunction<Payload, R = CommonResponse> = (ctx: FastifyRequest['ctx'] & Payload) => Promise<R | SKIP | CANCEL>
export type OperationHookFunction<I = OperationHookPayload['input'], R = CommonResponse> = (ctx: FastifyRequest['ctx'] & { input: I }) => Promise<R>
export type OperationWithoutResponseHookFunction<I = OperationHookPayload['input']> = (ctx: FastifyRequest['ctx'] & { input: I }) => Promise<void>
export type OperationWithResponseHookFunction<I = OperationHookPayload['input'], R = CommonResponse> = (ctx: FastifyRequest['ctx'] & { input: I; response: OperationHookPayload_response }) => Promise<R>

export type PreUploadHookFunction<Meta = any, R = CommonResponse> = (ctx: FastifyRequest['ctx'] & Omit<UploadHookPayload, '__wg' | 'error' | 'meta'> & { meta: Meta }) => Promise<R>
export type PostUploadHookFunction<Meta = any, R = CommonResponse> = (ctx: FastifyRequest['ctx'] & Omit<UploadHookPayload, '__wg' | 'meta'> & { meta: Meta }) => Promise<R>

export type FBHookResponse<R = CommonResponse> = Required<Pick<MiddlewareHookResponse, 'hook'> & { error: unknown }> | Partial<Pick<MiddlewareHookResponse, 'hook' | 'op' | 'setClientRequestHeaders'> & { response: R }>
export type FBFastifyRequest<B, R = CommonResponse> = { Body: B, Reply: FBHookResponse<R> }

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
  fastify.post<FBFastifyRequest<BaseRequestBody>>(
    Endpoint.PostAuthentication,
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
  fastify.post<FBFastifyRequest<BaseRequestBody>, GlobalHooksRouteConfig>(
    Endpoint.MutatingPostAuthentication,
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
  fastify.post<FBFastifyRequest<BaseRequestBody>, GlobalHooksRouteConfig>(
    Endpoint.RevalidateAuthentication,
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
  fastify.post<FBFastifyRequest<BaseRequestBody>, GlobalHooksRouteConfig>(
    Endpoint.PostLogout,
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

export function registerBeforeOriginRequest(fn: GlobalHookFunction<OnRequestHookPayload, OnRequestHookResponse['request']>) {
  fastify.post<FBFastifyRequest<OnRequestHookPayload>, GlobalHooksRouteConfig>(
    Endpoint.BeforeOriginRequest,
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

export function registerOnOriginRequest(fn: GlobalHookFunction<OnRequestHookPayload, OnRequestHookResponse['request']>) {
  fastify.post<FBFastifyRequest<OnRequestHookPayload>, GlobalHooksRouteConfig>(
    Endpoint.OnOriginRequest,
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

export function registerOnOriginResponse(fn: GlobalHookFunction<OnResponseHookPayload, OnResponseHookResponse['response']>) {
  fastify.post<FBFastifyRequest<OnResponseHookPayload, PartialKey<OnResponseHookResponse, 'response'>>, GlobalHooksRouteConfig>(
    Endpoint.OnOriginResponse,
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

export function registerMockResolve<OperationInput extends OperationHookPayload['input'], OperationResponse>(operationName: string, fn: HeaderMutableFunction<OperationHookFunction<OperationInput, OperationResponse>>) {
  fastify.post<FBFastifyRequest<OperationHookPayload>, HooksRouteConfig>(
    Endpoint.MockResolve.replace('{path}', operationName),
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

export function registerPreResolve<OperationInput extends OperationHookPayload['input'], OperationResponse>(operationName: string, fn: OperationHookFunction<OperationInput, OperationResponse>) {
  fastify.post<FBFastifyRequest<OperationHookPayload>, HooksRouteConfig>(
    Endpoint.PreResolve.replace('{path}', operationName),
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

export function registerPostResolve<OperationInput extends OperationHookPayload['input'], OperationResponse>(operationName: string, fn: OperationWithResponseHookFunction<OperationInput, OperationResponse>) {
  fastify.post<FBFastifyRequest<OperationHookPayload>, HooksRouteConfig>(
    Endpoint.PostResolve.replace('{path}', operationName),
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

export function registerMutatingPreResolve<OperationInput extends OperationHookPayload['input']>(operationName: string, fn: MutatingPreResolveFunction<OperationWithoutResponseHookFunction<OperationInput>>) {
  fastify.post<FBFastifyRequest<OperationHookPayload>, HooksRouteConfig>(
    Endpoint.MutatingPreResolve.replace('{path}', operationName),
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

export function registerMutatingPostResolve<OperationInput extends OperationHookPayload['input'], OperationResponse>(operationName: string, fn: HeaderMutableFunction<OperationWithResponseHookFunction<OperationInput, OperationResponse>>) {
  fastify.post<FBFastifyRequest<OperationHookPayload>, HooksRouteConfig>(
    Endpoint.MutatingPostResolve.replace('{path}', operationName),
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

export function registerCustomResolve<OperationInput extends OperationHookPayload['input'], OperationResponse>(operationName: string, fn: HeaderMutableFunction<OperationHookFunction<OperationInput, OperationResponse>>) {
  fastify.post<FBFastifyRequest<OperationHookPayload>, HooksRouteConfig>(
    Endpoint.CustomResolve.replace('{path}', operationName),
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

export function registerPreUpload<Meta = any>(providerName: string, profileName: string, fn: PreUploadHookFunction<Meta, UploadHookResponse>) {
  fastify.post<FBFastifyRequest<UploadHookPayload>, UploadHooksRouteConfig>(
    Endpoint.PreUpload.replace('{provider}', providerName).replace('{profile}', profileName),
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

export function registerPostUpload<Meta = any>(providerName: string, profileName: string, fn: PostUploadHookFunction<Meta, UploadHookResponse>) {
  fastify.post<FBFastifyRequest<UploadHookPayload>, UploadHooksRouteConfig>(
    Endpoint.PostUpload.replace('{provider}', providerName).replace('{profile}', profileName),
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
