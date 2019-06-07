import CType from './CType'
import * as CTypeUtils from './CTypeUtils'
import Identity from '../identity/Identity'
import Crypto from '../crypto'
import ICType from '../types/CType'

jest.mock('../blockchainApiConnection/BlockchainApiConnection')

describe('CType', () => {
  const ctypeModel = {
    schema: {
      $id: 'http://example.com/ctype-1',
      $schema: 'http://kilt-protocol.org/draft-01/ctype#',
      properties: {
        'first-property': { type: 'integer' },
        'second-property': { type: 'string' },
      },
      type: 'object',
    },
    metadata: {
      title: { default: 'CType Title' },
      description: {},
      properties: {
        'first-property': { title: { default: 'First Property' } },
        'second-property': { title: { default: 'Second Property' } },
      },
    },
  } as ICType

  it('verify model transformations', () => {
    const ctypeInput = {
      $id: 'http://example.com/ctype-1',
      $schema: 'http://kilt-protocol.org/draft-01/ctype-input#',
      properties: [
        {
          title: 'First Property',
          $id: 'first-property',
          type: 'integer',
        },
        {
          title: 'Second Property',
          $id: 'second-property',
          type: 'string',
        },
      ],
      type: 'object',
      title: 'CType Title',
      required: ['first-property', 'second-property'],
    }

    const claimInput = {
      $id: 'http://example.com/ctype-1',
      $schema: 'http://kilt-protocol.org/draft-01/ctype#',
      properties: {
        'first-property': { type: 'integer', title: 'First Property' },
        'second-property': { type: 'string', title: 'Second Property' },
      },
      type: 'object',
      title: 'CType Title',
      required: ['first-property', 'second-property'],
    }
    const goodClaim = {
      'first-property': 10,
      'second-property': '12',
    }
    const badClaim = {
      'first-property': '1',
      'second-property': '12',
      'third-property': true,
    }

    const ctypeFromInput = CTypeUtils.fromInputModel(ctypeInput)
    const ctypeFromModel = new CType(ctypeModel)
    expect(JSON.stringify(ctypeFromInput.getModel())).toEqual(
      JSON.stringify(ctypeFromModel.getModel())
    )
    expect(
      JSON.stringify(CTypeUtils.getClaimInputModel(ctypeFromInput, 'en'))
    ).toEqual(JSON.stringify(claimInput))
    expect(
      JSON.stringify(CTypeUtils.getCTypeInputModel(ctypeFromInput))
    ).toEqual(JSON.stringify(ctypeInput))

    expect(ctypeFromInput.verifyClaimStructure(goodClaim)).toBeTruthy()
    expect(ctypeFromInput.verifyClaimStructure(badClaim)).toBeFalsy()

    expect(() => {
      // @ts-ignore
      new CType(goodClaim).verifyClaimStructure(goodClaim)
    }).toThrow(new Error('CType does not correspond to schema'))
    expect(() => {
      CTypeUtils.fromInputModel(ctypeModel)
    }).toThrow(
      new Error('CType input does not correspond to input model schema')
    )
  })

  it('stores ctypes', async () => {
    const resultHash = Crypto.hashStr('987654')
    require('../blockchain/Blockchain').default.__mockResultHash = resultHash

    const identityAlice = Identity.buildFromURI('//Alice')
    const testHash = Crypto.hashStr('1234')

    const ctype = new CType(ctypeModel)
    ctype.hash = testHash
    expect(await ctype.store(identityAlice)).toEqual(resultHash)
  })
})