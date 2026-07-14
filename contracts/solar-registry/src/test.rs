#![cfg(test)]
extern crate std;

use crate::{
    ArrayStatus, EnvironmentalImpact, GeoLocation, PanelTechnology, SolarArray, SolarRegistry,
    SolarRegistryClient,
};
use soroban_sdk::{testutils::Address as _, Address, BytesN, Env, String};

fn make_array(env: &Env, id: BytesN<32>, operator: Address) -> SolarArray {
    SolarArray {
        id: id.clone(),
        name: String::from_str(env, "Brooklyn Rooftop 01"),
        operator,
        location: GeoLocation {
            latitude: 40_678_000,
            longitude: -73_944_000,
            altitude_m: 18,
        },
        panel_count: 240,
        panel_tech: PanelTechnology::Monocrystalline,
        rated_capacity_w: 96_000,
        installed_at: 1_700_000_000,
        status: ArrayStatus::Pending,
        impact: EnvironmentalImpact {
            co2_offset_kg_per_year: 38_400_000,
            expected_yield_kwh_per_year: 152_000_000,
        },
        token_contract: None,
        metadata_uri: String::from_str(env, "ipfs://bafy.bk01"),
        last_updated: 0,
    }
}

#[test]
fn test_initialize_stores_admin_and_verifier() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(SolarRegistry, ());
    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let client = SolarRegistryClient::new(&env, &contract_id);
    client.initialize(&admin, &verifier);
    assert_eq!(client.admin(), admin);
    assert_eq!(client.verifier(), verifier);
}

#[test]
fn test_register_then_get_round_trip() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(SolarRegistry, ());
    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let operator = Address::generate(&env);
    let client = SolarRegistryClient::new(&env, &contract_id);
    client.initialize(&admin, &verifier);

    let id = BytesN::from_array(&env, &[1u8; 32]);
    let array = make_array(&env, id.clone(), operator.clone());
    client.register_array(&array);

    let read = client.get_array(&id);
    assert_eq!(read.id, id);
    assert_eq!(read.operator, operator);
    assert_eq!(read.rated_capacity_w, 96_000);
    assert_eq!(client.count_arrays(), 1);
}

#[test]
fn test_register_duplicate_id_errors() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(SolarRegistry, ());
    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let operator = Address::generate(&env);
    let client = SolarRegistryClient::new(&env, &contract_id);
    client.initialize(&admin, &verifier);

    let id = BytesN::from_array(&env, &[2u8; 32]);
    let array = make_array(&env, id.clone(), operator.clone());
    client.register_array(&array);
    let res = client.try_register_array(&array);
    assert!(res.is_err());
}

#[test]
fn test_status_lifecycle_transitions() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(SolarRegistry, ());
    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let operator = Address::generate(&env);
    let client = SolarRegistryClient::new(&env, &contract_id);
    client.initialize(&admin, &verifier);

    let id = BytesN::from_array(&env, &[3u8; 32]);
    let array = make_array(&env, id.clone(), operator);
    client.register_array(&array);

    client.set_status(&id, &ArrayStatus::Active);
    let read = client.get_array(&id);
    assert_eq!(read.status, ArrayStatus::Active);

    client.set_status(&id, &ArrayStatus::Maintenance);
    let read = client.get_array(&id);
    assert_eq!(read.status, ArrayStatus::Maintenance);

    client.set_status(&id, &ArrayStatus::Active);

    client.set_status(&id, &ArrayStatus::Decommissioned);
    let read = client.get_array(&id);
    assert_eq!(read.status, ArrayStatus::Decommissioned);
}

#[test]
fn test_unknown_array_errors() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(SolarRegistry, ());
    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let client = SolarRegistryClient::new(&env, &contract_id);
    client.initialize(&admin, &verifier);

    let id = BytesN::from_array(&env, &[9u8; 32]);
    let res = client.try_get_array(&id);
    assert!(res.is_err());
}

#[test]
fn test_bind_token_updates_array() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(SolarRegistry, ());
    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let operator = Address::generate(&env);
    let client = SolarRegistryClient::new(&env, &contract_id);
    client.initialize(&admin, &verifier);

    let id = BytesN::from_array(&env, &[4u8; 32]);
    let array = make_array(&env, id.clone(), operator);
    client.register_array(&array);

    let token_contract = Address::generate(&env);
    client.bind_token(&id, &token_contract);

    let read = client.get_array(&id);
    assert_eq!(read.token_contract, Some(token_contract));
}

// ---------------------------------------------------------------------------
// New tests: metadata updates, filtered queries, maintenance log
// ---------------------------------------------------------------------------

