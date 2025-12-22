export const aeonAuthorizationTypes = {
  tokenTransferWithAuthorization: [
    { name: "token", type: "address" },
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
    { name: "needApprove", type: "bool" },
  ],
};

export const aeonAuthorizationPrimaryType = "tokenTransferWithAuthorization";
