import { computed } from "vue";
import { useAnchorWallet } from "solana-wallets-vue";
import { Connection, PublicKey } from "@solana/web3.js";
import { Program, AnchorProvider } from "@project-serum/anchor";
import idl from "../../../target/idl/twitter_solana.json";

const preflightCommitment = "processed";
const commitment = "processed";
const programID = new PublicKey(idl.metadata.address);
let workspace = {
  wallet: null,
  connection: null,
  program: null,
  provider: null,
};

export const useWorkspace = () => workspace;

export const initWorkspace = () => {
  const wallet = useAnchorWallet();
  const connection = new Connection("http://127.0.0.1:8899", commitment);
  const provider = computed(
    () =>
      new AnchorProvider(connection, wallet.value, {
        preflightCommitment,
        commitment,
      })
  );
  const program = computed(() => new Program(idl, programID, provider.value));

  workspace = {
    wallet,
    connection,
    provider,
    program,
  };
};
