import * as anchor from "@coral-xyz/anchor";
import {BN, Program} from "@coral-xyz/anchor";
import {Vault} from "../target/types/vault";
import {PublicKey, LAMPORTS_PER_SOL} from "@solana/web3.js";
import {expect} from "chai";

describe("vault", () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env()
    anchor.setProvider(provider);

    const program = anchor.workspace.Vault as Program<Vault>;

    it("Is initialized successfully", async () => {
        const tx = await program.methods.initialize().rpc();
        console.log("Your transaction signature", tx);

        const [statePda, stateBump] = PublicKey.findProgramAddressSync([
            Buffer.from("state"),
            provider.wallet.publicKey.toBuffer()
        ], program.programId);

        const [_vaultPda, vaultBump] = PublicKey.findProgramAddressSync([
            Buffer.from("vault"),
            provider.wallet.publicKey.toBuffer()
        ], program.programId);

        const stateAccountInfo = await program.account.vaultState.fetch(statePda);

        expect(stateAccountInfo.stateBump).to.equal(stateBump);
        expect(stateAccountInfo.vaultBump).to.equal(vaultBump);
    });

    it("Handles deposit successfully", async () => {
        const depositAmount = 42 * LAMPORTS_PER_SOL;
        const tx = await program.methods.deposit(new BN(depositAmount)).rpc();
        console.log("Your transaction signature", tx);

        const [vaultPda] = PublicKey.findProgramAddressSync([
            Buffer.from("vault"),
            provider.wallet.publicKey.toBuffer()
        ], program.programId);

        const vaultBalance = await provider.connection.getBalance(vaultPda);
        expect(vaultBalance).to.equal(depositAmount);
    });

    it("Handles withdrawal successfully", async () => {
        const [vaultPda] = PublicKey.findProgramAddressSync([
            Buffer.from("vault"),
            provider.wallet.publicKey.toBuffer()
        ], program.programId);

        const initialUserBalance = await provider.connection.getBalance(provider.wallet.publicKey);
        const initialVaultBalance = await provider.connection.getBalance(vaultPda);

        const withdrawalAmount = 13 * LAMPORTS_PER_SOL;
        const tx = await program.methods.withdraw(new BN(withdrawalAmount)).transaction();
        const signature = await provider.sendAndConfirm(tx);
        console.log("Your transaction signature", signature);

        const fee = await provider.connection.getFeeForMessage(tx.compileMessage(), "confirmed");
        const vaultBalance = await provider.connection.getBalance(vaultPda);
        const userBalance = await provider.connection.getBalance(provider.wallet.publicKey);

        expect(vaultBalance).to.equal(initialVaultBalance - withdrawalAmount);
        expect(userBalance).to.equal(initialUserBalance + withdrawalAmount - fee.value);
    });

    it("Closes a vault account successfully", async () => {
        const [vaultPda] = PublicKey.findProgramAddressSync([
            Buffer.from("vault"),
            provider.wallet.publicKey.toBuffer()
        ], program.programId);

        const [statePda] = PublicKey.findProgramAddressSync([
            Buffer.from("state"),
            provider.wallet.publicKey.toBuffer()
        ], program.programId);

        const initialUserBalance = await provider.connection.getBalance(provider.wallet.publicKey);
        const initialVaultBalance = await provider.connection.getBalance(vaultPda);
        const initialStateBalance = await provider.connection.getBalance(statePda);

        const tx = await program.methods.close().transaction();
        const signature = await provider.sendAndConfirm(tx);
        console.log("Your transaction signature", signature);

        const fee = await provider.connection.getFeeForMessage(tx.compileMessage(), "confirmed");

        const vaultBalance = await provider.connection.getBalance(vaultPda);
        const userBalance = await provider.connection.getBalance(provider.wallet.publicKey);

        expect(vaultBalance).to.equal(0);
        expect(userBalance).to.equal(initialUserBalance + initialVaultBalance + initialStateBalance - fee.value);
    });

});
