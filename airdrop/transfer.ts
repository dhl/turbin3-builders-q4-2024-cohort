import {
  Transaction,
  SystemProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
  PublicKey, clusterApiUrl
} from "@solana/web3.js";

import wallet from "./dev-wallet.json";

async function main() {
  const from = Keypair.fromSecretKey(new Uint8Array(wallet));
  const to = new PublicKey("6haGvH6crjLQ7byiZyBXLwBvhgxTStuSgNYfhFKBUdy2");

  const connection = new Connection(clusterApiUrl("devnet"), 'confirmed');

  // const transaction = new Transaction().add(
  //   SystemProgram.transfer({
  //     fromPubkey: from.publicKey,
  //     toPubkey: to,
  //     lamports: LAMPORTS_PER_SOL/100,
  //   })
  // );
  //
  // // updated from instruction
  // transaction.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  //
  // // Sign transaction, broadcast, and confirm
  // const signature = await sendAndConfirmTransaction(
  //   connection,
  //   transaction,
  //   [from]
  // );
  //
  // console.log(`Success! Check out your transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

  const balance = await connection.getBalance(from.publicKey);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports: balance,
    })
  );

  transaction.recentBlockhash = (await connection.getLatestBlockhash("confirmed")).blockhash;
  transaction.feePayer = from.publicKey;

  const fee = (await connection.getFeeForMessage(transaction.compileMessage(), "confirmed")).value || 0;

  transaction.instructions.pop();

  transaction.add(
    SystemProgram.transfer({
      fromPubkey: from.publicKey,
      toPubkey: to,
      lamports: balance - fee,
    })
  );

  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [from]
  );

  console.log(`Success! Check out your transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
}

main().catch(error => {
  console.error("Oops, something went wrong:");
  console.error(error);
  process.exit(-1);
})
