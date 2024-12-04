import {Connection, TransactionInstruction, TransactionMessage, VersionedTransaction, Signer} from "@solana/web3.js";

export async function createAndConfirmTransaction(connection: Connection, ixs: TransactionInstruction[], payer: Signer) {
    const recentBlockhash = await connection.getLatestBlockhash({
        commitment: "confirmed"
    })

    const txMessage = new TransactionMessage({
        payerKey: payer.publicKey,
        instructions: ixs,
        recentBlockhash: recentBlockhash.blockhash
    }).compileToV0Message()

    const tx = new VersionedTransaction(txMessage)
    tx.sign([payer])

    const sig = await connection.sendRawTransaction(tx.serialize())

    await connection.confirmTransaction(
        {
            signature: sig,
            blockhash: recentBlockhash.blockhash,
            lastValidBlockHeight: recentBlockhash.lastValidBlockHeight
        },
        "confirmed"
    )

    return sig
}
