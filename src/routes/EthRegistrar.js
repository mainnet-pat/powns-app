import React from 'react'
import { useMatomo } from '@datapunt/matomo-tracker-react'
import CheckAvailability from '../components/EthRegistrar/CheckAvailability'
import DomainInfo from '../components/EthRegistrar/DomainInfo'

const EthRegistrar = () => {
  const { trackPageView, trackEvent } = useMatomo()
  React.useEffect(() => {
    trackPageView()
  }, [])

  return (
    <div>
      <h2>Bch Domain Registrar</h2>
      <CheckAvailability />
      <DomainInfo />
    </div>
  )
}

export default EthRegistrar
