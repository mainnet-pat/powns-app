import React, { Component, Fragment } from 'react'
import styled from 'react-emotion'

import { Title } from '../Typography/Basic'
import DefaultFavourite from '../AddFavourite/Favourite'
import NameDetails from './NameDetails'
import NameAuction from './NameAuction'
import {
  getPercentTimeLeft,
  getTimeElapsed,
  getTimeLeft
} from '../../lib/utils'

const NameContainer = styled('div')`
  background: white;
  box-shadow: 3px 4px 6px 0 rgba(229, 236, 241, 0.3);
  border-radius: 6px;
  margin-bottom: 60px;
  position: relative;
  overflow: hidden;

  &:before {
    left: 0;
    top: 0;
    width: 4px;
    height: 100%;
    display: block;
    content: '';
    background: ${({ state }) => {
      switch (state) {
        case 'Owned':
          return '#CACACA'
        case 'Auction':
        case 'Reveal':
          return 'linear-gradient(-180deg, #42E068 0%, #52E5FF 100%)'
        default:
          return '#52e5ff'
      }
    }};
    position: absolute;
  }
`

const TopBar = styled('div')`
  padding: 20px 40px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid #ededed;
  box-shadow: 0 2px 4px 0 rgba(181, 177, 177, 0.2);

  background: ${({ percentDone }) =>
    percentDone
      ? `
  linear-gradient(to right, rgba(128, 255, 128, 0.1) 0%, rgba(82,229,255, 0.1) ${percentDone}%,#ffffff ${percentDone}%)`
      : 'white'};
`

const RightBar = styled('div')``

const Favourite = styled(DefaultFavourite)``

class Name extends Component {
  render() {
    const { details: domain, name, pathname } = this.props
    const timeElapsed = getTimeElapsed(domain)
    const timeLeft = getTimeLeft(domain)
    const percentDone = getPercentTimeLeft(timeElapsed, domain)
    return (
      <NameContainer state={domain.state}>
        <TopBar percentDone={percentDone}>
          <Title>{name}</Title>
          <RightBar>
            <Favourite domain={domain} />
          </RightBar>
        </TopBar>
        {domain.state === 'Auction' || domain.state === 'Reveal' ? (
          <NameAuction domain={domain} timeLeft={timeLeft} />
        ) : (
          <NameDetails domain={domain} pathname={pathname} name={name} />
        )}
      </NameContainer>
    )
  }
}

export default Name
