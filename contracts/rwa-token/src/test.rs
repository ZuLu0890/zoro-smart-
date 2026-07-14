#![cfg(test)]
extern crate std;

use crate::{RwaToken, RwaTokenClient};
use soroban_sdk::{testutils::Address as _, Address, Env, IntoVal, String};

#[test]
fn test_initialize_then_metadata() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RwaToken, ());
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);

    let client = RwaTokenClient::new(&env, &contract_id);
    client.initialize(
        &admin,
        &operator,
        &7u32,
        &String::from_str(&env, "SolShare Brooklyn Array 01"),
        &String::from_str(&env, "sSHR-BK01"),
    );

    assert_eq!(client.decimals(), 7);
    assert_eq!(
        client.name(),
        String::from_str(&env, "SolShare Brooklyn Array 01")
    );
    assert_eq!(client.symbol(), String::from_str(&env, "sSHR-BK01"));
    assert_eq!(client.admin(), admin);
    assert_eq!(client.operator(), operator);
    assert_eq!(client.total_supply(), 0);
}

#[test]
fn test_double_initialize_errors() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RwaToken, ());
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let client = RwaTokenClient::new(&env, &contract_id);
    client.initialize(
        &admin,
        &operator,
        &7u32,
        &String::from_str(&env, "x"),
        &String::from_str(&env, "x"),
    );
    let res = client.try_initialize(
        &admin,
        &operator,
        &7u32,
        &String::from_str(&env, "y"),
        &String::from_str(&env, "y"),
    );
    assert!(res.is_err());
}

#[test]
fn test_mint_transfer_burn_flow() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RwaToken, ());
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    let client = RwaTokenClient::new(&env, &contract_id);
    client.initialize(
        &admin,
        &operator,
        &0u32,
        &String::from_str(&env, "s"),
        &String::from_str(&env, "s"),
    );

    client.mint(&alice, &1_000i128);
    assert_eq!(client.balance(&alice), 1_000);
    assert_eq!(client.total_supply(), 1_000);

    client.transfer(&alice, &bob, &400i128);
    assert_eq!(client.balance(&alice), 600);
    assert_eq!(client.balance(&bob), 400);

    client.burn(&alice, &100i128);
    assert_eq!(client.balance(&alice), 500);
    assert_eq!(client.total_supply(), 900);
}

#[test]
fn test_unauthorized_mint_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RwaToken, ());
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let alice = Address::generate(&env);
    let imposter = Address::generate(&env);

    let client = RwaTokenClient::new(&env, &contract_id);
    client.initialize(
        &admin,
        &operator,
        &0u32,
        &String::from_str(&env, "x"),
        &String::from_str(&env, "x"),
    );

    // Try to mint as non-operator
    env.mock_auths(&[soroban_sdk::testutils::MockAuth {
        address: &imposter,
        invoke: &soroban_sdk::testutils::MockAuthInvoke {
            contract: &contract_id,
            fn_name: "mint",
            args: soroban_sdk::vec![&env, alice.into_val(&env), 1_000i128.into_val(&env)],
            sub_invokes: &[],
        },
    }]);

    let r = client.try_mint(&alice, &1_000i128);
    assert!(r.is_err());
}

#[test]
fn test_approve_and_transfer_from() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RwaToken, ());
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let spender = Address::generate(&env);

    let client = RwaTokenClient::new(&env, &contract_id);
    client.initialize(
        &admin,
        &operator,
        &0u32,
        &String::from_str(&env, "x"),
        &String::from_str(&env, "x"),
    );
    client.mint(&alice, &500i128);

    client.approve(&alice, &spender, &200i128, &10_000u32);
    assert_eq!(client.allowance(&alice, &spender), 200);

    client.transfer_from(&spender, &alice, &bob, &150i128);
    assert_eq!(client.balance(&alice), 350);
    assert_eq!(client.balance(&bob), 150);
    assert_eq!(client.allowance(&alice, &spender), 50);

    let r = client.try_transfer_from(&spender, &alice, &bob, &100i128);
    assert!(r.is_err());
}

#[test]
fn test_set_operator_admin_only() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RwaToken, ());
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let new_operator = Address::generate(&env);
    let client = RwaTokenClient::new(&env, &contract_id);
    client.initialize(
        &admin,
        &operator,
        &0u32,
        &String::from_str(&env, "x"),
        &String::from_str(&env, "x"),
    );
    client.set_operator(&new_operator);
    assert_eq!(client.operator(), new_operator);
}

#[test]
fn test_version_returns_cargo_pkg_version() {
    let env = Env::default();
    let version = RwaToken::version();
    let round_tripped = soroban_sdk::Symbol::new(&env, env!("CARGO_PKG_VERSION"));
    assert_eq!(version, round_tripped);
}

// ---------------------------------------------------------------------------
// Freeze / unfreeze / clawback / pause / supply cap
// ---------------------------------------------------------------------------

