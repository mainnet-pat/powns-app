import React, { useState, useEffect } from 'react'
import { useMatomo } from '@datapunt/matomo-tracker-react'
import { useQuery } from '@apollo/client'
import { gql } from '@apollo/client'
import { Trans } from 'react-i18next'

import { H2 } from '../components/Typography/Basic'
import DomainInfo from '../components/SearchName/DomainInfo'
import { validateName, parseSearchTerm } from '../utils/utils'
import SearchErrors from '../components/SearchErrors/SearchErrors'
import { useHistory } from 'react-router-dom'
import { GET_DOMAINS_FROM_SUBRAPH } from '../graphql/queries'

const RESULTS_CONTAINER = gql`
  query getResultsContainer {
    isENSReady @client
  }
`

import {
  NonMainPageBannerContainer,
  DAOBannerContent
} from '../components/Banner/DAOBanner'
import { networkIdReactive } from 'apollo/reactiveVars'

const useCheckValidity = (_searchTerm, isENSReady, chainId) => {
  const topLevelDomainsSupported = {
    568: ['doge', 'dc'],
    2000: ['doge', 'dc'],
    10000: ['bch'],
    10001: ['bch']
  }[chainId]

  const [errors, setErrors] = useState([])
  const [parsed, setParsed] = useState([])

  let { data: { domains } = {} } = useQuery(GET_DOMAINS_FROM_SUBRAPH, {
    variables: {
      name: _searchTerm
    },
    fetchPolicy: 'no-cache'
  })
  const filteredDomains = domains?.filter(val => val?.name?.indexOf('[') == -1)

  useEffect(() => {
    const checkValidity = async () => {
      let _parsed = []
      let searchTerms = []
      let _errors = []
      setErrors([])

      if (_searchTerm.split('.').length === 1) {
        topLevelDomainsSupported.forEach(tld => {
          searchTerms.push(`${_searchTerm}.${tld}`)
        })
      } else {
        searchTerms.push(_searchTerm)
      }
      searchTerms = [
        ...searchTerms,
        ...(filteredDomains || []).map(val => val.name)
      ].filter((value, index, array) => array.indexOf(value) === index)

      for (let term of searchTerms) {
        const type = await parseSearchTerm(term)
        if (!['unsupported', 'invalid', 'short'].includes(type)) {
          _parsed.push(validateName(term))
        } else {
          _parsed.push(term)
        }
        document.title = `ĐNS Search: ${searchTerms}`

        if (type === 'unsupported') {
          _errors.push('unsupported')
        } else if (type === 'short') {
          _errors.push('tooShort')
        } else if (type === 'invalid') {
          _errors.push('domainMalformed')
        } else {
          _errors.push('')
        }
      }

      setParsed(_parsed)
      setErrors(_errors)
    }
    if (isENSReady) {
      checkValidity()
    }
  }, [_searchTerm, isENSReady, domains, chainId])

  return { errors, parsed }
}

const ResultsContainer = ({ searchDomain, match }) => {
  const { trackPageView, trackEvent } = useMatomo()
  React.useEffect(() => {
    trackPageView()
  }, [])

  const {
    data: { isENSReady }
  } = useQuery(RESULTS_CONTAINER)
  const searchTerm = match.params.searchTerm
  const history = useHistory()
  const lowered = searchTerm.toLowerCase()
  if (history && lowered !== searchTerm) {
    history.push(`/search/${lowered}`)
  }

  const chainId = networkIdReactive()
  const { errors, parsed } = useCheckValidity(searchTerm, isENSReady, chainId)

  if (!isENSReady) {
    return <div>Loading</div>
  }

  if (errors[0] === 'tooShort') {
    return (
      <>
        <SearchErrors errors={errors} searchTerm={searchTerm} />
      </>
    )
  } else if (errors.filter(error => !!error).length > 0) {
    const uniques = errors
      .filter(error => !!error)
      .filter((value, index, arr) => arr.indexOf(value) === index)
    return <SearchErrors errors={uniques} searchTerm={searchTerm} />
  }
  if (parsed) {
    return (
      <>
        <NonMainPageBannerContainer>
          <DAOBannerContent />
        </NonMainPageBannerContainer>
        <H2>
          <Trans i18nKey="singleName.search.title">Names</Trans>
        </H2>
        {parsed.map(term => (
          <DomainInfo searchTerm={term} />
        ))}
      </>
    )
  } else {
    return ''
  }
}

export default ResultsContainer
