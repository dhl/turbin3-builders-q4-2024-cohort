import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Saipher } from "../target/types/saipher";
import { ConditionalPlugin } from "../target/types/conditional_plugin";
import {expect} from "chai";
import {Keypair, PublicKey, TransactionInstruction, TransactionMessage, VersionedTransaction} from "@solana/web3.js";
import {GovernanceConfig, SplGovernance} from "governance-idl-sdk";
import {createAssociatedTokenAccount, createMint, mintTo, mintToChecked} from "@solana/spl-token";
import BN from "bn.js";
import {createSetUpgradeAuthority} from "./utils/createSetUpgradeAuthority";
import {createAndConfirmTransaction} from "./utils/createAndConfirmTransaction";
import {createUpgradeInstruction} from "./utils/createUpgradeInstruction";
import {writeToBufferAccount} from "./utils/writeToBufferAccount";
import {fetchTransactionLogs} from "./utils/fetchTransactionLogs";

describe("saipher", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const wallet = anchor.Wallet.local();

  const program = anchor.workspace.Saipher as Program<Saipher>;
  const conditionalPlugin = anchor.workspace.ConditionalPlugin as Program<ConditionalPlugin>;

  const connection = program.provider.connection;
  const DISABLED_VOTER_WEIGHT = new BN("18446744073709551615")

  let communityToken: PublicKey;
  let councilToken: PublicKey;
  let realmId: PublicKey;
  let splGovernance: SplGovernance;
  let governanceId: PublicKey;
  let registrar: PublicKey;
  let nativeTreasuryId: PublicKey;

  it("Original program initialize logs 'Greetings from:'", async () => {
    console.log("⏳ Running original initialize instruction...");

    // ACT
    const tx = await program.methods.initialize().rpc({commitment: "confirmed"});
    console.log(`✅ original initialize instruction executed. Transaction Signature: ${tx}`);

    const originalProgramLogs = await fetchTransactionLogs(connection, tx);
    console.log("🔎 Original initialize instruction logs:");
    originalProgramLogs.forEach(log => console.log(`  | ${log}`));

    // ASSERT
    expect(originalProgramLogs.some(log => log.includes("Greetings from:"))).to.be.true;
  });

  it("Upgraded program initialize logs 'Greetings from:'", async () => {
    console.log()
    console.log("⏳ Creating DAO...");

    // ARRANGE
    splGovernance = new SplGovernance(connection);

    // Create community token
    communityToken = await createMint(
        connection, wallet.payer, wallet.publicKey, null, 0
    )

    console.log(`  - Created DAO community token: ${communityToken.toBase58()}`);

    // Create council token
    councilToken = await createMint(
        connection, wallet.payer, wallet.publicKey, null, 0
    )

    console.log(`  - Created DAO council token: ${councilToken.toBase58()}`);

    // The instruction Set
    let ixs: TransactionInstruction[] = [];

    console.log()
    // const realmName = `Test Realm ${Date.now()} ${Math.floor(Math.random() * 100000)}`;
    const realmName = `Test Realm`;
    realmId = splGovernance.pda.realmAccount({name: realmName}).publicKey;
    governanceId = splGovernance.pda.governanceAccount({realmAccount: realmId, seed: realmId}).publicKey;
    const nativeTreasuryId = splGovernance.pda.nativeTreasuryAccount({governanceAccount: governanceId}).publicKey;

    const createRealmIx = await splGovernance.createRealmInstruction(
        realmName,
        communityToken,
        DISABLED_VOTER_WEIGHT,
        wallet.publicKey,
        undefined,
        councilToken,
        "dormant",
        "liquid",
        undefined,
        undefined,
        conditionalPlugin.programId
    )
    ixs.push(createRealmIx)

    // Deposit Governing Token for each signer
    const depositGovTokenIx = await splGovernance.depositGoverningTokensInstruction(
        realmId,
        councilToken,
        councilToken,
        wallet.publicKey,
        wallet.publicKey,
        wallet.publicKey,
        1
    )
    ixs.push(depositGovTokenIx)

    const voteDuration = undefined
    const thresholdPercentage = 100

    // Governance Config
    const governanceConfig: GovernanceConfig = {
      communityVoteThreshold: { disabled: {} },
      minCommunityWeightToCreateProposal: DISABLED_VOTER_WEIGHT,
      minTransactionHoldUpTime: 0,
      // In seconds == 1 day, max time for approving transactions
      votingBaseTime: voteDuration ?? 86400,
      communityVoteTipping: { disabled: {} },
      // Approval quorum 60% = 2 of 3 to approve transactions
      councilVoteThreshold: { yesVotePercentage: [thresholdPercentage] },
      councilVetoVoteThreshold: { disabled: {} },
      // Anybody from the multisig can propose transactions
      minCouncilWeightToCreateProposal: 1,
      councilVoteTipping: { early: {} },
      communityVetoVoteThreshold: { disabled: {} },
      votingCoolOffTime: 0,
      depositExemptProposalCount: 254,
    };

    const createGovernanceIx = await splGovernance.createGovernanceInstruction(
        governanceConfig,
        realmId,
        wallet.publicKey,
        undefined,
        wallet.publicKey,
        realmId
    )
    ixs.push(createGovernanceIx)

    // SEND TX
    const createDaoTxSig = await createAndConfirmTransaction(connection, ixs, wallet.payer)
    console.log(`✅ Governance DAO setup completed! Transaction Signature: ${createDaoTxSig}`)
    console.log(`  - Realm Account: ${realmId.toBase58()}`);
    console.log(`  - Governance Account: ${governanceId.toBase58()}`);
    console.log(`  - Native Treasury Account: ${nativeTreasuryId.toBase58()}`);

    ixs = [];

    console.log();
    console.log("⏳ Finalizing adaptive governance setup...");

    [registrar] = PublicKey.findProgramAddressSync(
        [Buffer.from("registrar"), realmId.toBuffer(), councilToken.toBuffer()],
        conditionalPlugin.programId
    );

    // Create plugin registrar
    const registrarIx = await conditionalPlugin.methods
        .createRegistrar(false, new BN(100000))
        .accounts({
          realm: realmId,
          realmAuthority: wallet.publicKey,
          governingTokenMint: councilToken,
          communityTokenMint: communityToken,
          governanceProgramId: new PublicKey("GovER5Lthms3bLBqWub97yVrMmEogzX7xNjdXpPPCVZw"),
        })
        .rpc({commitment: "confirmed"});


    console.log(`✅ Registrar created! Transaction Signature: ${registrarIx}`);

    // Create an upgrade proposal

    console.log("Uploading new program to buffer account...");

    const bufferAccountAddress = await writeToBufferAccount("./tests/seasons_greetings.so", nativeTreasuryId.toBase58());
    console.log(`✅ New program uploaded to buffer address: ${bufferAccountAddress}`);

    // Set program upgrade authority
    const transferProgramUpgradeAuthIx = await createSetUpgradeAuthority(program.programId, wallet.publicKey, nativeTreasuryId);

    console.log("⏳ Transferring upgrade authority to native treasury")

    // Transfer realm authority to governance account
    const transferRealmAuthIx = await splGovernance.setRealmAuthorityInstruction(
        realmId,
        wallet.publicKey,
        "setChecked",
        governanceId
    )
    ixs.push(
        transferProgramUpgradeAuthIx,
        transferRealmAuthIx
    )

    const transferAuthorityTxSig = await createAndConfirmTransaction(connection, ixs, wallet.payer)

    ixs = [];

    // Check if the program upgrade authority is set to the native treasury
    const bpfUpgradableLoaderId = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");

    const [programDataAddress] = PublicKey.findProgramAddressSync(
        [program.programId.toBuffer()],
        bpfUpgradableLoaderId
    );

    const programAccountInfo = await connection.getParsedAccountInfo(programDataAddress);
    // @ts-ignore
    const upgradeAuthority = programAccountInfo.value.data.parsed.info.authority;
    expect(upgradeAuthority).to.be.equal(nativeTreasuryId.toBase58());

    const voterWeightRecord = await conditionalPlugin.methods
        .createVoterWeightRecord(wallet.publicKey)
        .accounts({
          registrar
        })
        .rpc({commitment: "confirmed"});

    console.log(`✅ Registrar and voter weight record created! Transaction Signature: ${voterWeightRecord}`);

    // Create a proposal
    console.log("⏳ Creating proposal...");

    const proposalSeed = Keypair.generate().publicKey

    const proposalId = splGovernance.pda.proposalAccount({
      governanceAccount: governanceId,
      governingTokenMint: councilToken,
      proposalSeed
    }).publicKey

    const tokenOwnerRecordAccount =  splGovernance.pda.tokenOwnerRecordAccount({
      realmAccount: realmId,
      governingTokenMintAccount: councilToken,
      governingTokenOwner: wallet.publicKey
    })

    const [voterWeightRecordPubkey] = PublicKey.findProgramAddressSync(
        [Buffer.from("voter-weight-record"), realmId.toBuffer(), councilToken.toBuffer(), wallet.publicKey.toBuffer()],
        conditionalPlugin.programId
    );

    console.log(`Voter Weight Record: ${voterWeightRecordPubkey.toBase58()}`)

    const createProposalIx = await splGovernance.createProposalInstruction(
        "Test Proposal",
        '',
        {choiceType: "single", multiChoiceOptions: null},
        ['Approve'],
        true,
        realmId,
        governanceId,
        tokenOwnerRecordAccount.publicKey,
        councilToken,
        wallet.publicKey,
        wallet.publicKey,
        proposalSeed,
        voterWeightRecordPubkey
    )

    const programUpgradeIx = await createUpgradeInstruction(
        program.programId,
        new PublicKey(bufferAccountAddress),
        nativeTreasuryId,
        nativeTreasuryId
    );

    const insertTxIx = await splGovernance.insertTransactionInstruction(
        [programUpgradeIx],
        0,
        0,
        0,
        governanceId,
        proposalId,
        tokenOwnerRecordAccount.publicKey,
        wallet.publicKey,
        wallet.publicKey
    )

    const signOffProposalIx = await splGovernance.signOffProposalInstruction(
        realmId,
        governanceId,
        proposalId,
        wallet.publicKey,
        tokenOwnerRecordAccount.publicKey
    )

    const updateVoterWeightRecordIx = await conditionalPlugin.methods
        .updateVoterWeightRecord()
        .accounts({
          registrar,
          inputVoterWeight: tokenOwnerRecordAccount.publicKey,
          voterWeightRecord: voterWeightRecordPubkey,
          communityTokenMint: communityToken
        })
        .instruction();

    ixs.push(
        updateVoterWeightRecordIx, createProposalIx, insertTxIx, signOffProposalIx
    )

    const createProposalSig = await createAndConfirmTransaction(connection, ixs, wallet.payer)
    console.log(`✅ Proposal created! Transaction Signature: ${createProposalSig}`)

    console.log("⏳ Voting for proposal...");

    ixs = [];

    const skipApprove = false

    if (!skipApprove) {
      const updateVoterWeightRecordIx = await conditionalPlugin.methods
          .updateVoterWeightRecord()
          .accounts({
            registrar,
            inputVoterWeight: tokenOwnerRecordAccount.publicKey,
            voterWeightRecord: voterWeightRecordPubkey,
            communityTokenMint: communityToken
          })
          .instruction();

      const castVoteIx = await splGovernance.castVoteInstruction(
          {approve: [[{rank: 0, weightPercentage: 100}]]},
          realmId,
          governanceId,
          proposalId,
          tokenOwnerRecordAccount.publicKey,
          tokenOwnerRecordAccount.publicKey,
          wallet.publicKey,
          councilToken,
          wallet.publicKey,
          voterWeightRecordPubkey
      )

      ixs.push(updateVoterWeightRecordIx, castVoteIx)

      const castVoteSig = await createAndConfirmTransaction(connection, ixs, wallet.payer)
      console.log(`✅ Voted for proposal! Transaction Signature: ${castVoteSig}`)
    }


    console.log();
    console.log("⏳ Checking upgraded initialize instruction...");


    // check proposal status
    const proposal = await splGovernance.getProposalByPubkey(proposalId);
    expect(proposal.state).to.haveOwnProperty("succeeded");

    const proposalTxId = splGovernance.pda.proposalTransactionAccount({
      proposal: proposalId,
      optionIndex: 0,
      index: 0
    }).publicKey

    // Wait for a second
    await new Promise(resolve => setTimeout(resolve, 2000));

    const proposalTxAccount = await splGovernance.getProposalTransactionByPubkey(proposalTxId)

    // execute proposal
    const accountsForIx = proposalTxAccount.instructions[0].accounts
    accountsForIx.unshift({
      pubkey: proposalTxAccount.instructions[0].programId,
      isSigner: false,
      isWritable: false
    })

    accountsForIx.forEach(account => {
      if (account.pubkey.equals(nativeTreasuryId)) {
        account.isSigner = false
      }
    })

    const executeTxIx = await splGovernance.executeTransactionInstruction(
        governanceId,
        proposalId,
        proposalTxId,
        accountsForIx
    )

    const execSig = await createAndConfirmTransaction(connection, [executeTxIx], wallet.payer)

    console.log(`✅ Proposed transaction executed! Transaction Signature: ${execSig}`)

    // wait for a second
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log();

    console.log("⏳ Running upgraded initialize instruction...");

    const upgradedProgram = new Program(program.idl, provider);
    const upgradedInitTxSig = await upgradedProgram.methods.initialize().rpc({commitment: "confirmed"});
    console.log(`✅ Upgraded initialize instruction executed. Transaction Signature: ${upgradedInitTxSig}`);

    const upgradedProgramLogs = await fetchTransactionLogs(connection, upgradedInitTxSig);
    console.log("⏳ Upgraded initialize instruction logs:");
    upgradedProgramLogs.forEach(log => console.log(`  | ${log}`));
  });

  it("Mint 500,000 community token to trigger governance condition", async () => {
    console.log()
    console.log("⏳ Minting 500,000 community token to trigger governance condition...");

    const ata = await createAssociatedTokenAccount(
        connection, // connection
        wallet.payer, // fee payer
        communityToken, // mint
        wallet.publicKey, // owner,
    );

    await mintToChecked(
        connection,
        wallet.payer,
        communityToken,
        ata,
        wallet.publicKey,
        500_000,
        0
    );

    // balance check
    const balance = await connection.getTokenAccountBalance(ata);
    expect(balance.value.uiAmount).to.be.equal(500000);

    console.log(`✅ Minted 500,000 community token!`);
  });

  it("Should not allow Dev Team to update the program after communinty token supply exceeds 500,000", async () => {
    console.log()
    console.log("⏳ Attempting to update the program after community token supply exceeds 500,000...");

    const bufferAccountAddress = await writeToBufferAccount("./tests/seasons_greetings.so", communityToken.toBase58());

    const upgradeProgramIx = await createUpgradeInstruction(
        program.programId,
        new PublicKey(bufferAccountAddress),
        wallet.publicKey,
        wallet.publicKey
    );

    console.log(`✅ New program uploaded to buffer address: ${bufferAccountAddress}`);

    console.log("Creating proposal...");

    const proposalSeed = Keypair.generate().publicKey

    const proposalId = splGovernance.pda.proposalAccount({
      governanceAccount: governanceId,
      governingTokenMint: councilToken,
      proposalSeed
    }).publicKey

    const tokenOwnerRecordAccount =  splGovernance.pda.tokenOwnerRecordAccount({
      realmAccount: realmId,
      governingTokenMintAccount: councilToken,
      governingTokenOwner: wallet.publicKey
    })

    const [voterWeightRecordPubkey] = PublicKey.findProgramAddressSync(
        [Buffer.from("voter-weight-record"), realmId.toBuffer(), councilToken.toBuffer(), wallet.publicKey.toBuffer()],
        conditionalPlugin.programId
    );

    let ixs: TransactionInstruction[] = [];

    const createProposalIx = await splGovernance.createProposalInstruction(
        "Test Proposal",
        '',
        {choiceType: "single", multiChoiceOptions: null},
        ['Approve'],
        true,
        realmId,
        governanceId,
        tokenOwnerRecordAccount.publicKey,
        councilToken,
        wallet.publicKey,
        wallet.publicKey,
        proposalSeed,
        voterWeightRecordPubkey
    )

    const programUpgradeIx = await createUpgradeInstruction(
        program.programId,
        new PublicKey(bufferAccountAddress),
        nativeTreasuryId,
        nativeTreasuryId
    );

    const insertTxIx = await splGovernance.insertTransactionInstruction(
        [programUpgradeIx],
        0,
        0,
        0,
        governanceId,
        proposalId,
        tokenOwnerRecordAccount.publicKey,
        wallet.publicKey,
        wallet.publicKey
    )

    const signOffProposalIx = await splGovernance.signOffProposalInstruction(
        realmId,
        governanceId,
        proposalId,
        wallet.publicKey,
        tokenOwnerRecordAccount.publicKey
    )

    const updateVoterWeightRecordIx = await conditionalPlugin.methods
        .updateVoterWeightRecord()
        .accounts({
          registrar,
          inputVoterWeight: tokenOwnerRecordAccount.publicKey,
          voterWeightRecord: voterWeightRecordPubkey,
          communityTokenMint: communityToken
        })
        .instruction();

    ixs.push(
        updateVoterWeightRecordIx, createProposalIx, insertTxIx, signOffProposalIx
    )

    try {
      await createAndConfirmTransaction(connection, ixs, wallet.payer)
      throw new Error("Creating upgrade proposal should have failed ");
    } catch (e) {
        console.log(`✅ Proposal creation failed as expected: ${e.message}`);
    }
  });
});
