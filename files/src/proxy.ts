import { FastifyInstance, FastifyPluginAsync } from "fastify"

import { Endpoint } from "./types/server";
import { replaceUrl } from "./utils";

export interface ProxyConfig {
	
}

let fastify: FastifyInstance

let proxyNameList: string[]

export async function registerProxyHandler(path: string, config: ProxyConfig) {
  const routeUrl = replaceUrl(Endpoint.Proxy, { path })

  proxyNameList.push(path)
}

export const FireboomProxiesPlugun: FastifyPluginAsync = async (_fastify) => {
  fastify = _fastify
  proxyNameList = []
}

export function getproxyNameList() {
  return proxyNameList
}