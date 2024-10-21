import {clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL} from "@solana/web3.js";
import wallet from "./dev-wallet.json";


async function main() {
  const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));
  const connection = new Connection(clusterApiUrl("devnet"), 'confirmed');

  const txHash = await connection.requestAirdrop(keypair.publicKey, 2 * LAMPORTS_PER_SOL);
  console.log(`Success! Check out your transaction: https://explorer.solana.com/tx/${txHash}?cluster=devnet`);

}

main().catch(error => {
  console.error("Oops, something went wrong:");
  console.error(error);
  process.exit(-1);
})
