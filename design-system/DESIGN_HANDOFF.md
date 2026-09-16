# Design handoff — DisplayHub

Status: awaiting AI Studio prototype and user visual approval.

## Provenance
Original repository: `Mgteixeira2112/displayhub`.
Design branch: `design/displayhub-piloto` (documentation only).
Prototype source location and commit: TO BE FILLED.

## Files and components
List every source file, reusable UI component and its responsibilities. TO BE FILLED after prototype.

## Approved tokens
Fill `DESIGN_TOKENS.json` with real values from approved prototype. Do not guess or change existing production colors before approval.

## Screen and navigation map
Document every proposed screen, existing route and visual interaction. Mark every mocked action explicitly. TO BE FILLED.

## Integration mapping
Map mock fixtures to existing real data contracts and user actions; check authorization boundaries and existing components before changing code. TO BE FILLED.

## Forbidden substitutions
No fake backend in production. Do not replace Supabase, authentication, permissions, API contracts, migrations or business rules. No credentials or customer data in AI Studio prototype.

## Visual references
Store approved screenshots in `DESIGN_REFERENCE/`. Compare implementation against them at each integration checkpoint.

## Validation and release
Inspect source and prototype → assess differences → small integration branch → PR → CI green → migration only when truly necessary → validate Supabase → merge → verify main/Pages → real browser tests → final database validation. A passing build is not functional or visual homologation.
