# Claude Code Project Guidelines

## Behavior & Execution Rules
- **Token Efficiency:** Work in minimal-token execution mode. Keep explanations short.
- **Direct Edits Only:** Apply changes directly to target files. Do not scan unrelated folders or make exploratory repo passes.
- **No Automatic Commands:** Do NOT run test suites (`npm test`), linters, build checks, or type-checkers unless explicitly instructed by the user.
- **Single-Pass Refactoring:** Perform all multi-step edits in a single pass.

## Database Schema Constraints
- Events store venue/address combined inside `event.place`.
- Neighborhoods are stored as keys/codes in `event.neighborhood` (use the helper function to map them to display strings like "Neukölln").