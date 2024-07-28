import blueprint from "./plutus.json" assert { type: "json" };

import {
    applyDoubleCborEncoding,
    applyParamsToScript,
    Constr,
    fromText,
    Lucid,
    MintingPolicy,
    OutRef,
    SpendingValidator,
  } from "lucid/mod.ts";

export type Validators = {
  redeem: SpendingValidator;
  staking_: MintingPolicy;
};
 
export function readValidators(): Validators {
  const redeem = blueprint.validators.find((v) => v.title === "oneshot.redeem");
 
  if (!redeem) {
    throw new Error("Redeem validator not found");
  }
 
  const staking_ = blueprint.validators.find(
    (v) => v.title === "oneshot.staking"
  );
 
  if (!staking_) {
    throw new Error("Staking validator not found");
  }
 
  return {
    redeem: {
      type: "PlutusV2",
      script: redeem.compiledCode,
    },
    staking_: {
      type: "PlutusV2",
      script: staking_.compiledCode,
    },
  };
}

export type AppliedValidators = {
    redeem: SpendingValidator;
    staking_: MintingPolicy;
    policyId: string;
    lockAddress: string;
  };
   
  export function applyParams(
    tokenName: string,
    outputReference: OutRef,
    validators: Validators,
    lucid: Lucid
  ): AppliedValidators {
    const outRef = new Constr(0, [
      new Constr(0, [outputReference.txHash]),
      BigInt(outputReference.outputIndex),
    ]);
   
    const staking_ = applyParamsToScript(validators.staking_.script, [
      fromText(tokenName),
      outRef,
    ]);
   
    const policyId = lucid.utils.validatorToScriptHash({
      type: "PlutusV2",
      script: staking_,
    });
   
    const redeem = applyParamsToScript(validators.redeem.script, [
      fromText(tokenName),
      policyId,
    ]);
   
    const lockAddress = lucid.utils.validatorToAddress({
      type: "PlutusV2",
      script: redeem,
    });
   
    return {
      redeem: { type: "PlutusV2", script: applyDoubleCborEncoding(redeem) },
      staking_: { type: "PlutusV2", script: applyDoubleCborEncoding(staking_) },
      policyId,
      lockAddress,
    };
  }
  
  