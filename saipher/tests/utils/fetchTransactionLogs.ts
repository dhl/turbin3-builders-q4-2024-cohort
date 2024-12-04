import { Connection } from "@solana/web3.js";

export async function fetchTransactionLogs(connection: Connection, txSignature: string): Promise<string[]> {
    const transaction = await connection.getConfirmedTransaction(txSignature, "confirmed");
    return transaction.meta.logMessages ?? [];
}
