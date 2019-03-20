/**
 * Functions to decode types queried from the chain.
 *
 * When a type is queried from the chain using the `api.query...` functions, a result of type `Codec` is returned
 * by the polkadot-js api. We need to decode the encoded data to build the Kilt types from it.
 */

import { QueryResult } from '../blockchain/Blockchain'
import { factory } from '../config/ConfigLog'
import { IDelegationNode, IDelegationRootNode, Permission } from './Delegation'
import { DelegationNode } from './DelegationNode'

const log = factory.getLogger('DelegationDecoder')

export type CodecWithId = {
  id: string
  codec: QueryResult
}

export function decodeRootDelegation(
  encoded: QueryResult
): Partial<IDelegationRootNode | undefined> {
  const json = encoded && encoded.encodedLength ? encoded.toJSON() : null
  const delegationRootNode: IDelegationRootNode | undefined = json
    ? json.map((tuple: any[]) => {
        return Object.assign(Object.create(DelegationNode.prototype), {
          cTypeHash: tuple[0],
          account: tuple[1],
          revoked: tuple[2],
        } as IDelegationRootNode)
      })[0]
    : undefined
  log.info(`Decoded delegation root: ${JSON.stringify(delegationRootNode)}`)
  return delegationRootNode
}

export function decodeDelegationNode(
  encoded: QueryResult
): IDelegationNode | undefined {
  log.debug(`decode(): encoded: ${encoded}`)
  const json = encoded && encoded.encodedLength ? encoded.toJSON() : null
  let decodedNode: IDelegationNode | undefined
  if (json instanceof Array) {
    decodedNode = Object.assign(Object.create(DelegationNode.prototype), {
      rootId: json[0],
      parentId: json[1], // optional
      account: json[2],
      permissions: decodePermissions(json[3]),
      revoked: json[4],
    } as IDelegationNode)
  }
  log.info(`Decoded delegation node: ${JSON.stringify(decodedNode)}`)
  return decodedNode
}

/**
 * Decode the permissions from the bitset encoded in the given `number`.
 * We use bitwise `AND` to check if a permission bit flag is set.
 *
 * @param bitset the u32 number used as the bitset to encode permissions
 */
function decodePermissions(bitset: number): Permission[] {
  const permissions: Permission[] = []
  if (bitset & Permission.ATTEST) {
    permissions.push(Permission.ATTEST)
  }
  if (bitset & Permission.DELEGATE) {
    permissions.push(Permission.DELEGATE)
  }
  return permissions
}
