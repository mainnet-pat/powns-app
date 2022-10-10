import { getNetworkId } from '@bchdomains/ui/src/web3'
import {
  emptyAddress as _emptyAddress,
  validateName as _validateName,
  parseSearchTerm as _parseSearchTerm,
  getEnsStartBlock as _ensStartBlock,
  isLabelValid as _isLabelValid,
  isEncodedLabelhash
} from '@bchdomains/ui/src/utils/index'
import { validate } from '@ensdomains/ens-validation'
import { normalize } from '@ensdomains/eth-ens-namehash'
import { CID } from 'multiformats/esm/src/cid'

import getENS from '../apollo/mutations/ens'
import * as jsSHA3 from 'js-sha3'
import { saveName } from '../api/labels'
import { useEffect, useRef } from 'react'
import { EMPTY_ADDRESS } from './records'
import { throttle } from 'lodash'
import { globalErrorReactive } from '../apollo/reactiveVars'

// From https://github.com/0xProject/0x-monorepo/blob/development/packages/utils/src/address_utils.ts

const BASIC_ADDRESS_REGEX = /^(0x)?[0-9a-f]{40}$/i
const SAME_CASE_ADDRESS_REGEX = /^(0x)?([0-9a-f]{40}|[0-9A-F]{40})$/
const ADDRESS_LENGTH = 40
export const MAINNET_DNSREGISTRAR_ADDRESS =
  '0x58774Bb8acD458A640aF0B88238369A167546ef2'
export const ROPSTEN_DNSREGISTRAR_ADDRESS =
  '0xdB328BA5FEcb432AF325Ca59E3778441eF5aa14F'

export const networkName = {
  main: 'mainnet',
  goerli: 'goerli',
  rinkeby: 'rinkeby',
  ropsten: 'ropsten',
  local: 'local',
  smartbch: 'smartbch',
  'smartbh-amber': 'smartbch-amber',
  dogechain: 'dogechain',
  'dogechain-testnet': 'dogechain-testnet',
  ethpow: 'ethpow'
}

export const supportedAvatarProtocols = [
  'http://',
  'https://',
  'ipfs://',
  'eip155'
]

export const addressUtils = {
  isChecksumAddress(address) {
    // Check each case
    const unprefixedAddress = address.replace('0x', '')
    const addressHash = jsSHA3.keccak256(unprefixedAddress.toLowerCase())

    for (let i = 0; i < ADDRESS_LENGTH; i++) {
      // The nth letter should be uppercase if the nth digit of casemap is 1
      const hexBase = 16
      const lowercaseRange = 7
      if (
        (parseInt(addressHash[i], hexBase) > lowercaseRange &&
          unprefixedAddress[i].toUpperCase() !== unprefixedAddress[i]) ||
        (parseInt(addressHash[i], hexBase) <= lowercaseRange &&
          unprefixedAddress[i].toLowerCase() !== unprefixedAddress[i])
      ) {
        return false
      }
    }
    return true
  },
  isAddress(address) {
    if (!BASIC_ADDRESS_REGEX.test(address)) {
      // Check if it has the basic requirements of an address
      return false
    } else if (SAME_CASE_ADDRESS_REGEX.test(address)) {
      // If it's all small caps or all all caps, return true
      return true
    } else {
      // Otherwise check each case
      const isValidChecksummedAddress = addressUtils.isChecksumAddress(address)
      return isValidChecksummedAddress
    }
  }
}

export const uniq = (a, param) =>
  a.filter(
    (item, pos) => a.map(mapItem => mapItem[param]).indexOf(item[param]) === pos
  )

export async function getEtherScanAddr() {
  const networkId = await getNetworkId()
  switch (networkId) {
    case 1:
    case '1':
      return 'https://etherscan.io/'
    case 3:
    case '3':
      return 'https://ropsten.etherscan.io/'
    case 4:
    case '4':
      return 'https://rinkeby.etherscan.io/'
    case 10000:
    case '10000':
      return 'https://sonar.cash/'
    case 10001:
    case '10001':
      // return 'https://testnet.sonar.cash/'
      return 'https://mainnet.ethwscan.com/'
    case 2000:
    case '2000':
      return 'https://explorer.dogmoney.money/'
    case 568:
    case '568':
      return 'https://explorer-testnet.dogechain.dog/'
    default:
      return 'https://etherscan.io/'
  }
}

