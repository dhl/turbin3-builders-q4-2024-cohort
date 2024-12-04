use anchor_lang::prelude::*;
use crate::gpl_shared::{
    anchor::{DISCRIMINATOR_SIZE},
    compose::RegistrarBase,
};

/// Registrar which stores conditional voting configuration for the given Realm
#[account]
#[derive(Debug, PartialEq, InitSpace)]
pub struct Registrar {
    /// spl-governance program the Realm belongs to
    pub governance_program_id: Pubkey,

    /// Realm of the Registrar
    pub realm: Pubkey,

    /// Governing token mint the Registrar is for
    /// It can either be the Community or the Council mint of the Realm
    /// When the plugin is used the mint is only used as identity of the governing power (voting population)
    /// and the actual token of the mint is not used
    pub governing_token_mint: Pubkey,

    pub community_token_mint: Pubkey,

    pub community_token_threshold: u64,

    /// If the plugin is one in a sequence, this is the previous plugin program ID
    /// If set, then update_voter_weight_record will expect a voter_weight_record owned by this program
    pub previous_voter_weight_plugin_program_id: Option<Pubkey>,

    /// Reserved for future upgrades
    pub reserved: [u8; 128],
}

impl Registrar {
    pub fn get_space() -> usize {
        DISCRIMINATOR_SIZE + Self::INIT_SPACE
    }
}

#[cfg(test)]
mod test {

    use super::*;

    #[test]
    fn test_get_space() {
        // Arrange
        let expected_space = Registrar::get_space();

        let registrar = Registrar {
            governance_program_id: Pubkey::default(),
            previous_voter_weight_plugin_program_id: Pubkey::default().into(),
            realm: Pubkey::default(),
            governing_token_mint: Pubkey::default(),
            community_token_mint: Pubkey::default(),
            community_token_threshold: 0,
            reserved: [0; 128],
        };

        // Act
        let actual_space = DISCRIMINATOR_SIZE + registrar.try_to_vec().unwrap().len();

        // Assert
        assert_eq!(expected_space, actual_space);
    }
}

impl<'a> RegistrarBase<'a> for Registrar {
    fn get_realm(&'a self) -> &'a Pubkey {
        &self.realm
    }

    fn get_governance_program_id(&'a self) -> &'a Pubkey {
        &self.governance_program_id
    }

    fn get_governing_token_mint(&'a self) -> &'a Pubkey {
        &self.governing_token_mint
    }

    fn get_previous_voter_weight_plugin_program_id(&'a self) -> &'a Option<Pubkey> {
        &self.previous_voter_weight_plugin_program_id
    }
}
