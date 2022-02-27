import { useTranslation } from 'react-i18next'

import React, { useEffect, useState } from 'react'

import { useAccount } from '../components/QueryAccount'

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

const SUSHI = new Token(
  ChainId.SMARTBCH,
  '0xE854905B3166417Ad5ecce90D64378C4B1c1a15E',
  18,
  'SUSHI',
  'SUSHI'
)
const XSUSHI = new Token(
  ChainId.SMARTBCH,
  '0x8EE123e1FC1C01EE306113CCac9BC5F151fB47a6',
  18,
  'XSUSHI',
  'XSUSHI'
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
    console.debug(`Failed to parse input amount: "${value}"`, error)
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
  const walletConnected =
    account !== '0x0000000000000000000000000000000000000000'

  const [sushiBalance, setSushiBalance] = useState(
    CurrencyAmount.fromRawAmount(SUSHI, 0)
  )
  const [xSushiBalance, setXSushiBalance] = useState(
    CurrencyAmount.fromRawAmount(XSUSHI, 0)
  )

  const [activeTab, setActiveTab] = useState(0)
  const [approvalState, setApprovalState] = useState(ApprovalState.NOT_APPROVED)
  const [input, setInput] = useState('')
  const [usingBalance, setUsingBalance] = useState(false)
  const balance = activeTab === 0 ? sushiBalance : xSushiBalance
  const formattedBalance = balance?.toSignificant(4)

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
        'function allowance(address owner, address spender) external view returns (uint256)',
        'function approve(address spender, uint256 amount) external returns (bool)'
      ]

      const barToken = '0x8EE123e1FC1C01EE306113CCac9BC5F151fB47a6'

      const provider = await getProvider()

      const tokenContract = new ethers.Contract(SUSHI.address, abi, provider)
      const barContract = new ethers.Contract(XSUSHI.address, abi, provider)

      const [
        totalSushi,
        totalXSushi,
        userSushi,
        userXSushi,
        sushiBarAllowance
      ] = await Promise.all([
        tokenContract.balanceOf(barToken),
        barContract.totalSupply(),
        tokenContract.balanceOf(account),
        barContract.balanceOf(account),
        tokenContract.allowance(account, barToken)
      ])
      const ratio = totalSushi
        .mul(1e12)
        .div(totalXSushi)
        .div(1e8)
      setxSushiPerSushi(ratio.toNumber() / 1e4)

      setSushiBalance(CurrencyAmount.fromRawAmount(SUSHI, userSushi.toString()))
      setXSushiBalance(
        CurrencyAmount.fromRawAmount(XSUSHI, userXSushi.toString())
      )

      if (sushiBarAllowance.eq(0)) {
        setApprovalState(ApprovalState.NOT_APPROVED)
      } else {
        setApprovalState(ApprovalState.APPROVED)
      }
    }
    fetch()
  }, [account, refresh])

  const approve = async (reset = false) => {
    const abi = [
      'function approve(address spender, uint256 amount) external returns (bool)'
    ]

    const provider = await getProvider()
    const signer = await getSigner()

    const contract = new ethers.Contract(SUSHI.address, abi, provider).connect(
      signer
    )

    const txHash = await sendTx(() =>
      contract.approve(
        XSUSHI.address,
        // reset ? ethers.constants.Zero : ethers.constants.MaxUint256
        ethers.constants.MaxUint256
      )
    )
    startPending(txHash)
    setApprovalState(ApprovalState.PENDING)

    return txHash
  }

  const enter = async amount => {
    const abi = ['function enter(uint256 _amount)']

    const provider = await getProvider()
    const signer = await getSigner()

    const contract = new ethers.Contract(XSUSHI.address, abi, provider).connect(
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

    const contract = new ethers.Contract(XSUSHI.address, abi, provider).connect(
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
            // setModalOpen(true)
            return
          }
        }
        const success = await enter(parsedAmount)
        if (!success) {
          setPendingTx(false)
          // setModalOpen(true)
          return
        }
      } else if (activeTab === 1) {
        const success = await leave(parsedAmount)
        if (!success) {
          setPendingTx(false)
          // setModalOpen(true)
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
              {/* {t("stake.header")} */}
              {`Maximize yield by staking MIST for xMIST`}
            </div>
          </div>
          <div className="max-w-lg pr-3 mb-2 text-sm leading-5 text-gray-500 md:text-base md:mb-4 md:pr-0">
            {/* {t("stake.explanation")} */}
            {`For every swap on the exchange on every chain, 0.05% of the swap fees are distributed as MIST
                              proportional to your share of the MistBar. When your MIST is staked into the MistBar, you receive
                              xMIST in return.
                              Your xMIST is continuously compounding, when you unstake you will receive all the originally deposited
                              MIST and any additional from fees.`}
          </div>
        </div>
        <div className="hidden px-8 ml-6 md:block w-64">
          <img
            src="https://app.mistswap.fi/xmist-sign.png"
            alt="xMIST sign"
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
                ? `${t('stake.filter.stake')} MIST`
                : t('stake.filter.unstake')}
            </p>
            <div className="border-gradient-r-pink-red-light-brown-dark-pink-red border-transparent border-solid border rounded-3xl px-4 md:px-3.5 py-1.5 md:py-0.5 text-high-emphesis text-xs font-medium md:text-base md:font-normal">
              {`1 xMIST = ${xSushiPerSushi.toFixed(4)} MIST`}
            </div>
          </div>

          <InputWrapper>
            <TextInput
              onChange={handleInput}
              value={input}
              className={`w-full h-10 px-3 md:px-5 rounded bg-dark-800 text-sm md:text-lg font-bold text-dark-800 whitespace-nowrap${
                inputError ? ' pl-9 md:pl-12' : ''
              }`}
              placeholder={activeTab === 0 ? 'MIST' : 'xMIST'}
            />
            <Button
              type={'hollow-primary'}
              onClick={handleClickMax}
              className={`h-10`}
            >
              {t('MAX')}
            </Button>
          </InputWrapper>

          <div className="flex" style={{ width: '100%' }}>
            {(approvalState === ApprovalState.NOT_APPROVED ||
              approvalState === ApprovalState.PENDING) &&
            activeTab === 0 ? (
              <Button
                className={`${buttonStyle} text-high-emphesis bg-cyan-blue hover:bg-opacity-90`}
                style={{ width: '100%' }}
                onClick={approve}
                disabled={approvalState === ApprovalState.PENDING}
              >
                {approvalState === ApprovalState.PENDING
                  ? t('stake.approving')
                  : t('stake.approve')}
              </Button>
            ) : (
              <Button
                style={{ width: '100%' }}
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
            <div className="flex" style={{ width: '100%', marginTop: '5px' }}>
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
                    alt="xMIST"
                    width={64}
                    height={64}
                  />
                  <div className="flex flex-col justify-center">
                    <p className="text-sm font-bold md:text-lg text-high-emphesis">
                      {xSushiBalance ? xSushiBalance.toSignificant(8) : '-'}
                    </p>
                    <p className="text-sm md:text-base text-primary">xMIST</p>
                    {xSushiBalance && xSushiPerSushi && (
                      <p className="text-xs whitespace-no-wrap">
                        ~{' '}
                        {xSushiBalance
                          .multiply(Math.round(xSushiPerSushi * 1e8))
                          .divide(1e8)
                          .toSignificant(8)}{' '}
                        MIST
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
                    alt="MIST"
                    width={64}
                    height={64}
                  />
                  <div className="flex flex-col justify-center">
                    <p className="text-sm font-bold md:text-lg text-high-emphesis">
                      {sushiBalance ? sushiBalance.toSignificant(8) : '-'}
                    </p>
                    <p className="text-sm md:text-base text-primary">MIST</p>
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
