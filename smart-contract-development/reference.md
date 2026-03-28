# Smart Contract Security Reference

Read this file when auditing, designing high-risk modules, or when the user asks for depth on a vulnerability class.

## OWASP-style categories (EVM)

| Category | Examples |
|----------|----------|
| Access control | Missing modifiers, incorrect `msg.sender` vs `tx.origin`, delegatecall to user-controlled logic |
| Reentrancy | Single-function, cross-function, read-only reentrancy (view calls during callback) |
| Integer / precision | Overflow in older Solidity; div-before-mul; inconsistent decimals across tokens |
| Oracle / price | Stale prices, manipulable TWAP windows, L2 sequencer assumptions |
| Economic / MEV | Sandwich, JIT liquidity, liquidation ordering, oracle delay games |
| Denial of service | Unbounded loops, griefing via dust, block gas limit hits |
| Upgrades & proxies | Storage collision, unprotected initializer, implementation selfdestruct |
| Cross-chain | Bridge trust, message replay, source vs destination chain finality |

## Common high-impact patterns

**Reentrancy**: External call -> callee reenters -> state not yet updated. Mitigations: CEI, `nonReentrant`, pull over push for ETH/tokens where appropriate.

**Flash loan attacks**: Attacker borrows huge capital for one tx; any price or balance-based logic in that tx can be manipulated. Design logic that does not rely on spot balances for security-critical decisions, or use robust oracles / time-weighted values with documented assumptions.

**Approval / permit**: `approve` front-running between two spends; signature replay across chains or contracts if domain separator wrong. Prefer allowance increases or documented patterns.

**Delegatecall**: Only to trusted, immutable implementations; storage layout must match proxy exactly.

**ERC-4626**: Donation / inflation attacks on empty vaults; preview functions vs actual mint/burn rounding; first depositor issues - mitigate with virtual shares, minimum seed, or documented initial deposit.

**Governance**: timelock delays, proposal thresholds, quorum manipulation, flash-loan voting - specify mitigations per design.

## Tooling (indicative)

- **Foundry**: `forge test`, `forge coverage`, fuzz, invariant testing.
- **Slither**: static analysis detectors; use as signal, not proof of security.
- **Echidna / Medusa**: property-based fuzzing for complex protocols.
- **Certora / formal**: when invariants are critical and budget allows.

## Documentation to require in serious projects

1. Threat model and trust assumptions.
2. Invariants preserved by each module.
3. Admin capabilities and parameters (with bounds).
4. External contract dependencies and versions.
5. Known limitations and out-of-scope attacks.

## Further reading (official / canonical)

- [Solidity security considerations](https://docs.soliditylang.org/en/latest/security-considerations.html)
- [Consensys Smart Contract Best Practices](https://consensys.github.io/smart-contract-best-practices/)
- [SWC Registry](https://swcregistry.io/) - weakness classification
- [Ethereum.org smart contract security](https://ethereum.org/en/developers/docs/smart-contracts/security/)