#[test]
fn test_freeze_and_unfreeze_account() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RwaToken, ());
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    let client = RwaTokenClient::new(&env, &contract_id);
    client.initialize(
        &admin,
        &operator,
        &0u32,
        &String::from_str(&env, "x"),
        &String::from_str(&env, "x"),
    );
    client.mint(&alice, &500i128);

    assert!(!client.is_frozen(&alice));
    client.freeze_account(&alice);
    assert!(client.is_frozen(&alice));

    // Frozen account cannot transfer.
    let r = client.try_transfer(&alice, &bob, &100i128);
    assert!(r.is_err());

    client.unfreeze_account(&alice);
    assert!(!client.is_frozen(&alice));
    client.transfer(&alice, &bob, &100i128);
    assert_eq!(client.balance(&bob), 100);
}

#[test]
fn test_clawback_admin_only() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RwaToken, ());
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let alice = Address::generate(&env);

    let client = RwaTokenClient::new(&env, &contract_id);
    client.initialize(
        &admin,
        &operator,
        &0u32,
        &String::from_str(&env, "x"),
        &String::from_str(&env, "x"),
    );
    client.mint(&alice, &1_000i128);

    client.clawback(&alice, &300i128);
    assert_eq!(client.balance(&alice), 700);
    assert_eq!(client.total_supply(), 700);
}

#[test]
fn test_pause_and_unpause() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RwaToken, ());
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    let client = RwaTokenClient::new(&env, &contract_id);
    client.initialize(
        &admin,
        &operator,
        &0u32,
        &String::from_str(&env, "x"),
        &String::from_str(&env, "x"),
    );
    client.mint(&alice, &500i128);

    assert!(!client.paused());
    client.pause();
    assert!(client.paused());

    let r = client.try_transfer(&alice, &bob, &100i128);
    assert!(r.is_err());

    client.unpause();
    assert!(!client.paused());
    client.transfer(&alice, &bob, &100i128);
    assert_eq!(client.balance(&bob), 100);
}

#[test]
fn test_supply_cap_blocks_mint() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RwaToken, ());
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let alice = Address::generate(&env);

    let client = RwaTokenClient::new(&env, &contract_id);
    client.initialize(
        &admin,
        &operator,
        &0u32,
        &String::from_str(&env, "x"),
        &String::from_str(&env, "x"),
    );
    client.set_supply_cap(&500i128);
    assert_eq!(client.supply_cap(), 500);

    client.mint(&alice, &400i128);
    // Minting another 200 would exceed the cap of 500.
    let r = client.try_mint(&alice, &200i128);
    assert!(r.is_err());
    assert_eq!(client.total_supply(), 400);
}

#[test]
fn test_set_admin_transfers_role() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RwaToken, ());
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let new_admin = Address::generate(&env);

    let client = RwaTokenClient::new(&env, &contract_id);
    client.initialize(
        &admin,
        &operator,
        &0u32,
        &String::from_str(&env, "x"),
        &String::from_str(&env, "x"),
    );
    client.set_admin(&new_admin);
    assert_eq!(client.admin(), new_admin);
}

#[test]
fn test_burn_from_operator() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RwaToken, ());
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let alice = Address::generate(&env);

    let client = RwaTokenClient::new(&env, &contract_id);
    client.initialize(
        &admin,
        &operator,
        &0u32,
        &String::from_str(&env, "x"),
        &String::from_str(&env, "x"),
    );
    client.mint(&alice, &1_000i128);

    client.burn_from(&alice, &250i128);
    assert_eq!(client.balance(&alice), 750);
    assert_eq!(client.total_supply(), 750);
}

#[test]
fn test_transfer_batch() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RwaToken, ());
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);
    let carol = Address::generate(&env);

    let client = RwaTokenClient::new(&env, &contract_id);
    client.initialize(
        &admin,
        &operator,
        &0u32,
        &String::from_str(&env, "x"),
        &String::from_str(&env, "x"),
    );
    client.mint(&alice, &1_000i128);

    let recipients = soroban_sdk::vec![&env, bob.clone(), carol.clone()];
    let amounts = soroban_sdk::vec![&env, 200i128, 300i128];
    client.transfer_batch(&alice, &recipients, &amounts);
    assert_eq!(client.balance(&alice), 500);
    assert_eq!(client.balance(&bob), 200);
    assert_eq!(client.balance(&carol), 300);
}

#[test]
fn test_balance_of_batch() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(RwaToken, ());
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    let client = RwaTokenClient::new(&env, &contract_id);
    client.initialize(
        &admin,
        &operator,
        &0u32,
        &String::from_str(&env, "x"),
        &String::from_str(&env, "x"),
    );
    client.mint(&alice, &500i128);
    client.mint(&bob, &300i128);

    let accounts = soroban_sdk::vec![&env, alice.clone(), bob.clone()];
    let balances = client.balance_of_batch(&accounts);
    assert_eq!(balances.get(0).unwrap(), 500);
    assert_eq!(balances.get(1).unwrap(), 300);
}
