import { useTranslation } from 'react-i18next'

import React, { useEffect, useState } from 'react'

import { useAccount } from '../components/QueryAccount'
import { isReadOnlyReactive } from '../apollo/reactiveVars'
import { getProvider, getSigner, ethers } from '@bchdomains/ui'

import { isENSReadyReactive } from '../apollo/reactiveVars'
import Loader from '../components/Loader'
import Button from '../components/Forms/Button'
import { Tab, Tabs } from '../components/Tabs'
import styled from '@emotion/styled/macro'
import { ChainId, CurrencyAmount, Token, ZERO, JSBI } from '@mistswapdex/sdk'
import { sendHelper } from '../api/resolverUtils'
import { useEditable } from '../components/hooks'
import PendingTx from '../components/PendingTx'

const buttonStyle =
  'flex justify-center items-center w-full h-14 rounded font-bold md:font-medium md:text-lg mt-5 text-sm focus:outline-none focus:ring'
const buttonStyleEnabled = `${buttonStyle} text-high-emphesis bg-gradient-to-r from-pink-red to-light-brown hover:opacity-90`
const buttonStyleInsufficientFunds = `${buttonStyleEnabled} opacity-60`
const buttonStyleDisabled = `${buttonStyle} text-secondary bg-dark-700`
const buttonStyleConnectWallet = `${buttonStyle} text-high-emphesis bg-cyan-blue hover:bg-opacity-90`

const parseUnits = ethers.utils.parseUnits

const sendTx = async txFunc => {
  let success = true
  try {
    const txHash = await sendHelper(await txFunc())
    return txHash
  } catch (e) {
    console.error(e)
    success = false
  }
  return success
}

const INPUT_CHAR_LIMIT = 18

const InputWrapper = styled('p')`
  margin-top: 0;
  margin-bottom: 0;
  padding: 12px;
  display: flex;
  gap: 12px;
`

const TextInput = styled('input')`
  box-sizing: border-box;
  display: block;
  width: 100%;
  border-width: 1px;
  border-style: solid;
  padding: 16px;
  outline: 0;
  font-family: inherit;
  font-size: 0.95em;
  background: #fff;
  border-color: #bbb;
  color: #555;
  :focus {
    border-color: #888;
  }
`
const ApprovalState = {
  UNKNOWN: 'UNKNOWN',
  NOT_APPROVED: 'NOT_APPROVED',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED'
}

const LNS = new Token(
  ChainId.SMARTBCH,
  '0xE854905B3166417Ad5ecce90D64378C4B1c1a15E',
  18,
  'LNS',
  'LNS'
)
const xLNS = new Token(
  ChainId.SMARTBCH,
  '0x8EE123e1FC1C01EE306113CCac9BC5F151fB47a6',
  18,
  'xLNS',
  'xLNS'
)

// try to parse a user entered amount for a given token
export function tryParseAmount(value, currency) {
  if (!value) {
    value = '0'
  }
  if (!currency) {
    return undefined
  }
  try {
    const typedValueParsed = parseUnits(value, currency.decimals).toString()
    return CurrencyAmount.fromRawAmount(currency, JSBI.BigInt(typedValueParsed))
  } catch (error) {
    // should fail if the user specifies too many decimal places of precision (or maybe exceed max uint?)
    // console.debug(`Failed to parse input amount: "${value}"`, error)
  }
  // necessary for all paths to return a value
  return undefined
}

