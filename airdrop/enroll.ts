import {clusterApiUrl, Connection, Keypair, PublicKey} from "@solana/web3.js";
import { Program, Wallet, AnchorProvider } from "@coral-xyz/anchor";
import { IDL, Turbin3Prereq } from "./programs/Turbin3_prereq";
import wallet from "./Turbin3-wallet.json";

async function main() {
  const keypair = Keypair.fromSecretKey(new Uint8Array(wallet));

  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  const github = Buffer.from("dhl", "utf-8");
  const provider = new AnchorProvider(connection, new Wallet(keypair), {commitment: "confirmed"});

  const program : Program<Turbin3Prereq> = new Program(IDL, provider);

  const enrollment_seeds = [Buffer.from("prereq"), keypair.publicKey.toBuffer()];
  const [enrollment_key, _bump] = PublicKey.findProgramAddressSync(enrollment_seeds, program.programId);

  const txHash = await program.methods
    .complete(github)
    .accounts({
      signer: keypair.publicKey
    })
    .signers([keypair])
    .rpc();

  console.log(`Success! Check out your transaction: https://explorer.solana.com/tx/${txHash}?cluster=devnet`);

  console.log(`Enrollment key: ${enrollment_key.toBase58()}`);
}

main().catch(error => {
  console.error("Oops, something went wrong:");
  console.error(error);
  process.exit(-1);
});
