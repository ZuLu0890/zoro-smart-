#![no_std]
//! `yield-distributor` — distributes the real-world energy revenue from a
//! solar array to holders of an `rwa-token` contract, in a gas-efficient
//! **pull-payment** model.
//!
//! Lifecycle:
//!   1. Factory `initialize`s the distributor with the address of the
//!      corresponding RWA token and a payment token (e.g. USDC SAC wrapper).
//!   2. Anyone (typically an authorised relay) `fund`s the contract with
//!      the latest revenue batch.
//!   3. Each share-holder calls `claim` to pull their proportional share of
//!      the accrued yield.
//!
//! The pull-payment model avoids the O(N) iteration cost of push payments on
//! every deposit, and lets holders claim when convenient.

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env,
};

// ============================================================================
// Errors
// ============================================================================

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum YieldError {
    NotInitialized = 1,
    AlreadyInitialized = 2,
    Unauthorized = 3,
    /// The `rwa_token` address is unknown or did not match.
    UnknownShareToken = 4,
    /// Payment token transfer failed.
    PaymentTokenFailure = 5,
    /// Nothing currently claimable for `holder`.
    NothingToClaim = 6,
    MathOverflow = 7,
    /// The supplied amount was zero or negative.
    ZeroAmount = 8,
    /// Claims are currently paused.
    ClaimsPaused = 9,
    /// Claim amount is below the minimum threshold.
    BelowMinimumClaim = 10,
}

// ============================================================================
// Storage
// ============================================================================

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Permissioned funder (usually the relay that scrapes energy invoices).
    Admin,
    Funder,
    /// rwa-token contract whose holders are entitled to yield.
    ShareToken,
    /// Payment token (e.g. USDC Stellar Asset Contract wrapper).
    PaymentToken,
    /// Total yield accrued at the *current* dividend epoch (per share, scaled).
    YieldPerShare,
    /// Per-holder ledger of `yield_per_share_paid_so_far`.
    ///   claimable = (global_yps - paid_so_far) * balance_of_holder
    PaidYieldPerShare(Address),
    /// Aggregate claim bookkeeping.
    TotalClaimed,
    /// Last funded ledger so the indexer can be idempotent.
    LastFundedAt,
    /// Global pause flag for claims.
    Paused,
    /// Minimum claimable amount required to execute a claim.
    MinClaimAmount,
    /// Aggregate total of all funds deposited (analytics).
    TotalFunded,
    /// Number of funding events processed.
    FundingCount,
}

// ============================================================================
// Contract
// ============================================================================

#[contract]
pub struct YieldDistributor;

#[contractimpl]
impl YieldDistributor {
    // --------------------------------------------------------------------
    // Initialisation
    // --------------------------------------------------------------------

    pub fn initialize(
        env: Env,
        admin: Address,
        funder: Address,
        share_token: Address,
        payment_token: Address,
    ) -> Result<(), YieldError> {
        if env.storage().instance().has(&DataKey::Admin) {
            return Err(YieldError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Funder, &funder);
        env.storage()
            .instance()
            .set(&DataKey::ShareToken, &share_token);
        env.storage()
            .instance()
            .set(&DataKey::PaymentToken, &payment_token);
        env.storage()
            .instance()
            .set(&DataKey::YieldPerShare, &0i128);
        env.storage().instance().set(&DataKey::TotalClaimed, &0i128);
        env.storage().instance().set(&DataKey::LastFundedAt, &0u64);
        env.storage().instance().set(&DataKey::TotalFunded, &0i128);
        env.storage().instance().set(&DataKey::FundingCount, &0u32);
        env.storage().instance().set(&DataKey::Paused, &false);
        env.storage().instance().set(&DataKey::MinClaimAmount, &0i128);
        env.events().publish(
            (symbol_short!("init"),),
            (admin, funder, share_token, payment_token),
        );
        Ok(())
    }

    // --------------------------------------------------------------------
    // Routing helpers
    // --------------------------------------------------------------------

    pub fn share_token(env: Env) -> Result<Address, YieldError> {
        env.storage()
            .instance()
            .get(&DataKey::ShareToken)
            .ok_or(YieldError::NotInitialized)
    }

    pub fn payment_token(env: Env) -> Result<Address, YieldError> {
        env.storage()
            .instance()
            .get(&DataKey::PaymentToken)
            .ok_or(YieldError::NotInitialized)
    }

    /// Return the permissioned funder address. Useful for the indexer and
    /// the dashboard to show who is authorised to deposit revenue.
    pub fn funder(env: Env) -> Result<Address, YieldError> {
        env.storage()
            .instance()
            .get(&DataKey::Funder)
            .ok_or(YieldError::NotInitialized)
    }

    pub fn yield_per_share(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::YieldPerShare)
            .unwrap_or(0i128)
    }

