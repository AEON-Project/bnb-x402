import { z } from "zod";

// Constants
const EvmAddressRegex = /^0x[0-9a-fA-F]{40}$/;
const HexEncoded64ByteRegex = /^0x[0-9a-fA-F]{64}$/;
const EvmSignatureRegex = /^0x[0-9a-fA-F]{130}$/;
// const HexRegex = /^0x[0-9a-fA-F]*$/; // For general hex validation (currently unused)

// Base Hex schema for reuse (currently unused but may be needed later)
// const HexSchema = z.string().regex(HexRegex);

// Parameter schemas
const EvmAuthorizationParametersSchema = z.object({
  from: z.string().regex(EvmAddressRegex),
  to: z.string().regex(EvmAddressRegex),
  value: z.bigint(),
  validAfter: z.bigint(),
  validBefore: z.bigint(),
  nonce: z.string().regex(HexEncoded64ByteRegex),
  version: z.string(),
});
export type EvmAuthorizationParameters = z.infer<
  typeof EvmAuthorizationParametersSchema
>;


const EvmAuthorizationPayloadSchema = z.object({
  type: z.literal("authorization"),
  signature: z.string().regex(EvmSignatureRegex),
  authorization: EvmAuthorizationParametersSchema,
});
export type EvmAuthorizationPayload = z.infer<
  typeof EvmAuthorizationPayloadSchema
>;

const EvmAuthorizationEip3009PayloadSchema = z.object({
  type: z.literal("authorizationEip3009"),
  signature: z.string().regex(EvmSignatureRegex),
  authorization: EvmAuthorizationParametersSchema,
});
export type EvmAuthorizationEip3009Payload = z.infer<
  typeof EvmAuthorizationEip3009PayloadSchema
>;



// Updated ExactEvmPayloadSchema as discriminated union
export const ExactEvmPayloadSchema = z.discriminatedUnion("type", [
  EvmAuthorizationPayloadSchema,
  EvmAuthorizationEip3009PayloadSchema,
]);

export type ExactEvmPayload = z.infer<typeof ExactEvmPayloadSchema>;

// Export individual schemas if needed
export {
  EvmAuthorizationPayloadSchema,
  EvmAuthorizationEip3009PayloadSchema,
  EvmAuthorizationParametersSchema,
};
