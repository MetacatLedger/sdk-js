import Identity from '../identity/Identity'
import BN from 'bn.js/'
// import partial from 'lodash/partial'
import { listenToBalanceChanges, makeTransfer } from './Balance.chain'

jest.mock('../blockchainApiConnection/BlockchainApiConnection')

describe('Balance', async () => {
  const blockchain = require('../blockchain/Blockchain').default

  blockchain.api.query.balances.freeBalance = jest.fn((accountAddress, cb) => {
    if (cb) {
      setTimeout(() => {
        cb(new BN(42))
      }, 1)
    }
    return new BN(12)
  })

  it('should listen to balance changes', async done => {
    const bob = Identity.buildFromURI('//Bob')
    const listener = (account: string, balance: number, change: number) => {
      expect(account).toBe(bob.address)
      expect(balance).toBe(42)
      expect(change).toBe(30)
      done()
    }

    const currentBalance = await listenToBalanceChanges(bob.address, listener)

    expect(currentBalance.toString()).toBeTruthy()
    expect(currentBalance.toString()).toEqual('12')
  })

  blockchain.__mockResultHash = '123'

  it('should make transfer', async () => {
    const alice = Identity.buildFromURI('//Alice')
    const bob = Identity.buildFromURI('//Bob')

    const hash = await makeTransfer(alice, bob.address, 100)
    expect(hash).toBe('123')
  })
})
