import { DocumentNode } from 'graphql';
import { GraphQLClient } from 'graphql-request';
import { print } from 'graphql/language/printer';
import { action, computed, observable, runInAction } from 'mobx';
import { AbortablePromise } from '../AbortablePromise';

export class GraphQLRequest<TResult, TVariables> {
  @observable public result: TResult | null = null;
  @observable public isExecuting: boolean = false;
  @observable public hasBeenExecutedAtLeastOnce: boolean = false;
  @observable public error: Error | null = null;
  @observable public execution: AbortablePromise<TResult, any> | null = null;

  @computed public get isExecutingTheFirstTime() {
    return this.isExecuting && !this.hasBeenExecutedAtLeastOnce;
  }

  private client: GraphQLClient;
  private query: DocumentNode;

  constructor(client: GraphQLClient, query: DocumentNode) {
    this.client = client;
    this.query = query;
  }

  @action public execute(variables: TVariables): Promise<TResult> {
    if (this.isExecuting) {
      this.execution?.abort();
    }
    this.isExecuting = true;
    this.execution = new AbortablePromise(
      this.client.request(print(this.query), variables)
    );
    return this.execution
      .then(result => {
        runInAction(() => {
          this.result = result;
          this.error = null;
        });
        return result;
      })
      .catch(error => {
        if (error !== AbortablePromise.ABORT_ERROR) {
          runInAction(() => {
            this.result = null;
            this.error = error;
          });
        }
        throw error;
      })
      .finally(
        action(() => {
          this.isExecuting = false;
          this.hasBeenExecutedAtLeastOnce = true;
        })
      );
  }
}

export type GraphQLRequestVariables<Request> = Request extends GraphQLRequest<
  any,
  infer Variables
>
  ? Variables
  : never;
