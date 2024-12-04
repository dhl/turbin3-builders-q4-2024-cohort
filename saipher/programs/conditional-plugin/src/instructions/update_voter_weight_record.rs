use crate::error::ConditionalPluginError;
use crate::state::*;
use anchor_lang::prelude::*;
use crate::gpl_shared::compose::{resolve_input_voter_weight, VoterWeightRecordBase};
use crate::gpl_shared::generic_voter_weight::GenericVoterWeight;
use anchor_spl::token::Mint;

impl<'a> VoterWeightRecordBase<'a> for VoterWeightRecord {
    fn get_governing_token_mint(&'a self) -> &'a Pubkey {
        &self.governing_token_mint
    }

    fn get_governing_token_owner(&'a self) -> &'a Pubkey {
        &self.governing_token_owner
    }
}

/// Updates VoterWeightRecord to evaluate governance power for non voting use cases: CreateProposal, CreateGovernance etc...
/// This instruction updates VoterWeightRecord which is valid for the current Slot and the given target action only
/// and hence the instruction has to be executed inside the same transaction as the corresponding spl-gov instruction
#[derive(Accounts)]
#[instruction()]
pub struct UpdateVoterWeightRecord<'info> {
    /// The conditional plugin Registrar
    pub registrar: Account<'info, Registrar>,

    /// An account that is either of type TokenOwnerRecordV2 or VoterWeightRecord
    /// depending on whether the registrar includes a predecessor or not
    /// CHECK: Checked in the code depending on the registrar
    #[account()]
    pub input_voter_weight: UncheckedAccount<'info>,

    #[account(
        constraint = community_token_mint.key() == registrar.community_token_mint
    )]
    pub community_token_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = voter_weight_record.realm == registrar.realm
        @ ConditionalPluginError::InvalidVoterWeightRecordRealm,

        constraint = voter_weight_record.governing_token_mint == registrar.governing_token_mint
        @ ConditionalPluginError::InvalidVoterWeightRecordMint,
    )]
    pub voter_weight_record: Account<'info, VoterWeightRecord>,
}

/// Adapts the weight of from the predecessor
pub fn update_voter_weight_record(ctx: Context<UpdateVoterWeightRecord>) -> Result<()> {
    let voter_weight_record = &mut ctx.accounts.voter_weight_record;

    let input_voter_weight_account = ctx.accounts.input_voter_weight.to_account_info();

    let clone_record = voter_weight_record.clone();
    let input_voter_weight_record = resolve_input_voter_weight(
        &input_voter_weight_account,
        &clone_record,
        &ctx.accounts.registrar,
    )?;

    let output_voter_weight = input_voter_weight_record.get_voter_weight();
    msg!(
        "input weight: {}. output weight {}.",
        input_voter_weight_record.get_voter_weight(),
        output_voter_weight,
    );

    msg!("token mint supply: {}", ctx.accounts.community_token_mint.supply);

    if ctx.accounts.community_token_mint.supply >= ctx.accounts.registrar.community_token_threshold {
        voter_weight_record.voter_weight = 0;
    } else {
        voter_weight_record.voter_weight = output_voter_weight;
    }

    let current_slot = Clock::get()?.slot;

    voter_weight_record.voter_weight_expiry = Some(current_slot);

    Ok(())
}
