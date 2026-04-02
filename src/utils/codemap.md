# src/utils/

Shared utility modules providing low-level services: environment variables, polling, logging, ZIP extraction, agent variant resolution, and internal agent marker handling.

## Responsibility

- **env.ts**: Cross-platform environment variable access supporting Bun and Node.js runtime with empty string filtering
- **internal-initiator.ts**: Marker-based identification for internal agent text parts in MCP protocol communication
- **polling.ts**: Generic polling utility with stability detection and abort signal support for asynchronous condition waiting
- **zip-extractor.ts**: Cross-platform ZIP/TAR extraction supporting Windows (tar, pwsh, powershell) and Unix (unzip)
- **logger.ts**: File-based structured logging to temp directory with timestamp and JSON serialization
- **agent-variant.ts**: Agent name normalization and variant resolution from plugin configuration with non-overriding application
- **index.ts**: Central re-export barrel for all utils

## Design

- **Defensive guards**: Empty string filtering on env vars, abort signal propagation in polling
- **Platform detection**: `process.platform` for OS-specific extraction strategy
- **Stability threshold**: Polling waits for N consecutive stable results before returning success
- **Non-overriding variant application**: Agent variant is applied only if body doesn't already contain one
- **PowerShell path escaping**: Single quotes escaped as doubled single quotes for Windows archive extraction

## Flow

**env.ts**:
- `getEnv(name)` → check `Bun.env` first → fallback to `process.env` → filter empty strings

**internal-initiator.ts**:
- `createInternalAgentTextPart()` → append marker to text
- `hasInternalInitiatorMarker()` → check if part.type === 'text' and contains marker

**polling.ts**:
- `pollUntilStable()` → loop with configurable interval → call fetchFn → check stability predicate → increment stable count on match → reset on failure → return on threshold or timeout
- `delay(ms)` → Promise-wrapped setTimeout

**zip-extractor.ts**:
- `extractZip()` → detect platform → Windows: check build number for tar support, fallback to pwsh/powershell → Unix: use unzip → spawn process → await exit code → throw on failure

**logger.ts**:
- `log()` → construct timestamp → serialize data to JSON → append to temp log file → catch and ignore errors

**agent-variant.ts**:
- `normalizeAgentName()` → trim whitespace → strip @ prefix
- `resolveAgentVariant()` → normalize name → lookup in config.agents → validate type and non-empty → return trimmed variant
- `applyAgentVariant()` → return original body if variant falsy or body already has variant → spread merge variant into body

## Integration

- **Consumers**: MCP protocol layer checks for internal initiator markers, polling used by background task status monitoring, ZIP extraction for plugin updates, agent variant applied in request pipeline
- **Dependencies**: Imports constants from `../config`, logging from `./logger`, and `PluginConfig` type from `../config`
- **Exports**: All modules re-exported via `src/utils/index.ts` barrel file
