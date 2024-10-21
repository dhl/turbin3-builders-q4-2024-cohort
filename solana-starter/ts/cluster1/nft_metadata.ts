import wallet from "../wba-wallet.json"
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults"
import { createGenericFile, createSignerFromKeypair, signerIdentity } from "@metaplex-foundation/umi"
import { irysUploader } from "@metaplex-foundation/umi-uploader-irys"

// Create a devnet connection
const umi = createUmi('https://api.devnet.solana.com');

let keypair = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(wallet));
const signer = createSignerFromKeypair(umi, keypair);

umi.use(irysUploader());
umi.use(signerIdentity(signer));

(async () => {
    try {
        // Follow this JSON structure
        // https://docs.metaplex.com/programs/token-metadata/changelog/v1.0#json-structure

        const image =  "https://devnet.irys.xyz/32sq6rZVL9rhz8PSXyrUwomqthyR2EoiTGsbNvUi6aEa";
        const metadata = {
            name: "Magic Crypto Carpet",
            symbol: "MCC",
            description: "A magical carpet, generated from a SHA-256 hash",
            image: image,
            attributes: [
                {trait_type: 'Sexiness', value: '100'},
                {trait_type: 'Web3ness', value: '100'},
                {trait_type: 'Lameness', value: '0'}
            ],
            properties: {
                files: [
                    {
                        type: "image/png",
                        uri: image
                    },
                ]
            },
            creators: []
        };

        const myUri = await umi.uploader.uploadJson(metadata);
        console.log("Your metadata URI: ", myUri.replace("arweave.net", "devnet.irys.xyz"));
    }
    catch(error) {
        console.log("Oops.. Something went wrong", error);
    }
})();
