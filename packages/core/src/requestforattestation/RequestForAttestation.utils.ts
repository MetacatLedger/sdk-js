/**
 * @packageDocumentation
 * @module RequestForAttestationUtils
 */

import type {
  IAttestedClaim,
  CompressedAttestedClaim,
  CompressedRequestForAttestation,
  IRequestForAttestation,
} from '@kiltprotocol/types'
import { DataUtils, SDKErrors } from '@kiltprotocol/utils'
import AttestedClaimUtils from '../attestedclaim/AttestedClaim.utils'
import ClaimUtils from '../claim/Claim.utils'
import RequestForAttestation from './RequestForAttestation'

/**
 *  Checks whether the input meets all the required criteria of an IRequestForAttestation object.
 *  Throws on invalid input.
 *
 * @param input - A potentially only partial [[IRequestForAttestation]].
 * @throws [[ERROR_CLAIM_NOT_PROVIDED]], [[ERROR_LEGITIMATIONS_NOT_PROVIDED]], [[ERROR_CLAIM_NONCE_MAP_NOT_PROVIDED]] or [[ERROR_DELEGATION_ID_TYPE]] when either the input's claim, legitimations, claimHashTree or DelegationId are not provided or of the wrong type, respectively.
 * @throws [[ERROR_CLAIM_NONCE_MAP_MALFORMED]] when any of the input's claimHashTree's keys missing their hash.
 *
 */
export function errorCheck(input: IRequestForAttestation): void {
  if (!input.claim) {
    throw SDKErrors.ERROR_CLAIM_NOT_PROVIDED()
  } else {
    ClaimUtils.errorCheck(input.claim)
  }
  if (!input.legitimations && !Array.isArray(input.legitimations)) {
    throw SDKErrors.ERROR_LEGITIMATIONS_NOT_PROVIDED()
  }

  if (!input.claimNonceMap) {
    throw SDKErrors.ERROR_CLAIM_NONCE_MAP_NOT_PROVIDED()
  }
  if (
    typeof input.claimNonceMap !== 'object' ||
    Object.entries(input.claimNonceMap).some(
      ([digest, nonce]) =>
        !digest ||
        !DataUtils.validateHash(digest, 'statement digest') ||
        typeof nonce !== 'string' ||
        !nonce
    )
  ) {
    throw SDKErrors.ERROR_CLAIM_NONCE_MAP_MALFORMED()
  }
  if (typeof input.delegationId !== 'string' && !input.delegationId === null) {
    throw SDKErrors.ERROR_DELEGATION_ID_TYPE
  }
  RequestForAttestation.verifyData(input as IRequestForAttestation)
}

/**
 *  Compresses [[AttestedClaim]]s which are made up from an [[Attestation]] and [[RequestForAttestation]] for storage and/or message.
 *
 * @param leg An array of [[Attestation]] and [[RequestForAttestation]] objects.
 *
 * @returns An ordered array of [[AttestedClaim]]s.
 */

export function compressLegitimation(
  leg: IAttestedClaim[]
): CompressedAttestedClaim[] {
  return leg.map(AttestedClaimUtils.compress)
}

/**
 *  Decompresses [[AttestedClaim]]s which are an [[Attestation]] and [[RequestForAttestation]] from storage and/or message.
 *
 * @param leg A compressed [[Attestation]] and [[RequestForAttestation]] array that is reverted back into an object.
 *
 * @returns An object that has the same properties as an [[AttestedClaim]].
 */

function decompressLegitimation(
  leg: CompressedAttestedClaim[]
): IAttestedClaim[] {
  return leg.map(AttestedClaimUtils.decompress)
}

/**
 *  Compresses a [[RequestForAttestation]] for storage and/or messaging.
 *
 * @param reqForAtt A [[RequestForAttestation]] object that will be sorted and stripped for messaging or storage.
 *
 * @returns An ordered array of a [[RequestForAttestation]].
 */

export function compress(
  reqForAtt: IRequestForAttestation
): CompressedRequestForAttestation {
  errorCheck(reqForAtt)
  return [
    ClaimUtils.compress(reqForAtt.claim),
    reqForAtt.claimNonceMap,
    reqForAtt.claimerSignature,
    reqForAtt.claimHashes,
    reqForAtt.rootHash,
    compressLegitimation(reqForAtt.legitimations),
    reqForAtt.delegationId,
  ]
}

/**
 *  Decompresses a [[RequestForAttestation]] from storage and/or message.
 *
 * @param reqForAtt A compressed [[RequestForAttestation]] array that is reverted back into an object.
 * @throws [[ERROR_DECOMPRESSION_ARRAY]] when reqForAtt is not an Array and it's length is not equal to the defined length of 8.
 *
 * @returns An object that has the same properties as a [[RequestForAttestation]].
 */

export function decompress(
  reqForAtt: CompressedRequestForAttestation
): IRequestForAttestation {
  if (!Array.isArray(reqForAtt) || reqForAtt.length !== 7) {
    throw SDKErrors.ERROR_DECOMPRESSION_ARRAY('Request for Attestation')
  }
  return {
    claim: ClaimUtils.decompress(reqForAtt[0]),
    claimNonceMap: reqForAtt[1],
    claimerSignature: reqForAtt[2],
    claimHashes: reqForAtt[3],
    rootHash: reqForAtt[4],
    legitimations: decompressLegitimation(reqForAtt[5]),
    delegationId: reqForAtt[6],
  }
}

export default {
  errorCheck,
  decompress,
  decompressLegitimation,
  compress,
  compressLegitimation,
}
