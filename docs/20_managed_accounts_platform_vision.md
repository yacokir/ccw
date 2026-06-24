# Managed Accounts Platform Vision

## Purpose And Scope

This document defines a long-term future vision and research boundary for a possible managed accounts platform built around the CCW research program.

It is not an implementation plan, not a production trading specification, not a client offering, and not a regulatory conclusion. Its purpose is to preserve strategic direction while keeping current research, backtesting, manual live pilot, and monitoring workflows protected from premature execution-platform work.

Track B work described here is:

- Experimental only.
- Paper-environment only.
- Non-production.
- Isolated from the manual live pilot.
- Not allowed to interact with current live monitoring workflows.
- Not allowed to automatically execute strategies at this stage.

## Track A / Track B Separation

The project now has two intentionally separate tracks.

### Track A - Current Project Scope

Track A contains the current CCW research system:

- Research.
- Backtesting.
- Manual live pilot.
- Monitoring infrastructure.
- Read-only account synchronization where used by the manual live pilot.
- Operator snapshots and reports.

Track A remains the source of current research evidence and manual monitoring practice. It must not be modified by Track B experiments.

### Track B - New Research Track

Track B is a separate execution laboratory track:

- Execution Laboratory.
- Capital Requirements Research.
- Execution Foundations.
- Order Lifecycle Research.
- Reconciliation.
- Idempotency.
- Circuit Breakers.

Track B must remain isolated from Track A. It should use separate documentation, separate test or paper artifacts, separate configuration assumptions, and separate runtime entry points if code is eventually added.

## Current Project Scope

The current project is a research-grade Dynamic Covered Call Risk Management Framework. It includes historical CCW research, BTC and ETH baseline selection, Daily Approximate MTM research, Passive Hedge Monitoring research, hedge simulation research, and a manual live pilot.

The current live pilot is not an automated trading system. It supports manual observation and monitoring. Existing live workflows may retrieve read-only account and market data, generate snapshots, and produce reports, but they are not a production execution system.

## Long-Term Product Vision

The long-term vision is a non-custodial managed accounts platform that can support multiple accounts, multiple strategies, explicit capital requirements, auditable order lifecycle handling, and risk-controlled paper execution before any production pathway is considered.

This vision depends on future evidence from Track B. It should not be interpreted as a commitment to launch, operate, market, or deploy a managed accounts product.

## Execution Laboratory Principles

The Execution Laboratory exists to study execution mechanics without contaminating Track A.

Principles:

- Paper environment first.
- No production trading.
- No automatic strategy execution.
- No interaction with Track A live monitoring workflows.
- No mutation of Track A live state.
- Explicit operator visibility for every simulated order state.
- Idempotent design before any order lifecycle expansion.
- Reconciliation before performance interpretation.
- Circuit breakers before strategy automation.

## Core Principles

- Isolation: research, monitoring, and execution-lab concerns must remain separated.
- Auditability: decisions, simulated orders, state transitions, and reconciliations must be reconstructable.
- Reproducibility: the same inputs and assumptions should produce the same paper results.
- Conservatism: no operational conclusion should be drawn before fees, funding, slippage, basis, margin, collateral, partial fills, and liquidation risks are studied.
- Explicit limitations: every research artifact should state what it does not prove.

## Strategic Objectives

Long-term objectives:

- Understand whether CCW and hedge-overlay research can be translated into robust operating models.
- Define strategy-level capital requirements empirically.
- Study account-level and strategy-level reconciliation.
- Build a paper-only order lifecycle model.
- Define idempotency rules for repeated or interrupted operations.
- Define circuit breaker classes before any production design.
- Preserve a clear migration path from research evidence to controlled paper operations.

## High-Level Operating Model

A future platform model would separate:

- Strategy research.
- Strategy configuration.
- Account configuration.
- Capital requirement checks.
- Paper order intent.
- Paper order lifecycle.
- Reconciliation.
- Risk review.
- Audit records.
- Operator reporting.

At this stage, this model is conceptual. No production operating model has been validated.

## Non-Custodial Model

The intended long-term direction is non-custodial.

Conceptually, users would retain control of their own exchange accounts or account permissions. Any future platform design would need strict permission boundaries, minimal required access, withdrawal-disabled API assumptions, and clear separation between signal generation, order intent, and account authority.

This document does not determine whether such a model is legally, operationally, or commercially viable.

## Multi-Tenant Principles

A future managed accounts platform would need to treat each account as an isolated tenant.

Principles:

- Account-level data isolation.
- Account-level configuration isolation.
- Account-level risk limits.
- Account-level capital checks.
- Account-level reconciliation.
- No cross-account state leakage.
- No shared mutable execution state unless explicitly designed and audited.

## Multi-Strategy Principles

