use anchor_lang::prelude::*;

declare_id!("HzgcvSu1HMonZMuMdTiTwDyAKs5874k9dy9NqknmHy2z");

#[program]
pub mod saipher {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
