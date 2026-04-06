# src/

## Responsibility
- `src/index.ts` delivers the oh-my-oc plugin by merging configuration, instantiating orchestrator/subagent definitions, wiring background managers, Zellij multiplexer helpers, built-in tools, MCPs, and lifecycle hooks so OpenCode sees a single cohesive module.
- `config/`, `agents/`, `tools/`, `background/`, `hooks/`, and `utils/` contain the reusable building blocks (loader/schema/constants, agent factories/permission helpers, tool factories, background polling/session managers, hook implementations, and shared helpers) that power that entry point.
- `cli/` exposes the install/update script (argument parsing + interactive prompts) that edits OpenCode config, installs recommended/custom skills, and updates provider credentials to bootstrap this plugin on a host machine.

## Design
- Agent creation follows explicit factories (`agents/index.ts`, per-agent creators under `agents/`) with override/permission helpers (`config/utils.ts`, `cli/skills.ts`) so defaults live in `config/constants.ts`, prompts can be swapped via `config/loader.ts`, and variant labels propagate through `utils/agent-variant.ts`.
- Background tooling composes `BackgroundTaskManager`, `MultiplexerSessionManager`, and `createBackgroundTools` (which uses `tool` with Zod schemas) to provide async/sync task launches plus cancel/output helpers; polling/prompt flow lives in `tools/background.ts` while multiplexer lifecycle is handled through `src/multiplexer/`.
- Hooks are isolated (`hooks/auto-update-checker`, `phase-reminder`, `post-read-nudge`) and exported via `hooks/index.ts`, so the plugin simply registers them via the `event`, `experimental.chat.messages.transform`, and `tool.execute.after` hooks defined in `index.ts`.
- Supplemental tools (`tools/grep`, `tools/lsp`, `tools/quota`) bundle ripgrep, LSP helpers, and Antigravity quota calls behind the OpenCode `tool` interface and are mounted in `index.ts` alongside background/task tools.

## Flow
- Startup: `index.ts` calls `loadPluginConfig` (user + project JSON + presets) to build a `PluginConfig`, passes it to `getAgentConfigs` (which uses `createAgents`, agent factories, `loadAgentPrompt`, and `getAgentMcpList`) and to `BackgroundTaskManager`/`MultiplexerSessionManager`/`createBackgroundTools` so the in-memory state matches user overrides.
- Plugin registration: `index.ts` registers agents, the tool map (background/task, `grep`, `ast_grep_*`, `lsp_*`, `antigravity_quota`), MCP definitions (`createBuiltinMcps`), and hooks (`createAutoUpdateCheckerHook`, `createPhaseReminderHook`, `createPostReadNudgeHook`); configuration hook merges those values back into the OpenCode config (default agent, permission rules parsed from `config/agent-mcps`, and MCP access policies).
- Runtime: `BackgroundTaskManager.launch` spins up sessions and prompts agents via the OpenCode client, `pollTask`/`pollSession` watch for idle status before resolving results, while `MultiplexerSessionManager` observes `session.created` events to spawn panes through the Zellij backend and close them when sessions idle or time out; tool hooks prevent recursion by toggling `background_task/task` permission when sending prompts.
- CLI flow: `cli/install.ts` parses flags, optionally asks interactive prompts, checks OpenCode installation, adds plugin entries via `cli/config-manager.ts`, disables default agents, writes the lite config (`cli/config-io.ts`), and installs skills (`cli/skills.ts`, `cli/custom-skills.ts`).

## Integration
- Connects directly to the OpenCode plugin API (`@opencode-ai/plugin`): registers agents/tools/mcps, responds to `session.created` and `tool.execute.after` events, injects `experimental.chat.messages.transform`, and makes RPC calls via `ctx.client`/`ctx.client.session` throughout `tools/background` and `background/*`.
- Integrates with the host environment: `src/multiplexer/zellij` checks Zellij/server availability, and `MultiplexerSessionManager`/`BackgroundTaskManager` coordinate via shared configuration and `tools/background` to keep panes synchronized.
- Hooks and helpers tie into external behavior: `hooks/auto-update-checker` reads `package.json` metadata, runs safe `bun install`, and posts toasts; `hooks/phase-reminder/post-read-nudge` enforce workflow reminders; `utils/logger.ts` centralizes structured logging used across modules.
- CLI utilities modify OpenCode CLI/user config files (`cli/config-manager.ts`) and install additional skills/ providers, ensuring the plugin lands with the expected agents, provider auth helpers, and custom skill definitions.