export async function ensStartBlock() {
  return _ensStartBlock()
}

export const checkLabels = (...labelHashes) => labelHashes.map(hash => null)

// export const checkLabels = (...labelHashes) =>
//   labelHashes.map(labelHash => checkLabelHash(labelHash) || null)

export const mergeLabels = (labels1, labels2) =>
  labels1.map((label, index) => (label ? label : labels2[index]))

export function validateName(name) {
  const normalisedName = _validateName(name)
  saveName(normalisedName)
  return normalisedName
}

export function isLabelValid(name) {
  return _isLabelValid(name)
}

export const parseSearchTerm = async term => {
  const ens = getENS()
  const domains = term.split('.')
  const tld = domains[domains.length - 1]
  try {
    _validateName(tld)
  } catch (e) {
    return 'invalid'
  }
  // console.log('** parseSearchTerm', { ens })
  // const address = await ens.getOwner(tld)
  return _parseSearchTerm(term, true)
}

export function humaniseName(name) {
  return name
    .split('.')
    .map(label => {
      return isEncodedLabelhash(label) ? `[unknown${label.slice(1, 8)}]` : label
    })
    .join('.')
}

export function modulate(value, rangeA, rangeB, limit) {
  let fromHigh, fromLow, result, toHigh, toLow
  if (limit === null) {
    limit = false
  }
  fromLow = rangeA[0]
  fromHigh = rangeA[1]
  toLow = rangeB[0]
  toHigh = rangeB[1]
  result = toLow + ((value - fromLow) / (fromHigh - fromLow)) * (toHigh - toLow)
  if (limit === true) {
    if (toLow < toHigh) {
      if (result < toLow) {
        return toLow
      }
      if (result > toHigh) {
        return toHigh
      }
    } else {
      if (result > toLow) {
        return toLow
      }
      if (result < toHigh) {
        return toHigh
      }
    }
  }
  return result
}

export function isElementInViewport(el) {
  var rect = el.getBoundingClientRect()

  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <=
      (window.innerHeight ||
        document.documentElement.clientHeight) /*or $(window).height() */ &&
    rect.right <=
      (window.innerWidth ||
        document.documentElement.clientWidth) /*or $(window).width() */
  )
}

export const emptyAddress = _emptyAddress

export function isShortName(term) {
  return [...term].length < 1
}

export const aboutPageURL = () => {
  const lang = window.localStorage.getItem('language') || ''

  return `https://powns.domains/${lang === 'en' ? '' : lang}`
}

export function isRecordEmpty(value) {
  return value === emptyAddress || value === ''
}

export const hasValidReverseRecord = getReverseRecord =>
  getReverseRecord?.name && getReverseRecord.name !== emptyAddress

export const hasNonAscii = () => {
  const strs = window.location.pathname.split('/')
  const rslt = strs.reduce((accum, next) => {
    if (accum) return true
    if (!validate(next)) return true
    return accum
  }, false)
  return rslt
}

export function usePrevious(value) {
  // The ref object is a generic container whose current property is mutable ...
  // ... and can hold any value, similar to an instance property on a class
  const ref = useRef()
  // Store current value in ref
  useEffect(() => {
    ref.current = value
  }, [value]) // Only re-run if value changes
  // Return previous value (happens before update in useEffect above)
  return ref.current
}

export function isOwnerOfParentDomain(domain, account) {
  if (!account) return false
  if (domain.parentOwner !== EMPTY_ADDRESS) {
    return domain.parentOwner?.toLowerCase() === account.toLowerCase()
  }
  return false
}

export function filterNormalised(data, name, nested = false) {
  try {
    return data?.filter(data => {
      const domain = nested ? data.domain : data
      return domain[name] === normalize(domain[name])
    })
  } catch (e) {
    if (e.message.match(/Illegal char/)) {
      globalErrorReactive({
        ...globalErrorReactive(),
        invalidCharacter: 'Invalid character'
      })
      return
    }
  }
}

export function normaliseOrMark(data, name, nested = false) {
  return data?.map(data => {
    const domain = nested ? data.domain : data
    let normalised

    try {
      normalised = normalize(domain[name])
    } catch (e) {
      if (e.message.match(/Illegal char/)) {
        console.log('domain: ', { ...domain, hasInvalidCharacter: true })
        return { ...data, hasInvalidCharacter: true }
      }

      globalErrorReactive({
        ...globalErrorReactive(),
        invalidCharacter: 'Name error: ' + e.message
      })
      return { ...data, hasInvalidCharacter: true }
    }

    if (normalised === domain[name]) {
      return data
    }

    return { ...data, hasInvalidCharacter: true }
  })
}

