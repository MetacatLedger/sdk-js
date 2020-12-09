/**
 * @packageDocumentation
 * @module ClaimUtils
 * @preferred
 */

import jsonabc from '../util/jsonabc'
import * as SDKErrors from '../errorhandling/SDKErrors'
import IClaim, { CompressedClaim } from '../types/Claim'
import { validateAddress, validateHash } from '../util/DataUtils'

/**
 *  Checks whether the input meets all the required criteria of an IClaim object.
 *  Throws on invalid input.
 *
 * @param input The potentially only partial IClaim.
 * @throws When input's cTypeHash do not exist.
 * @throws When any of the input's contents[key] is not of type 'number', 'boolean' or 'string'.
 * @throws [[ERROR_CTYPE_HASH_NOT_PROVIDED]], [[ERROR_CLAIM_CONTENTS_MALFORMED]].
 *
 */
export function errorCheck(input: IClaim): void {
  if (!input.cTypeHash) {
    throw SDKErrors.ERROR_CTYPE_HASH_NOT_PROVIDED()
  }
  if (input.owner) {
    validateAddress(input.owner, 'Claim owner')
  }
  if (input.contents !== undefined) {
    Object.entries(input.contents).forEach(([key, value]) => {
      if (
        !key ||
        typeof key !== 'string' ||
        !['string', 'number', 'boolean', 'object'].includes(typeof value)
      ) {
        throw SDKErrors.ERROR_CLAIM_CONTENTS_MALFORMED()
      }
    })
  }
  validateHash(input.cTypeHash, 'Claim CType')
}

/**
 *  Compresses the [[Claim]] for storage and/or messaging.
 *
 * @param claim A [[Claim]] object that will be sorted and stripped for messaging or storage.
 *
 * @returns An ordered array of a [[Claim]].
 */
export function compress(claim: IClaim): CompressedClaim {
  errorCheck(claim)
  const sortedContents = jsonabc.sortObj(claim.contents)
  return [sortedContents, claim.cTypeHash, claim.owner]
}

/**
 *  Decompresses the [[Claim]] from storage and/or message.
 *
 * @param claim A compressed [[Claim]] array that is reverted back into an object.
 * @throws When [[Claim]] is not an Array or it's length is unequal 3.
 * @throws [[ERROR_DECOMPRESSION_ARRAY]].
 * @returns An object that has the same properties as the [[Claim]].
 */
export function decompress(claim: CompressedClaim): IClaim {
  if (!Array.isArray(claim) || claim.length !== 3) {
    throw SDKErrors.ERROR_DECOMPRESSION_ARRAY('Claim')
  }
  return {
    contents: claim[0],
    cTypeHash: claim[1],
    owner: claim[2],
  }
}

export default { decompress, compress, errorCheck }