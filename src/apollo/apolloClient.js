import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
  split
} from '@apollo/client'
import Observable from 'zen-observable'

import resolvers from '../api/rootResolver'
import typePolicies from './typePolicies'
import { networkIdReactive } from './reactiveVars'

let client

export const cache = new InMemoryCache({
  typePolicies
})

const endpoints = {
  '1': 'https://api.thegraph.com/subgraphs/name/ensdomains/ens',
  '3': 'https://api.thegraph.com/subgraphs/name/ensdomains/ensropsten',
  '4': 'https://api.thegraph.com/subgraphs/name/ensdomains/ensrinkeby',
  '5': 'https://api.thegraph.com/subgraphs/name/ensdomains/ensgoerli',
  '10000': 'https://graph.bch.domains/subgraphs/name/graphprotocol/ens',
  // '10001': 'https://graph.bch.domains/subgraphs/name/graphprotocol/ens-amber',
  '10001': 'https://graph.bch.domains/subgraphs/name/graphprotocol/ens-ethpow',
  '2000':
    'https://graph.dogedomains.wf/subgraphs/name/graphprotocol/ens-dogechain',
  '568':
    'https://graph.dogedomains.wf/subgraphs/name/graphprotocol/ens-dogechain-testnet'
}

function getGraphQLAPI() {
  const network = networkIdReactive()

  if (endpoints[network]) {
    return endpoints[network]
  }

  if (network > 100 && process.env.REACT_APP_GRAPH_NODE_URI) {
    return process.env.REACT_APP_GRAPH_NODE_URI
  }

  return endpoints['1']
}

function fromPromise(promise, operation) {
  return new Observable(observer => {
    promise
      .then(value => {
        operation.setContext({ response: value })
        observer.next({
          data: { [operation.operationName]: value },
          errors: []
        })
        observer.complete()
      })
      .catch(e => {
        console.error('fromPromise error: ', e)
        observer.error.bind(observer)
      })
  })
}

export function setupClient() {
  const httpLink = new HttpLink({
    uri: () => getGraphQLAPI()
  })

  const web3Link = new ApolloLink(operation => {
    const { variables, operationName } = operation

    if (resolvers.Query[operationName]) {
      return fromPromise(
        resolvers.Query[operationName]?.apply(null, [null, variables]),
        operation
      )
    }

    return fromPromise(
      resolvers.Mutation[operationName]?.apply(null, [null, variables]),
      operation
    )
  })

  const splitLink = split(
    ({ operationName }) => {
      return resolvers.Query[operationName] || resolvers.Mutation[operationName]
    },
    web3Link,
    httpLink
  )

  const option = {
    cache,
    link: splitLink
  }

  client = new ApolloClient(option)
  return client
}

export default function getClient() {
  return client
}
