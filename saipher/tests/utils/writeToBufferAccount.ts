import {execSync} from 'child_process';
import path from 'path';

export async function writeToBufferAccount(programPath: string, upgradeAuthority?: string): Promise<string> {
    const absolutePath = path.resolve(programPath);
    try {
        const stdout = execSync(`solana program write-buffer --output json-compact --commitment confirmed ${absolutePath}`);
        const output = JSON.parse(stdout.toString().trim());
        const bufferAccountAddress = output.buffer;

        // change upgrade authority
        if (upgradeAuthority) {
            execSync(`solana program set-buffer-authority --commitment confirmed --new-buffer-authority ${upgradeAuthority} ${bufferAccountAddress}`);
        }

        return bufferAccountAddress;
    } catch (error) {
        console.error(`Error deploying program: ${error.message}`);
    }
}
