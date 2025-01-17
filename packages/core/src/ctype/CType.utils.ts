/**
 * @packageDocumentation
 * @module CTypeUtils
 */

import Ajv from 'ajv'
import type {
  ICType,
  IClaim,
  CompressedCType,
  CompressedCTypeSchema,
} from '@kiltprotocol/types'
import { jsonabc, Crypto, DataUtils, SDKErrors } from '@kiltprotocol/utils'
import { getOwner } from './CType.chain'
import { CTypeModel, CTypeWrapperModel } from './CTypeSchema'

export function verifySchemaWithErrors(
  object: Record<string, unknown>,
  schema: Record<string, unknown>,
  messages?: string[]
): boolean {
  const ajv = new Ajv()
  ajv.addMetaSchema(CTypeModel)
  const result = ajv.validate(schema, object)
  if (!result && ajv.errors) {
    if (messages) {
      ajv.errors.forEach((error: Ajv.ErrorObject) => {
        if (typeof error.message === 'string') {
          messages.push(error.message)
        }
      })
    }
  }
  return !!result
}

export function verifySchema(
  object: Record<string, any>,
  schema: Record<string, any>
): boolean {
  return verifySchemaWithErrors(object, schema)
}

/**
 *  Verifies the structure of the provided IClaim['contents'] with ICType['schema'].
 *
 * @param claimContents IClaim['contents'] to be verified against the schema.
 * @param schema ICType['schema'] to be verified against the [CTypeModel].
 * @throws [[ERROR_OBJECT_MALFORMED]] when schema does not correspond to the CTypeModel.
 *
 * @returns Boolean whether both claimContents and schema could be verified.
 */
export function verifyClaimStructure(
  claimContents: IClaim['contents'],
  schema: ICType['schema']
): boolean {
  if (!verifySchema(schema, CTypeModel)) {
    throw SDKErrors.ERROR_OBJECT_MALFORMED()
  }
  return verifySchema(claimContents, schema)
}

export async function verifyStored(ctype: ICType): Promise<boolean> {
  return typeof (await getOwner(ctype.hash)) === 'string'
}

export async function verifyOwner(ctype: ICType): Promise<boolean> {
  const owner = await getOwner(ctype.hash)
  return owner ? owner === ctype.owner : false
}

type schemaPropsForHashing = {
  $schema: ICType['schema']['$schema']
  properties: ICType['schema']['properties']
  title: ICType['schema']['title']
  type: ICType['schema']['type']
}

export function getHashForSchema(schema: schemaPropsForHashing): string {
  const hashVal = {
    $schema: schema.$schema,
    properties: schema.properties,
    title: schema.title,
    type: schema.type,
  }
  return Crypto.hashObjectAsStr(hashVal)
}

export function getIdForCTypeHash(hash: string): string {
  return `kilt:ctype:${hash}`
}

export function getIdForSchema(schema: schemaPropsForHashing): string {
  return getIdForCTypeHash(getHashForSchema(schema))
}

/**
 *  Checks whether the input meets all the required criteria of an ICType object.
 *  Throws on invalid input.
 *
 * @param input The potentially only partial ICType.
 * @throws [[ERROR_OBJECT_MALFORMED]] when input does not correspond to either it's schema, or the CTypeWrapperModel.
 * @throws [[ERROR_HASH_MALFORMED]] when the input's hash does not match the hash calculated from ICType's schema.
 * @throws [[ERROR_CTYPE_OWNER_TYPE]] when the input's owner is not of type string or null.
 *
 */
export function errorCheck(input: ICType): void {
  if (!verifySchema(input, CTypeWrapperModel)) {
    throw SDKErrors.ERROR_OBJECT_MALFORMED()
  }
  if (!input.schema || getHashForSchema(input.schema) !== input.hash) {
    throw SDKErrors.ERROR_HASH_MALFORMED(input.hash, 'CType')
  }
  if (getIdForSchema(input.schema) !== input.schema.$id) {
    throw SDKErrors.ERROR_CTYPE_ID_NOT_MATCHING(
      getIdForSchema(input.schema),
      input.schema.$id
    )
  }
  if (
    typeof input.owner === 'string'
      ? !DataUtils.validateAddress(input.owner, 'CType owner')
      : !(input.owner === null)
  ) {
    throw SDKErrors.ERROR_CTYPE_OWNER_TYPE()
  }
}

