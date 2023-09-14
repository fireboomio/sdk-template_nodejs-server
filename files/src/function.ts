import { FastifyInstance, FastifyPluginAsync } from "fastify"

import { Endpoint } from "./types/server";
import { replaceUrl } from "./utils";

export interface FunctionConfig {
	
}

let fastify: FastifyInstance

let FunctionNameList: string[]

export async function registerFunctionHandler(path: string, config: FunctionConfig) {
  const routeUrl = replaceUrl(Endpoint.Function, { path })

  FunctionNameList.push(path)
}

export const FireboomFunctionsPlugun: FastifyPluginAsync = async (_fastify) => {
  fastify = _fastify
  FunctionNameList = []
}

export function getFunctionNameList() {
  return FunctionNameList
}