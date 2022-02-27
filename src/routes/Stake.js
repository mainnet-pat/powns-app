import { useTranslation } from 'react-i18next'

import React, { useEffect, useState } from 'react'
import { Redirect } from 'react-router-dom'

import { useAccount } from '../components/QueryAccount'
import Banner from '../components/Banner'
import { emptyAddress } from '../utils/utils'

import { getProvider, getSigner, ethers } from '@bchdomains/ui'

import { isENSReadyReactive } from '../apollo/reactiveVars'
import Loader from '../components/Loader'
import Button from '../components/Forms/Button'
import { Tab, Tabs } from '../components/Tabs'
import styled from '@emotion/styled/macro'
import {
  BAR_ADDRESS,
  ChainId,
  CurrencyAmount,
  Token,
  ZERO,
  JSBI
} from '@mistswapdex/sdk'
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

const TOKEN = new Token(
  ChainId.SMARTBCH,
  '0xE854905B3166417Ad5ecce90D64378C4B1c1a15E',
  18,
  'TOKEN',
  'TOKEN'
)
const XTOKEN = new Token(
  ChainId.SMARTBCH,
  '0x8EE123e1FC1C01EE306113CCac9BC5F151fB47a6',
  18,
  'XTOKEN',
  'XTOKEN'
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
    CurrencyAmount.fromRawAmount(TOKEN, 0)
  )
  const [xSushiBalance, setXSushiBalance] = useState(
    CurrencyAmount.fromRawAmount(XTOKEN, 0)
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

      const token = '0xE854905B3166417Ad5ecce90D64378C4B1c1a15E'
      const barToken = '0x8EE123e1FC1C01EE306113CCac9BC5F151fB47a6'

      const provider = await getProvider()

      const tokenContract = new ethers.Contract(token, abi, provider)
      const barContract = new ethers.Contract(barToken, abi, provider)

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
      const ratio = totalXSushi
        .mul(1e12)
        .div(totalSushi)
        .div(1e8)
      setxSushiPerSushi(ratio.toNumber() / 1e4)
      console.log(
        ethers.utils.formatUnits(totalSushi),
        totalXSushi,
        ratio.toNumber(),
        userSushi,
        userXSushi,
        sushiBarAllowance
      )

      setSushiBalance(CurrencyAmount.fromRawAmount(TOKEN, userSushi.toString()))
      // setSushiBalance(CurrencyAmount.fromRawAmount(TOKEN, '1234567891234567'))

      setXSushiBalance(
        CurrencyAmount.fromRawAmount(XTOKEN, userXSushi.toString())
      )
      console.log(sushiBarAllowance.toString(), sushiBarAllowance.eq(0))
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

    const contract = new ethers.Contract(TOKEN.address, abi, provider).connect(
      signer
    )

    const txHash = await sendTx(() =>
      contract.approve(
        XTOKEN.address,
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

    const contract = new ethers.Contract(XTOKEN.address, abi, provider).connect(
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

    const contract = new ethers.Contract(XTOKEN.address, abi, provider).connect(
      signer
    )

    const txHash = await sendTx(() =>
      contract.leave(amount.quotient.toString())
    )
    startPending(txHash)

    return txHash
  }

  const handleClickMax = () => {
    // setInput(balance ? balance.toSignificant(balance.currency.decimals).substring(0, INPUT_CHAR_LIMIT) : '')
    setInput(
      balance
        .toSignificant(balance.currency.decimals)
        .substring(0, INPUT_CHAR_LIMIT)
    )
    setUsingBalance(true)
  }

  const handleInput = event => {
    const { value } = event.target
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

      handleInput({ target: { value: '' } })
      setPendingTx(false)
    }
  }

  return (
    <>
      <h1 className="text-3xl font-bold underline">Hello world!</h1>

      <Tabs className={'className'}>
        <Tab
          active={activeTab === 0}
          onClick={() => {
            setActiveTab(0)
          }}
        >
          {t('address.filter.stake')}
        </Tab>
        <Tab
          active={activeTab === 1}
          onClick={() => {
            setActiveTab(1)
          }}
        >
          {t('address.filter.unstake')}
        </Tab>
      </Tabs>

      <div className="flex items-center justify-between w-full mt-6">
        <p className="font-bold text-large md:text-2xl text-high-emphesis">
          {activeTab === 0 ? `Stake MIST` : `Unstake`}
        </p>
        <div className="border-gradient-r-pink-red-light-brown-dark-pink-red border-transparent border-solid border rounded-3xl px-4 md:px-3.5 py-1.5 md:py-0.5 text-high-emphesis text-xs font-medium md:text-base md:font-normal">
          {`1 xMIST = ${xSushiPerSushi.toFixed(4)} MIST`}
        </div>
      </div>

      <InputWrapper>
        <TextInput
          onChange={handleInput}
          value={input}
          className={`w-full h-14 px-3 md:px-5 mt-5 rounded bg-dark-800 text-sm md:text-lg font-bold text-dark-800 whitespace-nowrap${
            inputError ? ' pl-9 md:pl-12' : ''
          }`}
          placeholder={activeTab === 0 ? 'MIST' : 'xMIST'}
        />
        <Button type={'hollow-primary'} onClick={handleClickMax}>
          MAX
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
            {approvalState === ApprovalState.PENDING ? 'Approving' : 'Approve'}
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
                ? 'hollow-primary-disabled'
                : 'primary'
            }
          >
            {!walletConnected
              ? `Connect Wallet`
              : !input
              ? `Enter Amount`
              : insufficientFunds
              ? `Insufficient Balance`
              : activeTab === 0
              ? `Confirm Staking`
              : `Confirm Withdrawal`}
          </Button>
        )}
      </div>
      <pre>{JSON.stringify([pending, !confirmed, txHash])}</pre>
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

      <div className="w-full max-w-xl mx-auto md:mx-0 md:ml-6 md:block md:w-72">
        <div className="flex flex-col w-full px-4 pt-6 pb-5 rounded bg-dark-900 md:px-8 md:pt-7 md:pb-9">
          <div className="flex flex-wrap">
            <div className="flex flex-col flex-grow md:mb-14">
              <p className="mb-3 text-lg font-bold md:text-2xl md:font-medium text-high-emphesis">
                {`Balance`}
              </p>
              <div className="flex items-center space-x-4">
                <div className="flex flex-col justify-center">
                  <p className="text-sm font-bold md:text-lg text-high-emphesis">
                    {xSushiBalance ? xSushiBalance.toSignificant(8) : '-'}
                  </p>
                  <p className="text-sm md:text-base text-primary">xMIST</p>
                </div>
              </div>
              {xSushiBalance && xSushiPerSushi ? (
                <div className="mt-3">
                  ~{' '}
                  {xSushiBalance
                    .multiply(Math.round(xSushiPerSushi * 1e8))
                    .divide(1e8)
                    .toSignificant(8)}{' '}
                  MIST
                </div>
              ) : (
                <></>
              )}
            </div>

            <div className="flex flex-col flex-grow">
              <div className="flex mb-3 ml-8 flex-nowrap md:ml-0">
                <p className="text-lg font-bold md:text-2xl md:font-medium text-high-emphesis">
                  {`Unstaked`}
                </p>
              </div>
              <div className="flex items-center ml-8 space-x-4 md:ml-0">
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
    </>
  )
}
