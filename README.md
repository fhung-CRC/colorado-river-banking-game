# Colorado River Banking Game

An interactive web-based simulation for exploring reservoir storage, water banking, priority rights, conservation, and water-management decisions under uncertain hydrologic conditions.

## Project Overview

The **Colorado River Banking Game** is a conceptual simulation platform designed to explore how water users might behave if reservoir storage operates partly like a savings account.

Instead of treating reservoir storage simply as a system buffer, the model assigns stored water to explicit user accounts. Water users can conserve water and retain it in storage for future use, draw from their stored balance during shortages, and respond to changing hydrologic and economic conditions.

The long-term objective is to explore whether a banking framework can:

- encourage conservation and long-term water security;
- make responsibility for storage depletion more explicit;
- allow users to manage drought risk through savings;
- explore interactions between senior and junior water rights;
- support voluntary water transfers and markets;
- reduce reliance on unassigned reservoir storage to absorb shortages; and
- provide a transparent way to experiment with alternative Colorado River management concepts.

The initial versions intentionally use a highly simplified system so that the underlying incentives and accounting can be understood before introducing the complexity of the actual Colorado River Basin.

---

## Toy 1: Seniority + Banking

**Toy 1: Seniority + Banking** is the baseline model. It represents a simplified water system with one reservoir, two water users with senior/junior priority, and a Fed storage account.

### Physical System

| Parameter | V0.1 Assumption |
|---|---:|
| Reservoir capacity | 20 MAF |
| Annual inflow | Random, 2–15 MAF |
| Number of user accounts | 2 players + 1 Fed |
| User A water right | 5 MAF/year |
| User B water right | 5 MAF/year |

### Water Rights

**User A is the senior water-right holder.**

**User B is the junior water-right holder.**

Current-year inflow is therefore allocated according to priority:

1. User A can receive up to 5 MAF.
2. Remaining available water can then be allocated to User B, up to 5 MAF.

For example:

| Annual Inflow | User A Allocation | User B Allocation | Fed |
|---:|---:|---:|---:|
| 3 MAF | 3 MAF | 0 MAF | 0 MAF |
| 5 MAF | 5 MAF | 0 MAF | 0 MAF |
| 7 MAF | 5 MAF | 2 MAF | 0 MAF |
| 10 MAF | 5 MAF | 5 MAF | 0 MAF |
| 15 MAF | 5 MAF | 5 MAF | 5 MAF |

This priority rule applies to current-year supply. Previously banked water remains associated with the user who saved it unless it is explicitly transferred under future game rules.

---

## Water Banking

The reservoir tracks three water-storage accounts: User A, User B, and the Fed.

- User A bank limit: 10 MAF
- User B bank limit: 10 MAF
- Fed bank limit: 5 MAF
- Physical reservoir capacity: 20 MAF
- Infrastructure protection floor: 5 MAF

The account limits are individual ceilings, not guaranteed physical storage. Their nominal total exceeds the physical reservoir capacity, so the 20 MAF reservoir limit always controls.

Conceptually:

**Available water → Current use + Bank deposit**

and, during shortages:

**Current allocation + Bank withdrawal + Supplemental supply + Demand reduction = Water-demand response**

Water conserved and stored in one year can therefore provide additional security during future drought years.

The physical reservoir and the individual accounts are tracked separately:

**Physical storage**

> How much water is actually in the reservoir?

**Account storage**

> Whose banked water is represented by that storage?

The model is designed so that every unit of stored or depleted water can eventually be traced through the accounting system.

---

## Economics

Users have different costs for reducing their water use.

| Parameter | User A | User B |
|---|---:|---:|
| Demand-reduction cost | User input (default $80/AF) | User input (default $40/AF) |
| Supplemental water cost | User input (default $75/AF) | User input (default $75/AF) |

Supplemental-water cost is a game input, along with A and B demand-reduction costs.

These differences create different economic incentives.

For example, User B has a relatively low demand-reduction cost and may prefer reducing water use rather than purchasing expensive supplemental water. User A may instead purchase supplemental water when its price is below the cost of reducing water use.

The interactive prototype lets players make these decisions one year at a time. An optional economic-strategy button provides a simple cost-minimizing comparison strategy.

---

## Annual Simulation Sequence

