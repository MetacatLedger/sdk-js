/**
 * @group unit/messaging
 */

import type {
  IAttestedClaim,
  IClaim,
  IEncryptedMessage,
  IQuote,
  IRequestAttestationForClaim,
  ISubmitAttestationForClaim,
  IRequestClaimsForCTypes,
  ISubmitClaimsForCTypes,
} from '@kiltprotocol/types'
import { Crypto, SDKErrors } from '@kiltprotocol/utils'
import { Identity, Quote, RequestForAttestation } from '@kiltprotocol/core'
import Message from './Message'

describe('Messaging', () => {
  let identityAlice: Identity
  let identityBob: Identity
  let date: Date

  beforeAll(async () => {
    identityAlice = Identity.buildFromURI('//Alice')
    identityBob = Identity.buildFromURI('//Bob')
    date = new Date(2019, 11, 10)
  })

  it('verify message encryption and signing', async () => {
    const message = new Message(
      {
        type: Message.BodyType.REQUEST_CLAIMS_FOR_CTYPES,
        content: [{ cTypeHash: `kilt:ctype:${Crypto.hashStr('0x12345678')}` }],
      },
      identityAlice.getPublicIdentity(),
      identityBob.getPublicIdentity()
    )
    const encryptedMessage = message.encrypt(
      identityAlice,
      identityBob.getPublicIdentity()
    )

    const decryptedMessage = Message.decrypt(encryptedMessage, identityBob)
    expect(JSON.stringify(message.body)).toEqual(
      JSON.stringify(decryptedMessage.body)
    )

    const encryptedMessageWrongHash: IEncryptedMessage = JSON.parse(
      JSON.stringify(encryptedMessage)
    ) as IEncryptedMessage
    encryptedMessageWrongHash.hash = Crypto.hashStr('0x00000000')
    expect(() =>
      Message.decrypt(encryptedMessageWrongHash, identityBob)
    ).toThrowError(
      SDKErrors.ERROR_NONCE_HASH_INVALID(
        {
          hash: encryptedMessageWrongHash.hash,
          nonce: encryptedMessageWrongHash.nonce,
        },
        'Message'
      )
    )

    const encryptedMessageWrongSignature: IEncryptedMessage = JSON.parse(
      JSON.stringify(encryptedMessage)
    ) as IEncryptedMessage
    encryptedMessageWrongSignature.signature = encryptedMessageWrongSignature.signature.substr(
      0,
      encryptedMessageWrongSignature.signature.length - 4
    )
    encryptedMessageWrongSignature.signature += '1234'
    expect(() =>
      Message.decrypt(encryptedMessageWrongSignature, identityBob)
    ).toThrowError(SDKErrors.ERROR_SIGNATURE_UNVERIFIABLE())

    const encryptedMessageWrongContent: IEncryptedMessage = JSON.parse(
      JSON.stringify(encryptedMessage)
    ) as IEncryptedMessage
    encryptedMessageWrongContent.ciphertext = Crypto.hashStr('1234')
    const hashStrWrongContent: string = Crypto.hashStr(
      encryptedMessageWrongContent.ciphertext +
        encryptedMessageWrongContent.nonce +
        encryptedMessageWrongContent.createdAt
    )
    encryptedMessageWrongContent.hash = hashStrWrongContent
    encryptedMessageWrongContent.signature = identityAlice.signStr(
      hashStrWrongContent
    )
    expect(() =>
      Message.decrypt(encryptedMessageWrongContent, identityBob)
    ).toThrowError(SDKErrors.ERROR_DECODING_MESSAGE())

    const encryptedWrongBody: Crypto.EncryptedAsymmetricString = identityAlice.encryptAsymmetricAsStr(
      '{ wrong JSON',
      identityBob.getBoxPublicKey()
    )
    const ts: number = Date.now()
    const hashStrBadContent: string = Crypto.hashStr(
      encryptedWrongBody.box + encryptedWrongBody.nonce + ts
    )
    const encryptedMessageWrongBody: IEncryptedMessage = {
      createdAt: ts,
      receiverAddress: encryptedMessage.receiverAddress,
      senderAddress: encryptedMessage.senderAddress,
      ciphertext: encryptedWrongBody.box,
      nonce: encryptedWrongBody.nonce,
      hash: hashStrBadContent,
      signature: identityAlice.signStr(hashStrBadContent),
      senderBoxPublicKey: encryptedMessage.senderBoxPublicKey,
    } as IEncryptedMessage
    expect(() =>
      Message.decrypt(encryptedMessageWrongBody, identityBob)
    ).toThrowError(SDKErrors.ERROR_PARSING_MESSAGE())
  })

  it('verifies the message sender is the owner', () => {
    const content = RequestForAttestation.fromClaimAndIdentity(
      {
        cTypeHash: `kilt:ctype:${Crypto.hashStr('0x12345678')}`,
        owner: identityAlice.address,
        contents: {},
      },
      identityAlice
    )

    const quoteData: IQuote = {
      attesterAddress: identityAlice.address,
      cTypeHash: `kilt:ctype:${Crypto.hashStr('0x12345678')}`,
      cost: {
        tax: { vat: 3.3 },
        net: 23.4,
        gross: 23.5,
      },
      currency: 'Euro',
      termsAndConditions: 'https://coolcompany.io/terms.pdf',
      timeframe: date,
    }
    const quoteAttesterSigned = Quote.createAttesterSignature(
      quoteData,
      identityAlice
    )
    const bothSigned = Quote.createQuoteAgreement(
      identityAlice,
      quoteAttesterSigned,
      content.rootHash
    )
    const requestAttestationBody: IRequestAttestationForClaim = {
      content: {
        requestForAttestation: content,
        quote: bothSigned,
        prerequisiteClaims: [] as IClaim[],
      },
      type: Message.BodyType.REQUEST_ATTESTATION_FOR_CLAIM,
    }

    Message.ensureOwnerIsSender(
      new Message(
        requestAttestationBody,
        identityAlice.getPublicIdentity(),
        identityBob.getPublicIdentity()
      )
    )
    expect(() =>
      Message.ensureOwnerIsSender(
        new Message(
          requestAttestationBody,
          identityBob.getPublicIdentity(),
          identityAlice.getPublicIdentity()
        )
      )
    ).toThrowError(SDKErrors.ERROR_IDENTITY_MISMATCH('Claim', 'Sender'))

    const attestation = {
      delegationId: null,
      claimHash: requestAttestationBody.content.requestForAttestation.rootHash,
      cTypeHash: `kilt:ctype:${Crypto.hashStr('0x12345678')}`,
      owner: identityBob.getPublicIdentity().address,
      revoked: false,
    }

    const submitAttestationBody: ISubmitAttestationForClaim = {
      content: {
        attestation,
      },
      type: Message.BodyType.SUBMIT_ATTESTATION_FOR_CLAIM,
    }
    expect(() =>
      Message.ensureOwnerIsSender(
        new Message(
          submitAttestationBody,
          identityAlice.getPublicIdentity(),
          identityBob.getPublicIdentity()
        )
      )
    ).toThrowError(SDKErrors.ERROR_IDENTITY_MISMATCH('Attestation', 'Sender'))
    Message.ensureOwnerIsSender(
      new Message(
        submitAttestationBody,
        identityBob.getPublicIdentity(),
        identityAlice.getPublicIdentity()
      )
    )

    const attestedClaim: IAttestedClaim = {
      request: content,
      attestation: submitAttestationBody.content.attestation,
    }

    const submitClaimsForCTypeBody: ISubmitClaimsForCTypes = {
      content: [attestedClaim],
      type: Message.BodyType.SUBMIT_CLAIMS_FOR_CTYPES,
    }

    Message.ensureOwnerIsSender(
      new Message(
        submitClaimsForCTypeBody,
        identityAlice.getPublicIdentity(),
        identityBob.getPublicIdentity()
      )
    )
    expect(() =>
      Message.ensureOwnerIsSender(
        new Message(
          submitClaimsForCTypeBody,
          identityBob.getPublicIdentity(),
          identityAlice.getPublicIdentity()
        )
      )
    ).toThrowError(SDKErrors.ERROR_IDENTITY_MISMATCH('Claims', 'Sender'))
  })
  describe('ensureHashAndSignature', () => {
    let messageBody: IRequestClaimsForCTypes
    let encrypted: IEncryptedMessage
    let encryptedHash: string

    beforeAll(async () => {
      identityAlice = Identity.buildFromURI('//Alice')
      identityBob = Identity.buildFromURI('//Bob')

      messageBody = {
        content: [{ cTypeHash: `kilt:ctype:${Crypto.hashStr('0x12345678')}` }],

        type: Message.BodyType.REQUEST_CLAIMS_FOR_CTYPES,
      }
      encrypted = new Message(
        messageBody,
        identityAlice.getPublicIdentity(),
        identityBob.getPublicIdentity()
      ).encrypt(identityAlice, identityBob.getPublicIdentity())
      encryptedHash = encrypted.hash
    })

    it('verifies no error is thrown when executed correctly', () => {
      expect(() =>
        Message.ensureHashAndSignature(encrypted, identityAlice.address)
      ).not.toThrowError()
    })
    it('expects hash error', () => {
      // replicate the message but change the content
      const unencryptedMessage = new Message(
        {
          ...messageBody,
          content: [
            {
              cTypeHash: messageBody.content[0].cTypeHash,
            },
            ...messageBody.content,
          ],
        },
        identityAlice.getPublicIdentity(),
        identityBob.getPublicIdentity()
      )
      unencryptedMessage.body.content[0].cTypeHash = `${messageBody.content[0].cTypeHash[0]}9`
      const encrypted2 = unencryptedMessage.encrypt(
        identityAlice,
        identityBob.getPublicIdentity()
      )
      const { ciphertext: msg, nonce, createdAt } = encrypted2

      // check correct encrypted but with message from encrypted2
      expect(() =>
        Message.ensureHashAndSignature(
          {
            ...encrypted,
            ciphertext: msg,
          },
          identityBob.address
        )
      ).toThrowError(
        SDKErrors.ERROR_NONCE_HASH_INVALID(
          { hash: encryptedHash, nonce: encrypted.nonce },
          'Message'
        )
      )

      // check correct encrypted but with nonce from encrypted2
      expect(() =>
        Message.ensureHashAndSignature(
          { ...encrypted, nonce },
          identityBob.address
        )
      ).toThrowError(
        SDKErrors.ERROR_NONCE_HASH_INVALID(
          { hash: encryptedHash, nonce },
          'Message'
        )
      )

      // check correct encrypted but with createdAt from encrypted2
      expect(() =>
        Message.ensureHashAndSignature(
          { ...encrypted, createdAt },
          identityBob.address
        )
      ).toThrowError(
        SDKErrors.ERROR_NONCE_HASH_INVALID(
          { hash: encryptedHash, nonce: encrypted.nonce },
          'Message'
        )
      )
    })
    it('expects signature error', async () => {
      expect(() =>
        Message.ensureHashAndSignature(encrypted, identityBob.address)
      ).toThrowError(SDKErrors.ERROR_SIGNATURE_UNVERIFIABLE())
    })
  })
})
