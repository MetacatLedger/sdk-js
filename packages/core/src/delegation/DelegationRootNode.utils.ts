import type { IDelegationRootNode } from '@kiltprotocol/types'
import { DataUtils, SDKErrors } from '@kiltprotocol/utils'

export default function errorCheck(
  delegationRootNodeInput: IDelegationRootNode
): void {
  const { cTypeHash } = delegationRootNodeInput

  if (!cTypeHash) {
    throw SDKErrors.ERROR_CTYPE_HASH_NOT_PROVIDED()
  } else DataUtils.validateHash(cTypeHash, 'delegation root node ctype')
}
