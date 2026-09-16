# Design brief — DisplayHub

Status: draft; technical and visual inventory required before prototype generation.

## Purpose
Create a visual-only prototype for the existing DisplayHub Overview / monitoring screen. Preserve the existing product functionality and terminology; confirm the actual screen structure and data fields in the current repository before sending this brief to AI Studio.

## Existing technical contract
- React 19, TypeScript 5, Vite 8.
- Supabase is the real source of truth, but must NOT be connected to the visual prototype.
- Reuse existing UI conventions and packages where feasible; avoid introducing new dependencies without justification.
- Work on an isolated prototype branch/repository. Never write directly to main.

## Screen scope
- Overview and display monitoring only.
- Show display identity, online/offline status, associated playlist and operational state ONLY where supported by actual existing functionality.
- Existing navigation and operations should be inventoried before changing presentation.
- Use obviously fictitious demo data; do not display or retrieve real customers or credentials.

## Visual direction
Clean, impactful commercial monitoring interface with strong information hierarchy, restrained explanatory copy, consistent cards, tables and controls, accessible contrast and responsive desktop/tablet/mobile layouts. Produce loading, empty, error and success states without inventing backend behavior.

## Hard limits
- Do not edit production code, Supabase, migrations, RBAC, auth, endpoints, or business logic.
- Do not invent operational features or represent mocked interactions as real.
- Do not replace the existing app architecture.
- Preserve the approved visual appearance during subsequent integration; functional correctness is independently required.

## AI Studio deliverables
1. Navigable visual prototype with complete source code.
2. Reusable presentation components, organized style files, demo fixtures.
3. Concrete `DESIGN_TOKENS.json` values for approved design (no guessed production defaults).
4. Completed `DESIGN_HANDOFF.md` mapping screens/components/interactions/fixtures and integration risks.
5. Approved screenshots placed under `DESIGN_REFERENCE/` after user approval.

## Acceptance
Visual approval by the user is separate from functional acceptance. ChatGPT must inspect the source and prototype, integrate incrementally in a small branch/PR, run checks, check deployment and request real functional validation before declaring homologation.