Each simulation year will follow a transparent accounting sequence:

```text
Annual Inflow
      ↓
Priority Allocation
      ↓
Current Water Availability
      ↓
User Decisions
 ┌────┼───────────────┐
 ↓    ↓               ↓
Use  Save/Bank     Withdraw Savings
      ↓               ↓
      └──────┬────────┘
             ↓
 Supplemental Supply / Demand Reduction
             ↓
      Reservoir Accounting
             ↓
        Economic Costs
             ↓
          Next Year
```

A major development goal for V0.1 is to ensure that the annual water balance is explicit and internally consistent.

Previously banked water remains owned by the account holder. Bank withdrawals may not reduce reservoir storage below the fixed 5 MAF infrastructure-protection floor. If total player withdrawal requests exceed the water physically withdrawable above that floor, available water is shared pro rata across the requests. Seniority applies to current-year inflow allocation, not to access to previously banked water.

Annual inflow above the combined 10 MAF player rights is assigned to the Fed account, subject to its 5 MAF account limit and the reservoir's 20 MAF physical capacity. Fed storage is intended for future market sales, environmental or water-quality releases, or system resilience.

---

## Toy 1 Development Goals

The first version will focus on building a transparent simulation engine and a simple web interface.

Toy 1 includes:

- reproducible random hydrology;
- senior/junior priority allocation;
- three explicit storage accounts (A, B, and Fed);
- 20 MAF reservoir capacity and a fixed 5 MAF infrastructure-protection floor;
- deposits and pro-rata constrained withdrawals;
- supplemental-water purchases;
- demand reductions;
- annual economic costs;
- reservoir-storage tracking;
- account-balance tracking;
- annual water-accounting tables;
- charts showing simulation results; and
- automated water-balance tests.

The simulation engine will be kept separate from the user interface so that additional rules can be introduced without rebuilding the entire application.

---

## Planned Development

### Toy 1 — Seniority + Banking

One reservoir, two users plus a Fed account, priority rights, banking, uncertain 2–15 MAF inflow, a 5 MAF infrastructure-protection floor, pro-rata constrained withdrawals, and basic economic decisions.

### V0.2 — Strategy Game

Add interactive player decisions, storage strategies, transaction costs, banking fees, water trading, performance metrics, and scenario comparisons.

### V0.3 — Basin Banking Model

Introduce Upper Basin, Lower Basin, and Federal/Fed accounts and experiment with explicit deficit-allocation rules.

### V1.0 — Colorado River Simulation Platform

Potential future features include:

- Lake Powell and Lake Mead as separate reservoirs;
- Upper Basin and Lower Basin accounts;
- state-level accounts;
- Federal or system-resilience storage;
- evaporation and system losses;
- water transfers and markets;
- realistic or historical hydrology;
- drought scenarios;
- infrastructure constraints;
- policy scenario comparison; and
- integration with outputs from more detailed Colorado River models.

---

## Important Disclaimer

This project is currently a **conceptual simulation and research tool**.

Toy 1 does **not** represent existing Colorado River law, the Colorado River Compact, current reservoir operating rules, Reclamation policy, or any official proposal.

The simplified senior/junior priority system, storage accounts, economic assumptions, and banking rules are experimental mechanisms intended to help explore incentives and system behavior.

---

## Technology

The web application is planned to use:

- React
- TypeScript
- Vite
- GitHub for version control
- GitHub Pages for initial web deployment

The simulation engine will be developed independently from the visualization layer so that it can be tested and expanded over time.

---

## Repository Structure

Planned initial structure:

```text
colorado-river-banking-game/
├── README.md
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── simulation/
│   │   ├── model.ts
│   │   ├── allocation.ts
│   │   ├── economics.ts
│   │   └── types.ts
│   ├── components/
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
└── tests/
    └── simulation.test.ts
```

---

## Current Status

🚧 **Toy 1: Seniority + Banking — Baseline model**

Toy 1 is the baseline model for the project. It combines senior/junior current-year allocation with explicit banking accounts, configurable economic costs, a Fed account, a 5 MAF infrastructure-protection floor, and year-by-year player decisions.

The guiding principle of the project is:

> **Every unit of water stored or depleted should be explicitly accounted for.**

---

## License
MIT
