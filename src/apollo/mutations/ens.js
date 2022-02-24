import { setupENS, setupRegistrar } from '@bchdomains/ui'
import { isENSReadyReactive, networkIdReactive } from '../reactiveVars'
import { topLevelDomainReactive } from '../reactiveVars'

const INFURA_ID =
  window.location.host === 'app.ens.domains'
    ? '90f210707d3c450f847659dc9a3436ea'
    : '58a380d3ecd545b2b5b3dad5d2b18bf0'

let ens = {},
  registrar = {},
  ensRegistryAddress = undefined

export async function setup({
  reloadOnAccountsChange,
  enforceReadOnly,
  enforceReload,
  customProvider,
  ensAddress
}) {
  let option = {
    reloadOnAccountsChange: false,
    enforceReadOnly,
    enforceReload,
    customProvider,
    ensAddress
  }
  const networkId = networkIdReactive()
  if (enforceReadOnly && networkId < 10000) {
    option.infura = INFURA_ID
  }
  const {
    ens: ensInstance,
    registrar: registrarInstance,
    providerObject
  } = await setupENS(option)
  ens = ensInstance
  registrar = registrarInstance
  ensRegistryAddress = ens.registryAddress || ensAddress
  isENSReadyReactive(true)
  return { ens, registrar, providerObject }
}

export async function getRegistrar() {
  const topLevelDomain = topLevelDomainReactive()

  if (
    registrar.topLevelDomain !== topLevelDomain &&
    ensRegistryAddress !== undefined
  ) {
    registrar = await setupRegistrar(ensRegistryAddress, topLevelDomain)
  }

  return registrar
}

export function getEnsAddress() {
  return ensRegistryAddress
}

export default function getENS() {
  return ens
}
