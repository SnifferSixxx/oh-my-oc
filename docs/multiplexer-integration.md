# Multiplexer Integration Guide

Zellij is the only supported multiplexer in this fork.

## Quick Setup

Config:

```json
{
  "multiplexer": {
    "type": "zellij"
  }
}
```

Run OpenCode inside Zellij:

```bash
zellij
export OPENCODE_PORT=4096
opencode --port 4096
```

## Behavior

- background agents open inside a dedicated Zellij tab
- the tab is named `opencode-agents`
- the first agent reuses the initial pane in that tab
- later agents open additional panes in the same tab
- your active tab is restored after pane creation

## Notes

- `layout` and `main_pane_size` remain in the schema for config consistency, but Zellij does not use tmux-style layout control
- `multiplexer.type` supports `zellij` or `none`
- this integration depends on running OpenCode with a reachable port and matching `OPENCODE_PORT`

## Troubleshooting

### No agent panes appear

Check:

```bash
echo "$ZELLIJ"
echo "$OPENCODE_PORT"
```

Then start OpenCode with:

```bash
opencode --port "${OPENCODE_PORT:-4096}"
```

### Zellij not installed

Install Zellij using your system package manager, then verify:

```bash
zellij --version
```

## Related

- `docs/installation.md`
- `docs/configuration.md`
