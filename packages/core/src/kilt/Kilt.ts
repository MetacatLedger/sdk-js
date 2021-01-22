/**
 * KILT's core functionalities are exposed via connecting to its blockchain.
 *
 * To connect to the blockchain:
 * ```Kilt.connect('ws://localhost:9944');```.
 *
 * @packageDocumentation
 * @module Kilt
 * @preferred
 */

import Blockchain from '../blockchain/Blockchain'
import { disconnect, getCached } from '../blockchainApiConnection'

export function connect(host: string): Promise<Blockchain> {
  return getCached(host)
}

export default {
  connect,
  disconnect,
}
