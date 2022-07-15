import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { TwitterSolana } from "../target/types/twitter_solana";

describe("Twitter-Solana", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TwitterSolana as Program<TwitterSolana>;

  it("Is initialized!", async () => {
    // Add your test here.
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });
});