/**
 *  Compresses a [[CType]] schema for storage and/or messaging.
 *
 * @param cTypeSchema A [[CType]] schema object that will be sorted and stripped for messaging or storage.
 * @throws [[ERROR_COMPRESS_OBJECT]] when any of the four required properties of the cTypeSchema are missing.
 *
 * @returns An ordered array of a [[CType]] schema.
 */

export function compressSchema(
  cTypeSchema: ICType['schema']
): CompressedCTypeSchema {
  if (
    !cTypeSchema.$id ||
    !cTypeSchema.$schema ||
    !cTypeSchema.title ||
    !cTypeSchema.properties ||
    !cTypeSchema.type
  ) {
    throw SDKErrors.ERROR_COMPRESS_OBJECT(cTypeSchema, 'cTypeSchema')
  }
  const sortedCTypeSchema = jsonabc.sortObj(cTypeSchema)
  return [
    sortedCTypeSchema.$id,
    sortedCTypeSchema.$schema,
    sortedCTypeSchema.title,
    sortedCTypeSchema.properties,
    sortedCTypeSchema.type,
  ]
}

/**
 *  Decompresses a schema of a [[CType]] from storage and/or message.
 *
 * @param cTypeSchema A compressed [[CType]] schema array that is reverted back into an object.
 * @throws [[ERROR_DECOMPRESSION_ARRAY]] when either the cTypeSchema is not an Array or it's length is not equal to the defined length of 4.
 *
 * @returns An object that has the same properties as a [[CType]] schema.
 */

export function decompressSchema(
  cTypeSchema: CompressedCTypeSchema
): ICType['schema'] {
  if (!Array.isArray(cTypeSchema) || cTypeSchema.length !== 5) {
    throw SDKErrors.ERROR_DECOMPRESSION_ARRAY('cTypeSchema')
  }
  return {
    $id: cTypeSchema[0],
    $schema: cTypeSchema[1],
    title: cTypeSchema[2],
    properties: cTypeSchema[3],
    type: cTypeSchema[4],
  }
}

/**
 *  Compresses a [[CType]] for storage and/or messaging.
 *
 * @param cType A [[CType]] object that will be sorted and stripped for messaging or storage.
 *
 * @returns An ordered array of a [[CType]].
 */

export function compress(cType: ICType): CompressedCType {
  errorCheck(cType)
  return [cType.hash, cType.owner, compressSchema(cType.schema)]
}

/**
 *  Decompresses a [[CType]] from storage and/or message.
 *
 * @param cType A compressed [[CType]] array that is reverted back into an object.
 * @throws [[ERROR_DECOMPRESSION_ARRAY]] when either the cType is not an Array or it's length is not equal to the defined length of 3.
 *
 * @returns An object that has the same properties as a [[CType]].
 */

export function decompress(cType: CompressedCType): ICType {
  if (!Array.isArray(cType) || cType.length !== 3) {
    throw SDKErrors.ERROR_DECOMPRESSION_ARRAY('CType')
  }
  return {
    hash: cType[0],
    owner: cType[1],
    schema: decompressSchema(cType[2]),
  }
}

/**
 * Validates an array of [[CType]]s against a [[Claim]].
 *
 * @param cType - A [[CType]] that has nested [[CType]]s inside.
 * @param nestedCTypes - An array of [[CType]] schemas.
 * @param claimContents - The contents of a [[Claim]] to be validated.
 * @param messages
 *
 * @returns Whether the contents is valid.
 */

export function validateNestedSchemas(
  cType: ICType['schema'],
  nestedCTypes: Array<ICType['schema']>,
  claimContents: Record<string, any>,
  messages?: string[]
): boolean {
  const ajv = new Ajv()
  ajv.addMetaSchema(CTypeModel)
  const validate = ajv.addSchema(nestedCTypes).compile(cType)
  const result = validate(claimContents)
  if (!result && ajv.errors) {
    if (messages) {
      ajv.errors.forEach((error: Ajv.ErrorObject) => {
        if (typeof error.message === 'string') {
          messages.push(error.message)
        }
      })
    }
  }
  return !!result
}

export default {
  compress,
  compressSchema,
  decompressSchema,
  decompress,
  errorCheck,
  verifyClaimStructure,
  verifySchema,
  verifySchemaWithErrors,
  verifyStored,
  verifyOwner,
  getHashForSchema,
  getIdForSchema,
  validateNestedSchemas,
}
