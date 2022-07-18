import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { TwitterSolana } from "../target/types/twitter_solana";
import * as assert from "assert";

describe("Twitter-Solana", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.TwitterSolana as Program<TwitterSolana>;

  it("Can send a new tweet", async () => {
    const tweetAccount = anchor.web3.Keypair.generate();
    await program.methods
      .sendTweet("TOPIC HERE", "CONTENT HERE")
      .accounts({
        tweet: tweetAccount.publicKey,
        author: program.provider.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([tweetAccount])
      .rpc();

    const tweetAccountFetched = await program.account.tweet.fetch(
      tweetAccount.publicKey
    );
    // console.log(tweetAccountFetched);

    assert.equal(
      tweetAccountFetched.author.toBase58(),
      program.provider.publicKey.toBase58()
    );
    assert.equal(tweetAccountFetched.topic, "TOPIC HERE");
    assert.equal(tweetAccountFetched.content, "CONTENT HERE");
    assert.ok(tweetAccountFetched.timestamp);
  });

  it("Can send a new tweet without a topic", async () => {
    const tweetAccount = anchor.web3.Keypair.generate();
    await program.methods
      .sendTweet("", "gm")
      .accounts({
        tweet: tweetAccount.publicKey,
        author: program.provider.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([tweetAccount])
      .rpc();

    const tweetAccountFetched = await program.account.tweet.fetch(
      tweetAccount.publicKey
    );

    assert.equal(
      tweetAccountFetched.author.toBase58(),
      program.provider.publicKey.toBase58()
    );
    assert.equal(tweetAccountFetched.topic, "");
    assert.equal(tweetAccountFetched.content, "gm");
    assert.ok(tweetAccountFetched.timestamp);
  });

  it("Can send a new tweet from a different author", async () => {
    const otherAuthor = anchor.web3.Keypair.generate();
    const tweetAccount = anchor.web3.Keypair.generate();

    // Request and confirm some lamports airdrop for the other author.
    const connection = program.provider.connection;
    const signature = await connection.requestAirdrop(
      otherAuthor.publicKey,
      1000000000
    );
    const latestBlockHash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      blockhash: latestBlockHash.blockhash,
      lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
      signature: signature,
    });

    await program.methods
      .sendTweet("topic", "content")
      .accounts({
        tweet: tweetAccount.publicKey,
        author: otherAuthor.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([otherAuthor, tweetAccount])
      .rpc();

    const tweetAccountFetched = await program.account.tweet.fetch(
      tweetAccount.publicKey
    );

    assert.equal(
      tweetAccountFetched.author.toBase58(),
      otherAuthor.publicKey.toBase58()
    );
    assert.equal(tweetAccountFetched.topic, "topic");
    assert.equal(tweetAccountFetched.content, "content");
    assert.ok(tweetAccountFetched.timestamp);
  });

  it("Cannot send a tweet with a topic longer than 50 characters", async () => {
    try {
      const tweetAccount = anchor.web3.Keypair.generate();
      const topicWith51Chars = "x".repeat(51);
      await program.methods
        .sendTweet(topicWith51Chars, "Content")
        .accounts({
          tweet: tweetAccount.publicKey,
          author: program.provider.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([tweetAccount])
        .rpc();
    } catch (error) {
      assert.equal(error.error.errorCode.code, "TopicTooLong");
      return;
    }

    assert.fail(
      "The instruction should have failed with a 51-character topic."
    );
  });

  it("Cannot send a tweet with a content longer than 280 characters", async () => {
    try {
      const tweetAccount = anchor.web3.Keypair.generate();
      const contentWith281Chars = "x".repeat(281);
      await program.methods
        .sendTweet("Topic", contentWith281Chars)
        .accounts({
          tweet: tweetAccount.publicKey,
          author: program.provider.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([tweetAccount])
        .rpc();
    } catch (error) {
      assert.equal(error.error.errorCode.code, "ContentTooLong");
      return;
    }

    assert.fail(
      "The instruction should have failed with a 281-character content."
    );
  });
});
