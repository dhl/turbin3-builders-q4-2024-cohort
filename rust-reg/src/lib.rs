mod programs;

#[cfg(test)]
mod tests {
    use bs58;
    use solana_client::rpc_client::RpcClient;
    use solana_sdk::{
        pubkey::Pubkey,
        signature::{read_keypair_file, Keypair, Signer},
    };
    use std::fs;
    use std::io::{self, BufRead};
    use std::path::Path;

    const RPC_URL: &str = "https://api.devnet.solana.com";

    #[test]
    #[ignore]
    fn keygen() {
        let wallet_path = "./dev-wallet.json";

        if Path::new(wallet_path).exists() {
            println!("Wallet file already exists. Skipping keygen.");
            return;
        }

        let kp = Keypair::new();
        println!(
            "You've generated a new Solana wallet: {}",
            kp.pubkey().to_string()
        );
        println!();
        println!("To save yuor wallet, copy and paste the following into a JSON file:");
        println!("{:?}", kp.to_bytes());
    }

    #[test]
    #[ignore]
    fn base58_to_wallet() {
        println!("Input your private key as base58:");
        let stdin = io::stdin();
        let base58 = stdin.lock().lines().next().unwrap().unwrap();
        println!("Your wallet file is:");
        let wallet = bs58::decode(base58).into_vec().unwrap();

        println!("{:?}", wallet);
    }

    #[test]
    #[ignore]
    fn wallet_to_base58() {
        let wallet: Vec<u8> = fs::read_to_string("./dev-wallet.json")
            .unwrap()
            .trim()
            .trim_start_matches("[")
            .trim_end_matches("]")
            .split(",")
            .map(|s| s.trim().parse::<u8>().unwrap())
            .collect();

        let base58 = bs58::encode(wallet).into_string();

        println!("Your private key is: {:?}", base58);
    }

    #[test]
    #[ignore]
    fn airdrop() {
        let keypair = read_keypair_file("./dev-wallet.json").expect("Couldn't find wallet file");
        let client = RpcClient::new(RPC_URL);

        match client.request_airdrop(&keypair.pubkey(), 2_000_000_000_u64) {
            Ok(s) => {
                println!("Success! Check out your TX here:");
                println!(
                    "https://explorer.solana.com/tx/{}?cluster=devnet",
                    s.to_string()
                );
            }
            Err(e) => {
                println!("Error: {:?}", e.to_string());
            }
        }
    }

    #[test]
    #[ignore]
    fn transfer_sol() {
        use solana_program::{pubkey::Pubkey, system_instruction::transfer};
        use solana_sdk::{
            message::Message,
            signature::{read_keypair_file, Keypair, Signer},
            transaction::Transaction,
        };
        use std::str::FromStr;

        let keypair = read_keypair_file("./dev-wallet.json").expect("Couldn't find wallet file");
        let to_pubkey = Pubkey::from_str("6haGvH6crjLQ7byiZyBXLwBvhgxTStuSgNYfhFKBUdy2").unwrap();

        let rpc_client = RpcClient::new(RPC_URL);

        let recent_blockhash = rpc_client
            .get_latest_blockhash()
            .expect("Couldn't get recent blockhash");

        let transaction = Transaction::new_signed_with_payer(
            &[transfer(&keypair.pubkey(), &to_pubkey, 1_000_000)],
            Some(&keypair.pubkey()),
            &vec![&keypair],
            recent_blockhash,
        );

        let signature = rpc_client
            .send_and_confirm_transaction(&transaction)
            .expect("Failed to send transaction");

        println!(
            "Success! Check out your TX here: https://explorer.solana.com/tx/{}?cluster=devnet",
            signature
        );

        let balance = rpc_client
            .get_balance(&keypair.pubkey())
            .expect("Failed to get balance");

        let message = Message::new_with_blockhash(
            &[transfer(&keypair.pubkey(), &to_pubkey, balance)],
            Some(&keypair.pubkey()),
            &recent_blockhash,
        );

        let fee = rpc_client
            .get_fee_for_message(&message)
            .expect("Failed to get fee calculator");

        let transaction = Transaction::new_signed_with_payer(
            &[transfer(&keypair.pubkey(), &to_pubkey, balance - fee)],
            Some(&keypair.pubkey()),
            &vec![&keypair],
            recent_blockhash,
        );

        let signature = rpc_client
            .send_and_confirm_transaction(&transaction)
            .expect("Failed to send transaction");

        println!(
            "Success! Check out your TX here: https://explorer.solana.com/tx/{}?cluster=devnet",
            signature
        );
    }

    #[test]
    fn enroll() {
        use crate::programs::Turbin3_prereq::{CompleteArgs, WbaPrereqProgram};
        use solana_program::system_program;

        let rpc_client = RpcClient::new(RPC_URL);
        let signer = read_keypair_file("./Turbin3-wallet.json").expect("Couldn't find wallet file");

        let prereq = WbaPrereqProgram::derive_program_address(&[
            b"prereq",
            signer.pubkey().to_bytes().as_ref(),
        ]);

        let args = CompleteArgs {
            github: b"dhl".to_vec(),
        };

        let blockhash = rpc_client
            .get_latest_blockhash()
            .expect("Couldn't get recent blockhash");

        let transaction = WbaPrereqProgram::complete(
            &[&signer.pubkey(), &prereq, &system_program::id()],
            &args,
            Some(&signer.pubkey()),
            &[&signer],
            blockhash,
        );

        let signature = rpc_client
            .send_and_confirm_transaction(&transaction)
            .expect("Failed to send transaction");

        println!(
            "Success! Check out your TX here: https://explorer.solana.com/tx/{}?cluster=devnet",
            signature
        );
    }
}
