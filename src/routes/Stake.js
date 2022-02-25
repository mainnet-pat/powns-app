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

const parseUnits = ethers.utils.parseUnits

const sendTx = async txFunc => {
  let success = true
  try {
    const txHash = await sendHelper(txFunc())
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
        .mul(1e10)
        .div(totalSushi)
        .div(1e8)
      console.log(
        ethers.utils.formatUnits(totalSushi),
        totalXSushi,
        ratio.toNumber(),
        userSushi,
        userXSushi,
        sushiBarAllowance
      )

      // setSushiBalance(CurrencyAmount.fromRawAmount(TOKEN, userSushi.toString()));
      setSushiBalance(CurrencyAmount.fromRawAmount(TOKEN, '1234567891234567'))

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
  }, [account])

  const approve = async (reset = false) => {
    const abi = [
      'function approve(address spender, uint256 amount) external returns (bool)'
    ]

    const provider = await getProvider()
    const signer = await getSigner()

    const tokenContract = new ethers.Contract(
      TOKEN.address,
      abi,
      provider
    ).connect(signer)

    await sendTx(() =>
      tokenContract.approve(
        XTOKEN.address,
        reset ? ethers.constants.Zero : ethers.constants.MaxUint256
      )
    )
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
          const success = await sendTx(() => approve())
          if (!success) {
            setPendingTx(false)
            // setModalOpen(true)
            return
          }
        }
        const success = await sendTx(() => enter(parsedAmount))
        if (!success) {
          setPendingTx(false)
          // setModalOpen(true)
          return
        }
      } else if (activeTab === 1) {
        const success = await sendTx(() => leave(parsedAmount))
        if (!success) {
          setPendingTx(false)
          // setModalOpen(true)
          return
        }
      }

      handleInput('')
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

      {activeTab === 0 ? (
        <>
          <p>Stake</p>
          <InputWrapper>
            <TextInput
              placeholder="TOKEN"
              onChange={handleInput}
              value={input}
            />
            <Button type={'hollow-primary'} onClick={handleClickMax}>
              MAX
            </Button>
          </InputWrapper>

          {approvalState === ApprovalState.NOT_APPROVED ? (
            <div className="flex" style={{ width: '100%' }}>
              <Button
                style={{ width: '100%' }}
                onClick={approve}
                disabled={approvalState === ApprovalState.PENDING}
              >
                {approvalState === ApprovalState.PENDING
                  ? 'Approving'
                  : 'Approve'}
              </Button>
            </div>
          ) : (
            <div className="flex" style={{ width: '100%' }}>
              <Button
                style={{ width: '100%' }}
                onClick={handleClickButton}
                // disabled={buttonDisabled || inputError}
              >
                Stake
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <p>Unstake</p>
          <InputWrapper>
            <TextInput
              placeholder="xTOKEN"
              // value={'kek'}
              // onChange={handleChange}
            />
            <Button type={'hollow-primary'} onClick={() => {}}>
              MAX
            </Button>
          </InputWrapper>
        </>
      )}
    </>
  )
}