    pub fn last_funded_at(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::LastFundedAt)
            .unwrap_or(0u64)
    }

    /// Return the aggregate amount of yield that has been claimed across
    /// all holders since the contract was deployed. Useful for analytics
    /// dashboards and indexer reconciliation.
    pub fn total_claimed(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalClaimed)
            .unwrap_or(0i128)
    }

    // --------------------------------------------------------------------
    // Read claims for a holder
    // --------------------------------------------------------------------

    /// Compute current `claimable` amount for `holder`.
    /// Formula:
    ///   unpaid_yps = global_yps - holder_paid_yps
    ///   claimable  = unpaid_yps * holder_token_balance
    /// Both halves are scaled so intermediate math uses i128.
    pub fn claimable(env: Env, holder: Address) -> Result<i128, YieldError> {
        let share_token = Self::share_token(env.clone())?;
        let token_client = token::TokenClient::new(&env, &share_token);
        let balance = token_client.balance(&holder);
        Self::claimable_with_balance(env, holder, balance)
    }

    /// Variant that accepts a pre-fetched balance (useful for gas-tight
    /// batched claims where the caller already has the balance).
    pub fn claimable_with_balance(
        env: Env,
        holder: Address,
        balance: i128,
    ) -> Result<i128, YieldError> {
        let yps: i128 = env
            .storage()
            .instance()
            .get(&DataKey::YieldPerShare)
            .unwrap_or(0);
        let paid: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::PaidYieldPerShare(holder))
            .unwrap_or(0);
        let unpaid = yps.checked_sub(paid).ok_or(YieldError::MathOverflow)?;
        let claimable = balance
            .checked_mul(unpaid)
            .and_then(|v| v.checked_div(1_000_000))
            .ok_or(YieldError::MathOverflow)?;
        Ok(claimable)
    }

    // --------------------------------------------------------------------
    // Fund + claim
    // --------------------------------------------------------------------

    /// Deposit yield from the off-chain relay. The funder address must have
    /// already approved this contract to spend its payment token balance.
    pub fn fund(env: Env, amount: i128) -> Result<(), YieldError> {
        if amount <= 0 {
            return Err(YieldError::ZeroAmount);
        }
        let funder: Address = env
            .storage()
            .instance()
            .get(&DataKey::Funder)
            .ok_or(YieldError::NotInitialized)?;
        funder.require_auth();

        let payment_token = Self::payment_token(env.clone())?;
        let share_token = Self::share_token(env.clone())?;
        let token_client = token::TokenClient::new(&env, &payment_token);
        token_client.transfer(&funder, &env.current_contract_address(), &amount);

        // Pull current total supply of the share token.
        let rwa = token::TokenClient::new(&env, &share_token);
        let total_supply = rwa.balance(&share_token); // 0 by convention (token holds its own balance)
        let external_holders_supply = Self::external_supply(&env, &share_token);
        let supply = external_holders_supply
            .checked_add(total_supply)
            .ok_or(YieldError::MathOverflow)?;
        if supply == 0 {
            return Err(YieldError::UnknownShareToken);
        }
        // yield_per_share increments by amount * 1_000_000 / supply (scaled).
        let yps_delta = amount
            .checked_mul(1_000_000)
            .and_then(|v| v.checked_div(supply))
            .ok_or(YieldError::MathOverflow)?;
        let yps: i128 = env
            .storage()
            .instance()
            .get(&DataKey::YieldPerShare)
            .unwrap_or(0i128);
        let new_yps = yps.checked_add(yps_delta).ok_or(YieldError::MathOverflow)?;
        env.storage()
            .instance()
            .set(&DataKey::YieldPerShare, &new_yps);
        env.storage()
            .instance()
            .set(&DataKey::LastFundedAt, &env.ledger().timestamp());
        // Update analytics accumulators.
        let total_funded: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalFunded)
            .unwrap_or(0i128);
        env.storage().instance().set(
            &DataKey::TotalFunded,
            &total_funded
                .checked_add(amount)
                .ok_or(YieldError::MathOverflow)?,
        );
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::FundingCount)
            .unwrap_or(0u32);
        env.storage()
            .instance()
            .set(&DataKey::FundingCount, &count.saturating_add(1));

        env.events().publish(
            (symbol_short!("fund"),),
            (funder, amount, new_yps),
        );
        Ok(())
    }

    /// Pull-based claim: holder pulls their own yield.
    pub fn claim(env: Env, holder: Address) -> Result<i128, YieldError> {
        holder.require_auth();
        let share_token = Self::share_token(env.clone())?;
        let token_client = token::TokenClient::new(&env, &share_token);
        let balance = token_client.balance(&holder);
        let claimable = Self::claimable_with_balance(env.clone(), holder.clone(), balance)?;
        if claimable <= 0 {
            return Err(YieldError::NothingToClaim);
        }
        let yps: i128 = env
            .storage()
            .instance()
            .get(&DataKey::YieldPerShare)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::PaidYieldPerShare(holder.clone()), &yps);
        // Keep the per-holder ledger alive long enough to survive between
        // revenue epochs (~90 days / 7_776_000 ledgers on Public Network).
        env.storage().persistent().extend_ttl(
            &DataKey::PaidYieldPerShare(holder.clone()),
            172_800u32,
            7_776_000u32,
        );

        let payment_token = Self::payment_token(env.clone())?;
        let pay_client = token::TokenClient::new(&env, &payment_token);
        pay_client.transfer(&env.current_contract_address(), &holder, &claimable);

        let total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalClaimed)
            .unwrap_or(0i128);
        env.storage().instance().set(
            &DataKey::TotalClaimed,
            &total
                .checked_add(claimable)
                .ok_or(YieldError::MathOverflow)?,
        );

        // Check if claims are paused.
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false);
        if paused {
            return Err(YieldError::ClaimsPaused);
        }
        // Enforce minimum claim threshold.
        let min_claim: i128 = env
            .storage()
            .instance()
            .get(&DataKey::MinClaimAmount)
            .unwrap_or(0i128);
        if min_claim > 0 && claimable < min_claim {
            return Err(YieldError::BelowMinimumClaim);
        }

        let yps: i128 = env
            .storage()
            .instance()
            .get(&DataKey::YieldPerShare)
            .unwrap_or(0);
        env.storage()
            .persistent()
            .set(&DataKey::PaidYieldPerShare(holder.clone()), &yps);
        env.storage().persistent().extend_ttl(
            &DataKey::PaidYieldPerShare(holder.clone()),
            172_800u32,
            7_776_000u32,
        );

        let payment_token = Self::payment_token(env.clone())?;
        let pay_client = token::TokenClient::new(&env, &payment_token);
        pay_client.transfer(&env.current_contract_address(), &holder, &claimable);

        let total: i128 = env
            .storage()
            .instance()
            .get(&DataKey::TotalClaimed)
            .unwrap_or(0i128);
        env.storage().instance().set(
            &DataKey::TotalClaimed,
            &total
                .checked_add(claimable)
                .ok_or(YieldError::MathOverflow)?,
        );

        env.events().publish(
            (symbol_short!("claim"), holder.clone()),
            claimable,
        );
        Ok(claimable)
    }

    // --------------------------------------------------------------------
    // Batch operations
    // --------------------------------------------------------------------

    /// Batch claimable query for multiple holders.
    pub fn claimable_batch(
        env: Env,
        holders: soroban_sdk::Vec<Address>,
    ) -> soroban_sdk::Vec<i128> {
        let mut results = soroban_sdk::Vec::new(&env);
        for holder in holders.iter() {
            let claimable = Self::claimable(env.clone(), holder.clone())
                .unwrap_or(0i128);
            results.push_back(claimable);
        }
        results
    }

    /// Batch claim for multiple holders (each claim must be authorised).
    pub fn claim_batch(
        env: Env,
        holders: soroban_sdk::Vec<Address>,
    ) -> Result<soroban_sdk::Vec<i128>, YieldError> {
        let mut results = soroban_sdk::Vec::new(&env);
        for holder in holders.iter() {
            let amount = Self::claim(env.clone(), holder.clone())?;
            results.push_back(amount);
        }
        Ok(results)
    }

    // --------------------------------------------------------------------
    // Admin
    // --------------------------------------------------------------------

    pub fn set_funder(env: Env, new_funder: Address) -> Result<(), YieldError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(YieldError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Funder, &new_funder);
        Ok(())
    }

    /// Transfer admin role. Current admin only.
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), YieldError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(YieldError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &new_admin);
        env.events()
            .publish((symbol_short!("set_admin"),), new_admin);
        Ok(())
    }

    /// Update the linked share token. Admin only.
    pub fn set_share_token(env: Env, new_token: Address) -> Result<(), YieldError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(YieldError::NotInitialized)?;
        admin.require_auth();
        env.storage()
            .instance()
            .set(&DataKey::ShareToken, &new_token);
        env.events()
            .publish((symbol_short!("set_share_token"),), new_token);
        Ok(())
    }

    /// Set the minimum claimable amount. Admin only.
    pub fn set_min_claim(env: Env, min_amount: i128) -> Result<(), YieldError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(YieldError::NotInitialized)?;
        admin.require_auth();
        if min_amount < 0 {
            return Err(YieldError::MathOverflow);
        }
        env.storage()
            .instance()
            .set(&DataKey::MinClaimAmount, &min_amount);
        Ok(())
    }

    /// Read the minimum claim amount.
    pub fn min_claim(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::MinClaimAmount)
            .unwrap_or(0i128)
    }

    /// Pause all claims. Admin only.
    pub fn pause(env: Env) -> Result<(), YieldError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(YieldError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &true);
        env.events().publish((symbol_short!("pause"),), ());
        Ok(())
    }

    /// Resume claims. Admin only.
    pub fn unpause(env: Env) -> Result<(), YieldError> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(YieldError::NotInitialized)?;
        admin.require_auth();
        env.storage().instance().set(&DataKey::Paused, &false);
        env.events().publish((symbol_short!("unpause"),), ());
        Ok(())
    }

    /// Query whether claims are paused.
    pub fn paused(env: Env) -> bool {
        env.storage()
            .instance()
            .get(&DataKey::Paused)
            .unwrap_or(false)
    }

    /// Return aggregate total funded (analytics).
    pub fn total_funded(env: Env) -> i128 {
        env.storage()
            .instance()
            .get(&DataKey::TotalFunded)
            .unwrap_or(0i128)
    }

    /// Return the number of funding events.
    pub fn funding_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::FundingCount)
            .unwrap_or(0u32)
    }

    /// Admin can withdraw surplus payment tokens (e.g. mis-sent tokens).
    pub fn withdraw_surplus(
        env: Env,
        to: Address,
        amount: i128,
    ) -> Result<(), YieldError> {
        if amount <= 0 {
            return Err(YieldError::ZeroAmount);
        }
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(YieldError::NotInitialized)?;
        admin.require_auth();
        let payment_token = Self::payment_token(env.clone())?;
        let pay_client = token::TokenClient::new(&env, &payment_token);
        pay_client.transfer(&env.current_contract_address(), &to, &amount);
        env.events()
            .publish((symbol_short!("withdraw"),), (to, amount));
        Ok(())
    }

    // --------------------------------------------------------------------
    // Internal helpers
    // --------------------------------------------------------------------

    fn external_supply(env: &Env, share_token: &Address) -> i128 {
        // Cross-contract invoke `rwa_token::RwaToken::total_supply`.
        //
        // Production rule: never panic on a missing share-token. Use
        // `try_invoke_contract` so the host can surface contract errors
        // (unknown function, unauthorised, etc.) as Result values we
        // can match against, instead of aborting the entire deposit
        // flow. The only success path returns the i128 total supply;
        // anything else falls back to 0, which lets `fund()` reject the
        // deposit (via `UnknownShareToken`).
        let symbol = soroban_sdk::Symbol::new(env, "total_supply");
        let args: soroban_sdk::Vec<soroban_sdk::Val> = soroban_sdk::Vec::new(env);
        match env.try_invoke_contract::<i128, soroban_sdk::Error>(share_token, &symbol, args) {
            Ok(Ok(value)) => value,
            _ => 0i128,
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod test;
