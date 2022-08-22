import React, { Suspense } from 'react'
import ReactDOM from 'react-dom'
import { MatomoProvider, createInstance } from '@datapunt/matomo-tracker-react'
import { ApolloProvider } from '@apollo/client'

import App from 'App'
import 'globalStyles'
import './i18n'
import setup from './setup'
import { clientReactive, networkIdReactive } from './apollo/reactiveVars'
import { setupClient } from './apollo/apolloClient'
import Loader from './components/Loader'

setup(false)
window.addEventListener('load', async () => {
  const instance = createInstance({
    urlBase: 'https://matomo.mistswap.fi',
    siteId: 9
  })
  const client = clientReactive(setupClient(networkIdReactive()))
  ReactDOM.render(
    <Suspense fallback={<Loader withWrap large />}>
      <MatomoProvider value={instance}>
        <ApolloProvider {...{ client }}>
          <App />
        </ApolloProvider>
      </MatomoProvider>
    </Suspense>,
    document.getElementById('root')
  )
})