export function prependUrl(url) {
  if (url && !url.match(/http[s]?:\/\//)) {
    return 'https://' + url
  } else {
    return url
  }
}

export function metadataURI(_network) {
  if (['smartbch', 'smartbch-amber'].indexOf(_network)) {
    return `https://metadata.bch.domains/${_network}`
  } else if (['dogechain', 'dogechain-testnet'].indexOf(_network)) {
    return `https://metadata.dogedomains.wf/${_network}`
  } else if (['ethpow'].indexOf(_network)) {
    return `https://metadata.bch.domains/${_network}`
  } else if (_network === 'localhost') {
    return `http://localhost/${_network}`
  }

  return `https://metadata.bch.domains/${_network}`
}

export function imageUrl(url, name, network) {
  const _network = networkName[network?.toLowerCase()]
  const _protocol = supportedAvatarProtocols.find(proto =>
    url.startsWith(proto)
  )
  // check if given uri is supported
  // provided network name is valid,
  // domain name is available
  if (_protocol && _network && name) {
    return `${metadataURI(_network)}/avatar/${name}`
  }
  // console.warn('Unsupported avatar', network, name, url)
  return url
}

export function isCID(hash) {
  try {
    if (typeof hash === 'string') {
      return Boolean(CID.parse(hash))
    }

    return Boolean(CID.asCID(hash))
  } catch (e) {
    return false
  }
}

export function asyncThrottle(func, wait) {
  const throttled = throttle((resolve, reject, args) => {
    func(...args)
      .then(resolve)
      .catch(reject)
  }, wait)
  return (...args) =>
    new Promise((resolve, reject) => {
      throttled(resolve, reject, args)
    })
}

export const switchEthereumChain = async chainId => {
  const SUPPORTED_NETWORKS = {
    [10000]: {
      chainId: '0x2710',
      chainName: 'SmartBCH',
      nativeCurrency: {
        name: 'SmartBCH',
        symbol: 'BCH',
        decimals: 18
      },
      rpcUrls: ['https://smartbch.fountainhead.cash/mainnet'],
      blockExplorerUrls: ['https://sonar.cash']
    },
    // [10001]: {
    //   chainId: '0x2711',
    //   chainName: 'SmartBCH Amber Testnet',
    //   nativeCurrency: {
    //     name: 'DogeChain',
    //     symbol: 'BCH',
    //     decimals: 18
    //   },
    //   rpcUrls: ['https://moeing.tech:9545'],
    //   blockExplorerUrls: ['https://testnet.sonar.cash']
    // },
    [10001]: {
      chainId: '0x2711',
      chainName: 'Ethereum POW',
      nativeCurrency: {
        name: 'Ethereum POW',
        symbol: 'ETHW',
        decimals: 18
      },
      rpcUrls: ['https://mainnet.ethereumpow.org'],
      blockExplorerUrls: ['https://mainnet.ethwscan.com']
    },
    [2000]: {
      chainId: '0x07D0',
      chainName: 'DogeChain',
      nativeCurrency: {
        name: 'Doge',
        symbol: 'DOGE',
        decimals: 18
      },
      rpcUrls: ['https://rpc.yodeswap.dog'],
      blockExplorerUrls: ['https://explorer.dogmoney.money']
    },
    [568]: {
      chainId: '0x0238',
      chainName: 'DogeChain Testnet',
      nativeCurrency: {
        name: 'Doge',
        symbol: 'DOGE',
        decimals: 18
      },
      rpcUrls: ['https://rpc-testnet.dogechain.dog'],
      blockExplorerUrls: ['https://explorer-testnet.dogechain.dog']
    }
  }

  const params = SUPPORTED_NETWORKS[chainId]
  const ethereum = window.ethereum
  try {
    await ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: params.chainId }]
    })
  } catch (switchError) {
    console.log(switchError)
    // This error code indicates that the chain has not been added to MetaMask.
    if (switchError.code === 4902) {
      try {
        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [params]
        })
      } catch (addError) {
        console.log(addError)
        // handle adding network error
        throw addError
      }
    } else {
      // handle other "switch" errors
      throw switchError
    }
  }
}
