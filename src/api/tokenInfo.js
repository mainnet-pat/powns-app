import tokenContract from './contracts/tokenContract.json'
import { getProvider, ethers } from '@bchdomains/ui'

const contracts = {}

const getTokenContract = async address => {
  const instantiateContract = async address => {
    const provider = await getProvider()
    const contract = new ethers.Contract(address, tokenContract, provider)
    contracts[address] = contract
    return contract
  }

  if (contracts[address]) {
    return contracts[address]
  } else {
    contracts[address] = await instantiateContract(address)
    return contracts[address]
  }
}

export const getTokenInfo = async address => {
  const contract = await getTokenContract(address)
  const [name, symbol] = await Promise.all([contract.name(), contract.symbol()])

  return {
    name,
    symbol,
    address
  }
}
