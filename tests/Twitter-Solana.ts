import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { TwitterSolana } from "../target/types/twitter_solana";
import * as assert from "assert";
import * as bs58 from "bs58";

describe("Twitter-Solana", () => {
    // Configure the client to use the local cluster.
    anchor.setProvider(anchor.AnchorProvider.env());

    const program = anchor.workspace.TwitterSolana as Program<TwitterSolana>;

    const sendTweet = async (author, topic, content) => {
        const tweet = anchor.web3.Keypair.generate();
        await program.methods
            .sendTweet(topic, content)
            .accounts({
                tweet: tweet.publicKey,
                author,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([tweet])
            .rpc();

        return tweet;
    };

    it("Can send a new tweet", async () => {
        const tweetAccount = anchor.web3.Keypair.generate();
        await program.methods
            .sendTweet("topic", "content")
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
        assert.equal(tweetAccountFetched.topic, "topic");
        assert.equal(tweetAccountFetched.content, "content");
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

    it("Can fetch all tweets", async () => {
        const tweetAccounts = await program.account.tweet.all();
        assert.equal(tweetAccounts.length, 3);
    });

    it("can filter tweets by author", async () => {
        const authorPublicKey = program.provider.publicKey;
        const tweetAccounts = await program.account.tweet.all([
            {
                memcmp: {
                    offset: 8, // Discriminator.
                    bytes: authorPublicKey.toBase58(),
                },
            },
        ]);

        assert.equal(tweetAccounts.length, 2);
        assert.ok(
            tweetAccounts.every((tweetAccount) => {
                return (
                    tweetAccount.account.author.toBase58() ===
                    authorPublicKey.toBase58()
                );
            })
        );
    });

    it("can filter tweets by topics", async () => {
        const tweetAccounts = await program.account.tweet.all([
            {
                memcmp: {
                    offset:
                        8 + // Discriminator.
                        32 + // Author public key.
                        8 + // Timestamp.
                        4, // Topic string prefix.
                    bytes: bs58.encode(Buffer.from("topic")),
                },
            },
        ]);

        assert.equal(tweetAccounts.length, 2);
        assert.ok(
            tweetAccounts.every((tweetAccount) => {
                return tweetAccount.account.topic === "topic";
            })
        );
    });

    it("Can update a tweet", async () => {
        const author = program.provider.publicKey;
        const tweet = await sendTweet(author, "hello topic", "hello content");
        const tweetFetched = await program.account.tweet.fetch(tweet.publicKey);

        assert.equal(tweetFetched.topic, "hello topic");
        assert.equal(tweetFetched.content, "hello content");

        await program.methods
            .updateTweet("goodbye topic", "goodbye content")
            .accounts({ tweet: tweet.publicKey, author })
            .rpc();
        const tweetUpdated = await program.account.tweet.fetch(tweet.publicKey);

        assert.equal(tweetUpdated.topic, "goodbye topic");
        assert.equal(tweetUpdated.content, "goodbye content");
    });

    it("Cannot update a tweet of another author", async () => {
        const author = program.provider.publicKey;
        const tweet = await sendTweet(author, "hello topic", "hello content");

        const notAuthor = anchor.web3.Keypair.generate();
        try {
            await program.methods
                .updateTweet("goodbye topic", "goodbye content")
                .accounts({
                    tweet: tweet.publicKey,
                    author: notAuthor.publicKey,
                })
                .signers([notAuthor])
                .rpc();
            assert.fail("Cannot update tweet of another author");
        } catch (error) {
            const tweetFetched = await program.account.tweet.fetch(
                tweet.publicKey
            );
            assert.equal(tweetFetched.topic, "hello topic");
            assert.equal(tweetFetched.content, "hello content");
        }
    });

    it("Can delete a tweet", async () => {
        const author = program.provider.publicKey;
        const tweet = await sendTweet(author, "hello topic", "hello content");

        await program.methods
            .deleteTweet()
            .accounts({ tweet: tweet.publicKey, author })
            .rpc();

        const tweetFetched = await program.account.tweet.fetchNullable(
            tweet.publicKey
        );
        assert.ok(tweetFetched === null);
    });

    it("Cannot delete a tweet of another author", async () => {
        const author = program.provider.publicKey;
        const tweet = await sendTweet(author, "hello topic", "hello content");

        const notAuthor = anchor.web3.Keypair.generate();
        try {
            await program.methods
                .deleteTweet()
                .accounts({
                    tweet: tweet.publicKey,
                    author: notAuthor.publicKey,
                })
                .signers([notAuthor])
                .rpc();
            assert.fail("Cannot delete tweet of another author");
        } catch (error) {
            const tweetFetched = await program.account.tweet.fetch(
                tweet.publicKey
            );
            assert.equal(tweetFetched.topic, "hello topic");
            assert.equal(tweetFetched.content, "hello content");
        }
    });
});