#[test]
fn test_update_array_metadata() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(SolarRegistry, ());
    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let operator = Address::generate(&env);
    let client = SolarRegistryClient::new(&env, &contract_id);
    client.initialize(&admin, &verifier);

    let id = BytesN::from_array(&env, &[5u8; 32]);
    let array = make_array(&env, id.clone(), operator);
    client.register_array(&array);

    let new_name = String::from_str(&env, "Updated Array Name");
    let new_uri = String::from_str(&env, "ipfs://updated-hash");
    client.update_array_metadata(&id, &new_name, &new_uri);

    let read = client.get_array(&id);
    assert_eq!(read.name, new_name);
    assert_eq!(read.metadata_uri, new_uri);
}

#[test]
fn test_unbind_token() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(SolarRegistry, ());
    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let operator = Address::generate(&env);
    let client = SolarRegistryClient::new(&env, &contract_id);
    client.initialize(&admin, &verifier);

    let id = BytesN::from_array(&env, &[6u8; 32]);
    let array = make_array(&env, id.clone(), operator);
    client.register_array(&array);

    let token = Address::generate(&env);
    client.bind_token(&id, &token);
    assert_eq!(client.get_array(&id).token_contract, Some(token.clone()));

    client.unbind_token(&id);
    assert_eq!(client.get_array(&id).token_contract, None);
}

#[test]
fn test_set_admin_and_verifier() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(SolarRegistry, ());
    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let new_admin = Address::generate(&env);
    let new_verifier = Address::generate(&env);
    let client = SolarRegistryClient::new(&env, &contract_id);
    client.initialize(&admin, &verifier);

    client.set_admin(&new_admin);
    assert_eq!(client.admin(), new_admin);

    client.set_verifier(&new_verifier);
    assert_eq!(client.verifier(), new_verifier);
}

#[test]
fn test_get_arrays_by_status() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(SolarRegistry, ());
    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let operator = Address::generate(&env);
    let client = SolarRegistryClient::new(&env, &contract_id);
    client.initialize(&admin, &verifier);

    let id1 = BytesN::from_array(&env, &[10u8; 32]);
    client.register_array(&make_array(&env, id1.clone(), operator.clone()));
    client.set_status(&id1, &ArrayStatus::Active);

    let id2 = BytesN::from_array(&env, &[11u8; 32]);
    client.register_array(&make_array(&env, id2.clone(), operator.clone()));

    let active = client.get_arrays_by_status(&ArrayStatus::Active);
    assert_eq!(active.len(), 1);
    assert_eq!(active.get(0).unwrap(), id1);

    let pending = client.get_arrays_by_status(&ArrayStatus::Pending);
    assert_eq!(pending.len(), 1);
}

#[test]
fn test_find_arrays_by_operator() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(SolarRegistry, ());
    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let operator_a = Address::generate(&env);
    let operator_b = Address::generate(&env);
    let client = SolarRegistryClient::new(&env, &contract_id);
    client.initialize(&admin, &verifier);

    let id1 = BytesN::from_array(&env, &[12u8; 32]);
    client.register_array(&make_array(&env, id1.clone(), operator_a.clone()));
    let id2 = BytesN::from_array(&env, &[13u8; 32]);
    client.register_array(&make_array(&env, id2.clone(), operator_a.clone()));
    let id3 = BytesN::from_array(&env, &[14u8; 32]);
    client.register_array(&make_array(&env, id3.clone(), operator_b.clone()));

    let found = client.find_arrays_by_operator(&operator_a);
    assert_eq!(found.len(), 2);
}

#[test]
fn test_total_rated_capacity() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(SolarRegistry, ());
    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let operator = Address::generate(&env);
    let client = SolarRegistryClient::new(&env, &contract_id);
    client.initialize(&admin, &verifier);

    let id1 = BytesN::from_array(&env, &[15u8; 32]);
    client.register_array(&make_array(&env, id1.clone(), operator.clone()));
    client.set_status(&id1, &ArrayStatus::Active);

    // Only active arrays count toward total.
    assert_eq!(client.total_rated_capacity(), 96_000);
}

#[test]
fn test_record_and_get_maintenance_log() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(SolarRegistry, ());
    let admin = Address::generate(&env);
    let verifier = Address::generate(&env);
    let operator = Address::generate(&env);
    let client = SolarRegistryClient::new(&env, &contract_id);
    client.initialize(&admin, &verifier);

    let id = BytesN::from_array(&env, &[16u8; 32]);
    client.register_array(&make_array(&env, id.clone(), operator));

    let desc = String::from_str(&env, "Replaced 3 faulty inverters");
    client.record_maintenance(&id, &desc);

    let log = client.get_maintenance_log(&id);
    assert_eq!(log.len(), 1);
    assert_eq!(log.get(0).unwrap().description, desc);
}
