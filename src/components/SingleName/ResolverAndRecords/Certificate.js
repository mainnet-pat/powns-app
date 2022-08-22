import { topLevelDomainSupported } from '@bchdomains/ui'

const TLD = 'wf'
function createFetchUrl(name) {
  return `https://doge.${TLD}/names/${name}.${TLD}`
}

function whitelisted() {
  return ['app.dogedomains.wf', 'dns.doge', 'dns.doge.wf'].includes(
    window.location.host
  )
}

export function requestCertificate(name) {
  if (!whitelisted()) return Promise.resolve({ status: null })
  const fetchUrl = createFetchUrl(name)
  fetch(fetchUrl, {
    method: 'PUT',
    mode: 'cors',
    headers: {
      Origin: '*',
      'Content-Type': 'text/plain',
      'Access-Control-Request-Method': 'PUT'
    }
  }).catch(e => {
    console.log(e)
  })
}

export function checkCertificate(name) {
  if (!whitelisted()) return Promise.resolve({ status: null })
  return fetch(createFetchUrl(name))
}

export function isEthSubdomain(name) {
  let labels = name.split('.')
  let suffix = labels[labels.length - 1]
  return topLevelDomainSupported(suffix) && !topLevelDomainSupported(name)
}
