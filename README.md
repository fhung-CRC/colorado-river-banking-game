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

## V0.1 — One Reservoir, Two Water Users

Version 0.1 represents a simplified water system with one reservoir and two water users.

### Physical System

| Parameter | V0.1 Assumption |
|---|---:|
| Reservoir capacity | 20 MAF |
| Annual inflow | Random, 2–10 MAF |
| Number of users | 2 |
| User A water right | 5 MAF/year |
| User B water right | 5 MAF/year |

### Water Rights

**User A is the senior water-right holder.**

**User B is the junior water-right holder.**

Current-year inflow is therefore allocated according to priority:

1. User A can receive up to 5 MAF.
2. Remaining available water can then be allocated to User B, up to 5 MAF.

For example:

| Annual Inflow | User A Allocation | User B Allocation |
|---:|---:|---:|
| 3 MAF | 3 MAF | 0 MAF |
| 5 MAF | 5 MAF | 0 MAF |
| 7 MAF | 5 MAF | 2 MAF |
| 10 MAF | 5 MAF | 5 MAF |

This priority rule applies to current-year supply. Previously banked water remains associated with the user who saved it unless it is explicitly transferred under future game rules.

---

## Water Banking

Each user can maintain a water-storage account in the reservoir.

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
| Demand-reduction cost | $80/AF | $40/AF |
| Supplemental water cost | $50–$100/AF | $50–$100/AF |

Supplemental-water prices vary between simulation years.

These differences create different economic incentives.

For example, User B has a relatively low demand-reduction cost and may prefer reducing water use rather than purchasing expensive supplemental water. User A may instead purchase supplemental water when its price is below the cost of reducing water use.

Future versions will allow users to make these decisions interactively rather than relying entirely on predetermined decision rules.

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

---

## V0.1 Development Goals

The first version will focus on building a transparent simulation engine and a simple web interface.

V0.1 will include:

- reproducible random hydrology;
- senior/junior priority allocation;
- individual storage accounts;
- reservoir capacity constraints;
- deposits and withdrawals;
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

### V0.1 — Toy Banking Model

One reservoir, two users, priority rights, banking, uncertain inflow, and basic economic decisions.

### V0.2 — Strategy Game

Add interactive player decisions, storage strategies, transaction costs, banking fees, water trading, performance metrics, and scenario comparisons.

### V0.3 — Basin Banking Model

Introduce Upper Basin, Lower Basin, and Federal/system accounts and experiment with explicit deficit-allocation rules.

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

V0.1 does **not** represent existing Colorado River law, the Colorado River Compact, current reservoir operating rules, Reclamation policy, or any official proposal.

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

🚧 **V0.1 — Initial development**

The immediate priority is to define and test the annual water-accounting rules before adding more complex game mechanics.

The guiding principle of the project is:

> **Every unit of water stored or depleted should be explicitly accounted for.**

---

## License
MIT