export default function Stake(props) {
  if (!isENSReadyReactive()) {
    return <Loader withWrap large />
  }

  const { t } = useTranslation()
  const { state, actions } = useEditable()
  const { txHash, pending, confirmed } = state
  const { startPending, resetPending, setConfirmed } = actions
  const [xSushiPerSushi, setxSushiPerSushi] = useState(0)
  const [refresh, setRefresh] = useState(0)

  const account = useAccount()
  const isReadOnly = isReadOnlyReactive()
  const walletConnected =
    account !== ethers.constants.AddressZero && !isReadOnly

  const [sushiBalance, setSushiBalance] = useState(
    CurrencyAmount.fromRawAmount(LNS, 0)
  )
  const [xSushiBalance, setXSushiBalance] = useState(
    CurrencyAmount.fromRawAmount(xLNS, 0)
  )

  const [activeTab, setActiveTab] = useState(0)
  const [approvalState, setApprovalState] = useState(ApprovalState.NOT_APPROVED)
  const [input, setInput] = useState('')
  const [usingBalance, setUsingBalance] = useState(false)
  const balance = activeTab === 0 ? sushiBalance : xSushiBalance

  const parsedAmount = usingBalance
    ? balance
    : tryParseAmount(input, balance?.currency)

  const refetch = () => {
    setRefresh(refresh + 1)
  }

  useEffect(() => {
    const fetch = async () => {
      const abi = [
        'function totalSupply() external view returns (uint256)',
        'function balanceOf(address account) external view returns (uint256)',
        'function allowance(address owner, address spender) external view returns (uint256)'
      ]

      const provider = await getProvider()

      const tokenContract = new ethers.Contract(LNS.address, abi, provider)
      const barContract = new ethers.Contract(xLNS.address, abi, provider)

      const [
        totalSushi,
        totalXSushi,
        userSushi,
        userXSushi,
        sushiBarAllowance
      ] = await Promise.all([
        tokenContract.balanceOf(xLNS.address),
        barContract.totalSupply(),
        walletConnected
          ? tokenContract.balanceOf(account)
          : ethers.constants.Zero,
        walletConnected
          ? barContract.balanceOf(account)
          : ethers.constants.Zero,
        walletConnected
          ? tokenContract.allowance(account, xLNS.address)
          : ethers.constants.Zero
      ])
      const ratio = totalSushi.mul(1e12).div(totalXSushi)
      setxSushiPerSushi(ratio.toNumber() / 1e12)

      setSushiBalance(CurrencyAmount.fromRawAmount(LNS, userSushi.toString()))
      setXSushiBalance(
        CurrencyAmount.fromRawAmount(xLNS, userXSushi.toString())
      )

      if (sushiBarAllowance.eq(0)) {
        setApprovalState(ApprovalState.NOT_APPROVED)
      } else {
        setApprovalState(ApprovalState.APPROVED)
      }
    }
    fetch()
  }, [account, refresh])

  const approve = async () => {
    const abi = [
      'function approve(address spender, uint256 amount) external returns (bool)'
    ]

    const provider = await getProvider()
    const signer = await getSigner()

    const contract = new ethers.Contract(LNS.address, abi, provider).connect(
      signer
    )

    const txHash = await sendTx(() =>
      contract.approve(xLNS.address, ethers.constants.MaxUint256)
    )
    startPending(txHash)
    setApprovalState(ApprovalState.PENDING)

    return txHash
  }

  const enter = async amount => {
    const abi = ['function enter(uint256 _amount)']

    const provider = await getProvider()
    const signer = await getSigner()

    const contract = new ethers.Contract(xLNS.address, abi, provider).connect(
      signer
    )

    const txHash = await sendTx(() =>
      contract.enter(amount.quotient.toString())
    )
    startPending(txHash)

    return txHash
  }

  const leave = async amount => {
    const abi = ['function leave(uint256 _share)']

    const provider = await getProvider()
    const signer = await getSigner()

    const contract = new ethers.Contract(xLNS.address, abi, provider).connect(
      signer
    )

    const txHash = await sendTx(() =>
      contract.leave(amount.quotient.toString())
    )
    startPending(txHash)

    return txHash
  }

  const handleClickMax = () => {
    setInput(
      balance
        .toSignificant(balance.currency.decimals)
        .substring(0, INPUT_CHAR_LIMIT)
    )
    setUsingBalance(true)
  }

  const handleInput = event => {
    const value = event?.target?.value || ''
    if (value.length <= INPUT_CHAR_LIMIT) {
      setInput(value)
      setUsingBalance(false)
    }
  }

  const [pendingTx, setPendingTx] = useState(false)
  const insufficientFunds =
    (balance && balance.equalTo(ZERO)) || parsedAmount?.greaterThan(balance)

  const inputError = insufficientFunds

  const buttonDisabled =
    !input || pendingTx || (parsedAmount && parsedAmount.equalTo(ZERO))

  const handleClickButton = async () => {
    if (buttonDisabled) return

    if (!walletConnected) {
      toggleWalletModal()
    } else {
      setPendingTx(true)

      if (activeTab === 0) {
        if (approvalState === ApprovalState.NOT_APPROVED) {
          const success = await approve()
          if (!success) {
            setPendingTx(false)
            return
          }
        }
        const success = await enter(parsedAmount)
        if (!success) {
          setPendingTx(false)
          return
        }
      } else if (activeTab === 1) {
        const success = await leave(parsedAmount)
        if (!success) {
          setPendingTx(false)
          return
        }
      }

      handleInput()
      setPendingTx(false)
    }
  }

  return (
    <div className="flex flex-col w-full min-h-full">
      <div className="flex justify-center mb-6">
        <div className="flex flex-col w-full max-w-xl mt-auto mb-2">
          <div className="flex max-w-lg">
            <div className="self-end mb-3 text-lg font-bold md:text-2xl text-high-emphesis md:mb-7">
              {t('stake.header')}
            </div>
          </div>
          <div className="max-w-lg pr-3 mb-2 text-sm leading-5 text-gray-500 md:text-base md:mb-4 md:pr-0">
            {t('stake.explanation')}
            <br />
            <br />
            {t('stake.buylns')}
            <a
              target="_blank"
              href={`https://app.mistswap.fi/swap?inputCurrency=&outputCurrency=${
                LNS.address
              }`}
            >
              MistSwap
            </a>
          </div>
        </div>
        <div className="hidden px-8 ml-6 md:block w-64">
          <img
            src="https://app.mistswap.fi/xmist-sign.png"
            alt="xLNS sign"
            width="100%"
            height="100%"
            layout="responsive"
          />
        </div>
      </div>

      <div className="flex flex-col justify-center md:flex-row">
        <div className="flex flex-col w-full max-w-xl mx-auto md:m-0">
          <Tabs className={''}>
            <Tab
              active={activeTab === 0}
              onClick={() => {
                setActiveTab(0)
                handleInput()
              }}
            >
              {t('stake.filter.stake')}
            </Tab>
            <Tab
              active={activeTab === 1}
              onClick={() => {
                setActiveTab(1)
                handleInput()
              }}
            >
              {t('stake.filter.unstake')}
            </Tab>
          </Tabs>

          <div className="flex items-center justify-between w-full mt-6">
            <p className="font-bold text-large md:text-2xl text-high-emphesis">
              {activeTab === 0
                ? `${t('stake.filter.stake')} LNS`
                : t('stake.filter.unstake')}
            </p>
            <div className="border-gradient-r-pink-red-light-brown-dark-pink-red border-transparent border-solid border rounded-3xl px-4 md:px-3.5 py-1.5 md:py-0.5 text-high-emphesis text-xs font-medium md:text-base md:font-normal">
              {`1 xLNS = ${xSushiPerSushi.toFixed(4)} LNS`}
            </div>
          </div>

          <InputWrapper>
            <TextInput
              onChange={handleInput}
              value={input}
              className={`w-full h-10 px-3 md:px-5 rounded bg-dark-800 text-sm md:text-lg font-bold text-dark-800 whitespace-nowrap${
                inputError ? ' pl-9 md:pl-12' : ''
              }`}
              placeholder={activeTab === 0 ? 'LNS' : 'xLNS'}
            />
            <Button
              type={'hollow-primary'}
              onClick={handleClickMax}
              className={`h-10`}
            >
              {t('stake.max')}
            </Button>
          </InputWrapper>

          <div className="flex">
            {(approvalState === ApprovalState.NOT_APPROVED ||
              approvalState === ApprovalState.PENDING) &&
            activeTab === 0 &&
            walletConnected ? (
              <Button
                className={`${buttonStyle} text-high-emphesis bg-cyan-blue hover:bg-opacity-90`}
                onClick={approve}
                disabled={approvalState === ApprovalState.PENDING}
              >
                {approvalState === ApprovalState.PENDING
                  ? t('stake.approving')
                  : t('stake.approve')}
              </Button>
            ) : (
              <Button
                className={
                  buttonDisabled
                    ? buttonStyleDisabled
                    : !walletConnected
                    ? buttonStyleConnectWallet
                    : insufficientFunds
                    ? buttonStyleInsufficientFunds
                    : buttonStyleEnabled
                }
                onClick={handleClickButton}
                disabled={buttonDisabled || inputError}
                type={
                  buttonDisabled || !walletConnected || insufficientFunds
                    ? 'danger'
                    : 'primary'
                }
              >
                {!walletConnected
                  ? t('stake.connectWallet')
                  : !input
                  ? t('stake.enterAmount')
                  : insufficientFunds
                  ? t('stake.insufficientBalance')
                  : activeTab === 0
                  ? t('stake.confirmStaking')
                  : t('stake.confirmWithdrawal')}
              </Button>
            )}
          </div>
          {pending && !confirmed && txHash && (
            <div className="flex justify-center mt-3">
              <PendingTx
                txHash={txHash}
                onConfirmed={() => {
                  setConfirmed()
                  resetPending()
                  setApprovalState(ApprovalState.APPROVED)
                  refetch()
                }}
              />
            </div>
          )}
        </div>

        <div className="w-full max-w-xl mx-auto md:mx-0 md:ml-6 md:block md:w-64">
          <div className="flex flex-col w-full px-4 pt-6 pb-5 rounded bg-dark-900 md:px-8 md:pt-7 md:pb-9">
            <div className="flex flex-wrap">
              <div className="flex flex-col flex-grow">
                <div className="flex mb-3 ml-8 flex-nowrap md:ml-0">
                  <p className="text-lg font-bold md:text-2xl md:font-medium text-high-emphesis">
                    {t('stake.balance')}
                  </p>
                </div>
                <div className="flex items-center ml-8 space-x-4 md:ml-0">
                  <img
                    className="max-w-10 md:max-w-16 -ml-1 mr-1 md:mr-2 -mb-1.5 rounded"
                    src="https://app.mistswap.fi/images/tokens/xmist-square.jpg"
                    alt="xLNS"
                    width={64}
                    height={64}
                  />
                  <div className="flex flex-col justify-center">
                    <p className="text-sm font-bold md:text-lg text-high-emphesis">
                      {walletConnected && xSushiBalance
                        ? xSushiBalance.toSignificant(8)
                        : '-'}
                    </p>
                    <p className="text-sm md:text-base text-primary">xLNS</p>
                    {walletConnected &&
                      xSushiBalance.greaterThan(0) &&
                      xSushiPerSushi && (
                        <p className="text-xs whitespace-no-wrap">
                          ~{' '}
                          {xSushiBalance
                            .multiply(Math.round(xSushiPerSushi * 1e8))
                            .divide(1e8)
                            .toSignificant(8)}{' '}
                          LNS
                        </p>
                      )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col flex-grow md:mt-10">
                <div className="flex mb-3 ml-8 flex-nowrap md:ml-0">
                  <p className="text-lg font-bold md:text-2xl md:font-medium text-high-emphesis">
                    {`Unstaked`}
                  </p>
                </div>
                <div className="flex items-center ml-8 space-x-4 md:ml-0">
                  <img
                    className="max-w-10 md:max-w-16 -ml-1 mr-1 md:mr-2 -mb-1.5 rounded"
                    src="https://app.mistswap.fi/images/tokens/mist-square.jpg"
                    alt="LNS"
                    width={64}
                    height={64}
                  />
                  <div className="flex flex-col justify-center">
                    <p className="text-sm font-bold md:text-lg text-high-emphesis">
                      {walletConnected && sushiBalance
                        ? sushiBalance.toSignificant(8)
                        : '-'}
                    </p>
                    <p className="text-sm md:text-base text-primary">LNS</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