The platform vision may eventually support multiple strategies, but strategy expansion should remain conservative.

Principles:

- Each strategy needs its own capital requirements.
- Each strategy needs its own risk limits.
- Each strategy needs independent reconciliation logic.
- Shared account collateral must be treated as a portfolio constraint.
- Strategy interactions must be modeled before multiple strategies share an account.

## High-Level Architecture

The future architecture should keep these domains separate:

```text
Research Layer
-> Strategy Definition Layer
-> Capital Requirements Layer
-> Paper Execution Laboratory
-> Reconciliation Layer
-> Audit And Reporting Layer
```

The current Track A live monitoring workflows are not part of the Track B execution laboratory. Track B should not call, modify, or depend on current live monitoring entry points.

## Security Principles

Security principles for any future platform research:

- Use paper or test environments first.
- Avoid production credentials during laboratory work.
- Prefer read-only access when execution authority is not required.
- Never require withdrawal permissions.
- Keep secrets out of versioned files.
- Minimize credential scope.
- Log security-relevant state transitions without leaking secrets.

## Reliability Principles

Reliability work should be established before any execution automation is considered.

Required research areas:

- Restart behavior.
- Duplicate command handling.
- Interrupted operation recovery.
- Network failure behavior.
- Venue outage behavior.
- Stale data handling.
- Reconciliation after partial completion.
- Clear operator-facing failure states.

## Idempotent Execution

Idempotency is a first-class requirement for Track B.

Future execution-lab work should distinguish:

- Strategy decision.
- Order intent.
- Order request.
- Venue acknowledgment.
- Fill state.
- Cancel request.
- Final reconciled state.

Repeated runs must not create duplicate simulated orders or duplicate intended exposure. Every order intent should have a stable identity, a lifecycle state, and reconciliation evidence.

## Audit Principles

Audit artifacts should preserve:

- Timestamped strategy inputs.
- Capital checks.
- Risk checks.
- Order intent.
- Simulated order state changes.
- Reconciliation results.
- Circuit breaker triggers.
- Operator interventions.
- Configuration versions.

Audit logs should support reconstruction of what the system intended, what was simulated, what was reconciled, and what remained unresolved.

## Risk Management Principles

Future risk design must include:

- Strategy-level limits.
- Account-level limits.
- Capital buffers.
- Margin buffers.
- Liquidity constraints.
- Stale data rules.
- Venue availability rules.
- Circuit breakers.
- Manual override boundaries.

No risk control described here is validated for production use.

## Performance Fee Principles

Performance fee design is a future product and legal question. It should not be implemented or assumed during current research.

Any future fee model would need to define:

- High-water mark logic.
- Realized versus unrealized performance treatment.
- Fee crystallization periods.
- Loss carryforward.
- Account deposits and withdrawals.
- Strategy allocation changes.
- Tax and regulatory implications.

No fee policy is selected in this document.

## Regulatory Considerations

Managed accounts, automated execution, investment advice, performance fees, custody, marketing, and client allocation may create regulatory obligations.

This document does not provide legal advice and does not conclude that any future product is permitted. Regulatory review would be required before any real client, production trading, marketing, or fee-charging activity.

## Migration Path

A conservative migration path would be:

1. Preserve Track A as research, backtesting, manual live pilot, and monitoring.
2. Create Track B documentation and paper-only research artifacts.
3. Define strategy capital requirements.
4. Model paper order lifecycle.
5. Add paper reconciliation.
6. Add idempotency and circuit breaker research.
7. Validate paper behavior under failure scenarios.
8. Reassess whether any production path is appropriate.

No step in this migration path authorizes production trading.

## Open Questions

- What minimum capital is required for each strategy under realistic margin and collateral assumptions?
- How should account equity, available collateral, intended exposure, and executed exposure be reconciled?
- Which venue environments are suitable for paper execution research?
- How should partial fills and stale orders be represented?
- What circuit breakers are mandatory before any automated order placement could be considered?
- How should multi-strategy collateral conflicts be resolved?
- What audit format is sufficient for later review?
- What regulatory constraints would apply to any managed account model?

## Appendix A - Lessons Learned From Live Pilot

The manual live pilot provides several useful lessons for future Track B research:

- Read-only monitoring and execution intent must remain separate.
- Operator reports are valuable when they expose current state, warnings, and limitations clearly.
- Local operational state is useful, but it is not a full ledger.
- Account synchronization can improve monitoring, but unavailable credentials or venue issues must not break reporting.
- Snapshot naming and archived reports improve auditability.
- Circuit breakers need explicit reasons and preserved skipped intent.
- Approximate live accounting is helpful for observation, but it should not be treated as production ledger accounting.

These lessons inform Track B research, but Track B must not reuse the current manual live pilot as an execution substrate.
