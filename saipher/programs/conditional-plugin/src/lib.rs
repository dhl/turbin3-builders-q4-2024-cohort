mod error;
mod instructions;
mod state;
mod gpl_shared;

use anchor_lang::prelude::*;
use instructions::*;

declare_id!("7uRFnRte9TRyEdB2wzStZeA4ZrWei1tGrCNF7zcvwC1Z");

#[program]
pub mod conditional_plugin {
    use super::*;

    pub fn create_registrar(
        ctx: Context<CreateRegistrar>,
        use_previous_voter_weight_plugin: bool,
        community_token_threshold: u64,
    ) -> Result<()> {
        log_version();
        instructions::create_registrar(ctx, use_previous_voter_weight_plugin, community_token_threshold)
    }

    pub fn configure_registrar(
        ctx: Context<ConfigureRegistrar>,
        use_previous_voter_weight_plugin: bool,
    ) -> Result<()> {
        log_version();
        instructions::configure_registrar(ctx, use_previous_voter_weight_plugin)
    }

    pub fn create_voter_weight_record(
        ctx: Context<CreateVoterWeightRecord>,
        governing_token_owner: Pubkey,
    ) -> Result<()> {
        log_version();
        instructions::create_voter_weight_record(ctx, governing_token_owner)
    }

    pub fn update_voter_weight_record(ctx: Context<UpdateVoterWeightRecord>) -> Result<()> {
        log_version();
        instructions::update_voter_weight_record(ctx)
    }
}

fn log_version() {
    // TODO: Check if Anchor allows to log it before instruction is deserialized
    msg!("VERSION:{:?}", env!("CARGO_PKG_VERSION"));
}
