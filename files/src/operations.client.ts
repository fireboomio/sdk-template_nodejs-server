import { Client, type ClientResponse, type OperationRequestOptions, type SubscriptionRequestOptions } from '@fireboom/client'

export type InternalOperation<Data = any> = {
  input?: object;
  response: Data;
};

export type InternalOperationDefinition = {
  [key: string]: InternalOperation;
};

export type InternalOperationsDefinition<
  Queries extends InternalOperationDefinition = InternalOperationDefinition,
  Mutations extends InternalOperationDefinition = InternalOperationDefinition,
  Subscriptions extends InternalOperationDefinition = InternalOperationDefinition
> = {
  queries: Queries;
  mutations: Mutations;
  subscriptions: Subscriptions;
};

export class OperationsClient<Operations extends InternalOperationsDefinition = InternalOperationsDefinition> extends Client {
  query<
    OperationName extends Extract<keyof Operations['queries'], string>,
    Input extends Operations['queries'][OperationName]['input'] = Operations['queries'][OperationName]['input'],
    TResponse extends Operations['queries'][OperationName]['response'] = Operations['queries'][OperationName]['response']
  >(options: OperationName extends string ? OperationRequestOptions<OperationName, Input> : OperationRequestOptions)
    : Promise<ClientResponse<TResponse['data'], TResponse['error']>> {
    return super.query<OperationRequestOptions, TResponse>(options);
  }
  mutate<
    OperationName extends Extract<keyof Operations['mutations'], string>,
    Input extends Operations['mutations'][OperationName]['input'] = Operations['mutations'][OperationName]['input'],
    Data extends Operations['mutations'][OperationName]['response'] = Operations['mutations'][OperationName]['response'],
  >(options: OperationName extends string ? OperationRequestOptions<OperationName, Input> : OperationRequestOptions)
    : Promise<ClientResponse<Data['data'], Data['error']>> {
    return super.mutate<OperationRequestOptions, Data>(options);
  }
  public subscribe = async <
    OperationName extends Extract<keyof Operations['subscriptions'], string>,
    Input extends Operations['subscriptions'][OperationName]['input'] = Operations['subscriptions'][OperationName]['input'],
    TResponse extends Operations['subscriptions'][OperationName]['response'] = Operations['subscriptions'][OperationName]['response'],
    ReturnType = AsyncGenerator<ClientResponse<TResponse['data'], TResponse['error']>>
  >(
    options: OperationName extends string ? SubscriptionRequestOptions<OperationName, Input> : OperationRequestOptions
  ): Promise<ReturnType> => {
    return super.subscribe(options);
  }
}