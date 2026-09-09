---
name: smart-contract-development
description: >-
  Designs, implements, audits, and refactors Solidity and EVM smart contracts
  with a security-first mindset. Covers architecture, access control, reentrancy,
  upgradeability, oracle and MEV risks, gas, testing (Foundry/Hardhat), formal
  review checklists, and static analysis. Use when writing or reviewing Solidity,
  smart contracts, DeFi protocols, token standards (ERC-20/721/1155/4626),
  audits, security reviews, Foundry, Hardhat, or EVM bytecode-level concerns.
---

# Smart Contract Development

## Principles

1. **Assume hostile actors** - every external call can reenter; every address can be malicious; calldata is untrusted.
2. **Minimize trust surface** - fewer privileged roles, smaller admin surfaces, timelocks and multisigs where power is unavoidable.
3. **Checks-effects-interactions** - state updates before external calls; document intentional deviations.
4. **Fail closed** - ambiguous or failed external calls should not leave the system in an exploitable half-state.
5. **Prefer battle-tested patterns** - OpenZeppelin (or equivalent audited libs) over bespoke access control or math when applicable.

When stack-specific API details matter, prefer current official docs: [Solidity](https://docs.soliditylang.org/), [Foundry](https://book.getfoundry.sh/), [Hardhat](https://hardhat.org/docs), [viem](https://viem.sh/docs/getting-started), [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts).

---

## Workflow

Copy and track:

```
- [ ] Requirements: assets, roles, trust assumptions, upgrade path (if any)
- [ ] Threat model: who can profit from what failure mode
- [ ] Implementation: minimal complexity; no shadowed variables; no ambiguous semantics
- [ ] Unit + fuzz + invariant tests (Foundry-style where applicable)
- [ ] Static analysis (Slither / similar) and manual review against [reference.md](reference.md)
- [ ] Documentation: invariants, admin actions, external dependencies, known limitations
```

---

## Before coding

- **Explicit trust model**: list trusted contracts, signers, oracles, and what breaks if each is compromised.
- **Token semantics**: fee-on-transfer, rebasing, ERC-777 hooks, approval race conditions - never assume `transfer` equals exact balance delta unless documented.
- **Upgradeability**: if using proxies, document storage layout discipline, initializer vs constructor, and migration risks (see [reference.md](reference.md)).

---

## Implementation rules of thumb

| Area | Rule |
|------|------|
| External calls | Avoid unbounded loops over user-controlled sets; cap iterations or use pull patterns. |
| ETH / native | Prefer `call` with limited gas over `transfer`/`send`; handle failed sends. |
| Approvals | Prefer `increaseAllowance` / permit patterns; document `approve` front-running if unavoidable. |
| Rounding | In favor of the protocol or LPs as documented; document directional bias. |
| Randomness | Never use block variables alone for unpredictability on L1/L2; use VRF or commit-reveal with clear assumptions. |
| Assembly | Only with documented justification; verify memory safety and optimizer behavior. |

---

## Testing expectations

- **Unit tests** for each externally reachable failure and success path.
- **Fuzzing** on amounts, addresses, and sequences of calls that touch state.
- **Invariants** for accounting: `sum(balances) == totalSupply`, collateral ratios, etc., where applicable.
- **Fork tests** when integrating external protocols - verify behavior on real deployment interfaces.

---

## Review checklist (minimum)

Use before suggesting code is "done":

- [ ] All `external`/`public` entrypoints: who can call, what can they drain or grief?
- [ ] Reentrancy: CEI or reentrancy guard on every path that calls out before final state.
- [ ] Integer math: correct type sizes; no unintended truncation; mul/div order for precision.
- [ ] Access control: `onlyOwner` / roles are minimal; no missing modifiers on state-changing functions.
- [ ] Pausability / emergency: defined, documented, and bounded.
- [ ] Events for state users care about (deposits, withdrawals, role changes).
- [ ] No sensitive values in `immutable` that must differ per deployment without migration story.
- [ ] Proxy: storage gaps, initializer `initializer` modifier, no self-destruct footguns.

Full categorization and common bug classes: [reference.md](reference.md).

---

## Output style for agents

When **writing** contracts: short rationale for non-obvious choices; cite invariants; flag integration risks.

When **auditing** or **reviewing**: ordered by severity (Critical / High / Medium / Low / Informational); each finding: location, impact, exploit sketch (if applicable), concrete fix.

---

## Optional scripts

If the repo has Slither: run `slither .` from project root and address or document findings. For Foundry: `forge test -vvv` and fuzz runs with generous `runs` in CI for critical code paths.
