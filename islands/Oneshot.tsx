import { useEffect, useState } from "preact/hooks";
import { Blockfrost, Constr, Data, fromText, Lucid } from "lucid/mod.ts";
 
import { Input } from "../components/Input.tsx";
import { Button } from "../components/Button.tsx";
import { AppliedValidators, applyParams, Validators } from "../utils.ts";

export interface OneshotProps {
  validators: Validators;
}
 
export default function Oneshot({ validators }: OneshotProps) {
  const [lucid, setLucid] = useState<Lucid | null>(null);
  const [blockfrostAPIKey, setBlockfrostAPIKey] = useState<string>("");
  const [tokenName, setTokenName] = useState<string>("");
  const [parameterizedContracts, setParameterizedContracts] =
    useState<AppliedValidators | null>(null);
  const [stakingADA, setStakingADA] = useState<string | undefined>();
  const [lockTxHash, setLockTxHash] = useState<string | undefined>(undefined);
  const [waitingLockTx, setWaitingLockTx] = useState<boolean>(false);
  const [unlockTxHash, setUnlockTxHash] = useState<string | undefined>(
    undefined
  );
  const [waitingUnlockTx, setWaitingUnlockTx] = useState<boolean>(false); 
 
  const setupLucid = async (e: Event) => {
    e.preventDefault();
 

    const lucid = await Lucid.new(
      new Blockfrost(
        "https://cardano-preview.blockfrost.io/api/v0",
        "previewfeElnTv5UiYXBFMzCrKjamFdOLDG5uE3"
      ),
      "Preview"
    );

    // lucid.selectWalletFromPrivateKey(await Deno.readTextFile("../owner.sk"));
    lucid.selectWalletFromPrivateKey("ed25519_sk1j8hp5tx47f2tkk986pwdkt4fm9mlrn53pk45dusekksmu04h54sqge53zp");
 
    setLucid(lucid);

    const utxos = await lucid?.wallet.getUtxos()!;
 
    const utxo = utxos[0];
    const outputReference = {
      txHash: utxo.txHash,
      outputIndex: utxo.outputIndex,
    };
 
    const contracts = applyParams(
      tokenName,
      outputReference,
      validators,
      lucid!
    );
 
    setParameterizedContracts(contracts);

    
  };
 
  useEffect(() => {
    if (lucid) {
      window.cardano.eternl.enable().then((wallet) => {
        lucid.selectWallet(wallet);
      });
    }
  }, [lucid]);
 
  const submitTokenName = async (e: Event) => {
    e.preventDefault();
 
    console.log("lucid", lucid);

    const utxos = await lucid?.wallet.getUtxos()!;

    console.log("utxos", utxos);
 
    const utxo = utxos[0];
    const outputReference = {
      txHash: utxo.txHash,
      outputIndex: utxo.outputIndex,
    };
 
    const contracts = applyParams(
      tokenName,
      outputReference,
      validators,
      lucid!
    );

    console.log("contracts", contracts);
 
    setParameterizedContracts(contracts);
  };
 
  const createStaking = async (e: Event) => {
    e.preventDefault();
 
    setWaitingLockTx(true);
 
    try {
      const lovelace = Number(stakingADA) * 1000000;
 
      const assetName = `${parameterizedContracts!.policyId}${fromText(
        tokenName
      )}`;
 
      // Action::Mint
      // This is how you build the redeemer for staking
      // when you want to perform the Mint action.
      const mintRedeemer = Data.to(new Constr(0, []));
 
      const utxos = await lucid?.wallet.getUtxos()!;
      const utxo = utxos[0];
 
      const tx = await lucid!
        .newTx()
        .collectFrom([utxo])
        // use the staking validator
        .attachMintingPolicy(parameterizedContracts!.staking_)
        // mint 1 of the asset
        .mintAssets(
          { [assetName]: BigInt(1) },
          // this redeemer is the first argument to the staking validator
          mintRedeemer
        )
        .payToContract(
          parameterizedContracts!.lockAddress,
          {
            // On unlock this gets passed to the redeem
            // validator as datum. Our redeem validator
            // doesn't use it so we can just pass in anything.
            inline: Data.void(),
          },
          { lovelace: BigInt(lovelace) }
        )
        .complete();
 
      const txSigned = await tx.sign().complete();
 
      const txHash = await txSigned.submit();
 
      const success = await lucid!.awaitTx(txHash);
 
      // Wait a little bit longer so ExhaustedUTxOError doesn't happen
      // in the next Tx
      setTimeout(() => {
        setWaitingLockTx(false);
 
        if (success) {
          setLockTxHash(txHash);
        }
      }, 3000);
    } catch {
      setWaitingLockTx(false);
    }
  };

  const redeemStaking = async (e: Event) => {
    e.preventDefault();
 
    setWaitingUnlockTx(true);
 
    try {
      // get the utxos at the redeem validator's address
      const utxos = await lucid!.utxosAt(parameterizedContracts!.lockAddress);
 
      const assetName = `${parameterizedContracts!.policyId}${fromText(
        tokenName
      )}`;
 
      // Action::Burn
      // This is how you build the redeemer for staking
      // when you want to perform the Burn action.
      const burnRedeemer = Data.to(new Constr(1, []));
 
      const tx = await lucid!
        .newTx()
        .collectFrom(
          utxos,
          // This is the second argument to the redeem validator
          // and we also don't do anything with it similar to the
          // inline datum. It's fine to pass in anything in this case.
          Data.void()
        )
        // use the staking validator again
        .attachMintingPolicy(parameterizedContracts!.staking_)
        // use the redeem validator
        .attachSpendingValidator(parameterizedContracts!.redeem)
        .mintAssets(
          // notice the negative one here
          { [assetName]: BigInt(-1) },
          // this redeemer is the first argument to the staking validator
          burnRedeemer
        )
        .complete();
 
      const txSigned = await tx.sign().complete();
 
      const txHash = await txSigned.submit();
 
      const success = await lucid!.awaitTx(txHash);
 
      setWaitingUnlockTx(false);
 
      if (success) {
        setUnlockTxHash(txHash);
      }
    } catch {
      setWaitingUnlockTx(false);
    }
  };

  return (
    <div>
      {!lucid ? (
        <form class="mt-10 grid grid-cols-1 gap-y-8" onSubmit={setupLucid}>
          {/* <Input
            type="text"
            id="blockfrostAPIKey"
            value="previewfeElnTv5UiYXBFMzCrKjamFdOLDG5uE3"
            onInput={(e) => setBlockfrostAPIKey(e.currentTarget.value)}
          >
            Blockfrost API Key
          </Input> */}
 
          <Button type="submit">Setup Lucid</Button>
        </form>
      ) : (
        <form class="mt-10 grid grid-cols-1 gap-y-8" onSubmit={submitTokenName}>
          <Input
            type="text"
            name="tokenName"
            id="tokenName"
            value={tokenName}
            onInput={(e) => setTokenName(e.currentTarget.value)}
          >
            NFT Name
          </Input>
 
          {tokenName && <Button type="submit">Make Contracts</Button>}
        </form>
      )}

      {lucid && parameterizedContracts && (
        <>
          <h3 class="mt-4 mb-2">Redeem</h3>
          <pre class="bg-gray-200 p-2 rounded overflow-x-scroll">
            {parameterizedContracts.redeem.script}
          </pre>
 
          <h3 class="mt-4 mb-2">Staking</h3>
          <pre class="bg-gray-200 p-2 rounded overflow-x-scroll">
            {parameterizedContracts.staking_.script}
          </pre>

          <div class="mt-10 grid grid-cols-1 gap-y-8">
            <Input
              type="text"
              name="stakingADA"
              id="stakingADA"
              value={stakingADA}
              onInput={(e) => setStakingADA(e.currentTarget.value)}
            >
              Staking Amount
            </Input>
 
            <Button
              onClick={createStaking}
              disabled={waitingLockTx || !!lockTxHash}
            >
              {waitingLockTx
                ? "Waiting for Tx..."
                : "Create Staking (Locks Token)"}
            </Button>
 
            {lockTxHash && (
              <>
                <h3 class="mt-4 mb-2">Tokens Locked</h3>
 
                <a
                  class="mb-2"
                  target="_blank"
                  href={`https://preview.cardanoscan.io/transaction/${lockTxHash}`}
                >
                  {lockTxHash}
                </a>
                <Button
                  onClick={redeemStaking}
                  disabled={waitingLockTx || !!unlockTxHash}
                >
                  {waitingUnlockTx
                    ? "Waiting for Tx..."
                    : "Redeem Staking (Unlocks Token)"}
                </Button>
              </>
            )}

            {unlockTxHash && (
              <>
                <h3 class="mt-4 mb-2">Token Unlocked</h3>
 
                <a
                  class="mb-2"
                  target="_blank"
                  href={`https://preview.cardanoscan.io/transaction/${unlockTxHash}`}
                >
                  {unlockTxHash}
                </a>
              </>
            )}

          </div>

        </>
      )}
    </div>
  );
}