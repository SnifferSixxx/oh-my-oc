# Configuration Reference

Complete reference for all configuration files and options in oh-my-oc.

---

## Config Files

| File | Purpose |
|------|---------|
| `~/.config/opencode/opencode.json` | OpenCode core settings (plugin registration, providers) |
| `~/.config/opencode/oh-my-oc.json` | Plugin settings — agents, multiplexer, MCPs, council |
| `~/.config/opencode/oh-my-oc.jsonc` | Same, but with JSONC (comments + trailing commas). Takes precedence over `.json` if both exist |
| `.opencode/oh-my-oc.json` | Project-local overrides (optional, checked first) |

> **💡 JSONC recommended:** Use the `.jsonc` extension to add comments and trailing commas. If both `.jsonc` and `.json` exist, `.jsonc` takes precedence. Legacy config files are still read if the new files are absent.

---

## Prompt Overriding

Customize agent prompts without modifying source code. Create markdown files in `~/.config/opencode/oh-my-opencode-slim/`:

| File | Effect |
|------|--------|
| `{agent}.md` | Replaces the agent's default prompt entirely |
| `{agent}_append.md` | Appends custom instructions to the default prompt |

When a `preset` is active, the plugin checks `~/.config/opencode/oh-my-opencode-slim/{preset}/` first, then falls back to the root directory.

**Example directory structure:**

```
~/.config/opencode/oh-my-opencode-slim/
  ├── best/
  │   ├── orchestrator.md        # Preset-specific override (used when preset=best)
  │   └── explorer_append.md
  ├── orchestrator.md            # Fallback override
  ├── orchestrator_append.md
  ├── explorer.md
  └── ...
```

Both `{agent}.md` and `{agent}_append.md` can coexist — the full replacement takes effect first, then the append. If neither exists, the built-in default prompt is used.

---

## JSONC Format

All config files support **JSONC** (JSON with Comments):

- Single-line comments (`//`)
- Multi-line comments (`/* */`)
- Trailing commas in arrays and objects

**Example:**

```jsonc
{
  // Active preset
  "preset": "openai",

  /* Agent model mappings */
  "presets": {
    "openai": {
      "oracle": { "model": "openai/gpt-5.4" },
      "explorer": { "model": "openai/gpt-5.4-mini" },
    },
  },

  "multiplexer": {
    "type": "zellij"
  },
}
```

---

## Full Option Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `preset` | string | — | Active preset name (e.g. `"openai"`, `"best"`) |
| `presets` | object | — | Named preset configurations |
| `presets.<name>.<agent>.model` | string | — | Model ID in `provider/model` format |
| `presets.<name>.<agent>.temperature` | number | — | Temperature (0–2) |
| `presets.<name>.<agent>.variant` | string | — | Reasoning effort: `"low"`, `"medium"`, `"high"` |
| `presets.<name>.<agent>.skills` | string[] | — | Skills the agent can use (`"*"`, `"!item"`, explicit list) |
| `presets.<name>.<agent>.mcps` | string[] | — | MCPs the agent can use (`"*"`, `"!item"`, explicit list) |
| `multiplexer.type` | string | `"none"` | `zellij` or `none` |
| `multiplexer.layout` | string | `"main-vertical"` | Retained for schema consistency; Zellij ignores tmux-style layout control |
| `multiplexer.main_pane_size` | number | `60` | Retained for schema consistency; Zellij ignores tmux-style main pane sizing |
| `disabled_mcps` | string[] | `[]` | MCP server IDs to disable globally |
| `fallback.enabled` | boolean | `false` | Enable model failover on timeout/error. Disabled by default, so fallback chains only run when you opt in |
| `fallback.timeoutMs` | number | `15000` | Time before aborting and trying next model |
| `fallback.retryDelayMs` | number | `500` | Delay between retry attempts |
| `fallback.chains.<agent>` | string[] | — | Ordered fallback model IDs for an agent |
| `fallback.retry_on_empty` | boolean | `true` | Treat silent empty provider responses (0 tokens) as failures and retry. Set `false` to accept empty responses |
| `council.master.model` | string | — | **Required if using council.** Council master model |
| `council.master.variant` | string | — | Council master variant |
| `council.master.prompt` | string | — | Optional synthesis guidance for the master |
| `council.presets` | object | — | **Required if using council.** Named councillor presets |
| `council.presets.<name>.<councillor>.model` | string | — | Councillor model |
| `council.presets.<name>.<councillor>.variant` | string | — | Councillor variant |
| `council.presets.<name>.<councillor>.prompt` | string | — | Optional role guidance for the councillor |
| `council.presets.<name>.master.model` | string | — | Override global master model for this preset |
| `council.presets.<name>.master.variant` | string | — | Override global master variant for this preset |
| `council.presets.<name>.master.prompt` | string | — | Override global master prompt for this preset |
| `council.default_preset` | string | `"default"` | Default preset when none is specified |
| `council.master_timeout` | number | `300000` | Master synthesis timeout (ms) |
| `council.councillors_timeout` | number | `180000` | Per-councillor timeout (ms) |
| `council.master_fallback` | string[] | — | Fallback models for the council master |
| `council.councillor_retries` | number | `3` | Max retries per councillor and master on empty provider response (0–5) |
