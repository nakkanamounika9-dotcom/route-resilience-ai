# Roadmap

- [ ] Implement Suurballe–Tarjan link-disjoint pair generation (`src/lib/network/resilience.ts`)
- [ ] Implement Dinitz max-flow/min-cut connectivity evaluation (`src/lib/network/resilience.ts`)
- [ ] Wire both into the route planning engine and backup ranking (`src/lib/network/engine.ts`)
- [ ] Add failure-scenario benchmark comparing route cost, computation time, recovery time and backup-path independence
- [ ] Surface resilience analysis + scenario benchmark in the Performance panel
- [ ] Unit tests: disjointness, min-cut and benchmark invariants
- [ ] Run tests and verify build
