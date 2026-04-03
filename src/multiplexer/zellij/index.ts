/**
 * Zellij multiplexer implementation
 *
 * Creates a dedicated tab per background session for sub-agent panes.
 * - Every background agent gets its own tab
 * - Tabs are never split into multiple panes for additional agents
 * - User stays in their original tab when possible
 */

import { spawn } from 'bun';
import type { MultiplexerLayout } from '../../config/schema';
import type { Multiplexer, PaneResult } from '../types';

interface ZellijPaneInfo {
  id: number;
  tab_id: number;
  is_focused: boolean;
  is_plugin?: boolean;
}

export class ZellijMultiplexer implements Multiplexer {
  readonly type = 'zellij' as const;

  private binaryPath: string | null = null;
  private hasChecked = false;
  private storedLayout: MultiplexerLayout;
  private storedMainPaneSize: number;

  constructor(layout: MultiplexerLayout = 'main-vertical', mainPaneSize = 60) {
    this.storedLayout = layout;
    this.storedMainPaneSize = mainPaneSize;
  }

  async isAvailable(): Promise<boolean> {
    if (this.hasChecked) {
      return this.binaryPath !== null;
    }
    this.binaryPath = await this.findBinary();
    this.hasChecked = true;
    return this.binaryPath !== null;
  }

  isInsideSession(): boolean {
    return !!process.env.ZELLIJ;
  }

  async spawnPane(
    sessionId: string,
    description: string,
    serverUrl: string,
  ): Promise<PaneResult> {
    const zellij = await this.getBinary();
    if (!zellij) return { success: false };

    try {
      // Extract agent name from "[agent] description" format
      const agentName = this.extractAgentName(description);
      const originalTab = await this.getCurrentTabId(zellij);

      try {
        return await this.createSessionTab(
          zellij,
          agentName,
          sessionId,
          serverUrl,
          description,
        );
      } finally {
        if (originalTab) {
          await spawn(
            [zellij, 'action', 'go-to-tab-by-id', String(originalTab)],
            {
              stdout: 'ignore',
              stderr: 'ignore',
            },
          ).exited;
        }
      }
    } catch {
      return { success: false };
    }
  }

  async renameCurrentTab(name: string): Promise<void> {
    const zellij = await this.getBinary();
    if (!zellij) return;
    await spawn([zellij, 'action', 'rename-tab', name], {
      stdout: 'ignore',
      stderr: 'ignore',
    }).exited;
  }

  async renameTab(tabId: string, name: string): Promise<void> {
    const zellij = await this.getBinary();
    if (!zellij) return;
    await spawn([zellij, 'action', 'rename-tab-by-id', tabId, name], {
      stdout: 'ignore',
      stderr: 'ignore',
    }).exited;
  }

  private extractAgentName(description: string): string {
    const match = description.match(/^\[([^\]]+)\]/);
    return match ? match[1] : 'agent';
  }

  private async createSessionTab(
    zellij: string,
    agentName: string,
    sessionId: string,
    serverUrl: string,
    _description: string,
  ): Promise<PaneResult> {
    const tabName = agentName;
    const opencodeCmd = `opencode attach ${serverUrl} --session ${sessionId}`;

    const createProc = spawn(
      [
        zellij,
        'action',
        'new-tab',
        '--name',
        tabName,
        '--close-on-exit',
        '--',
        'sh',
        '-c',
        opencodeCmd,
      ],
      {
        stdout: 'pipe',
        stderr: 'pipe',
      },
    );

    const createExit = await createProc.exited;
    if (createExit !== 0) return { success: false };

    const stdout = await new Response(createProc.stdout).text();
    const tabId = stdout.trim();
    if (!tabId) return { success: false };

    const firstPaneId = await this.getPaneInTab(zellij, tabId);
    if (!firstPaneId) return { success: false };

    return { success: true, paneId: firstPaneId, tabId };
  }

  private async getPaneInTab(
    zellij: string,
    tabId: string,
  ): Promise<string | null> {
    const panes = await this.listPanes(zellij);

    const focusedPane = panes.find(
      (pane) =>
        pane.tab_id === Number(tabId) && pane.is_focused && !pane.is_plugin,
    );

    return focusedPane ? `terminal_${focusedPane.id}` : null;
  }

  private async getCurrentTabId(zellij: string): Promise<string | null> {
    try {
      const proc = spawn([zellij, 'action', 'current-tab-info', '--json'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const exitCode = await proc.exited;
      if (exitCode !== 0) return null;

      const stdout = await new Response(proc.stdout).text();
      const info = JSON.parse(stdout) as { tab_id?: number };
      return info.tab_id !== undefined ? String(info.tab_id) : null;
    } catch {
      return null;
    }
  }

  private async listPanes(zellij: string): Promise<ZellijPaneInfo[]> {
    try {
      const proc = spawn([zellij, 'action', 'list-panes', '--json'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const exitCode = await proc.exited;
      if (exitCode !== 0) return [];

      const stdout = await new Response(proc.stdout).text();
      return JSON.parse(stdout) as ZellijPaneInfo[];
    } catch {
      return [];
    }
  }

  async closePane(paneId: string): Promise<boolean> {
    if (!paneId || paneId === 'unknown') return true;

    const zellij = await this.getBinary();
    if (!zellij) return false;

    try {
      // Send Ctrl+C for graceful shutdown
      await spawn([zellij, 'action', 'write', '--pane-id', paneId, '\u0003'], {
        stdout: 'ignore',
        stderr: 'ignore',
      }).exited;

      await new Promise((r) => setTimeout(r, 250));

      // Close the pane
      const proc = spawn(
        [zellij, 'action', 'close-pane', '--pane-id', paneId],
        { stdout: 'pipe', stderr: 'pipe' },
      );

      const exitCode = await proc.exited;
      return exitCode === 0 || exitCode === 1;
    } catch {
      return false;
    }
  }

  async closeTab(tabId: string): Promise<boolean> {
    if (!tabId || tabId === 'unknown') return true;

    const zellij = await this.getBinary();
    if (!zellij) return false;

    try {
      const proc = spawn([zellij, 'action', 'close-tab-by-id', tabId], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const exitCode = await proc.exited;
      return exitCode === 0 || exitCode === 1;
    } catch {
      return false;
    }
  }

  async applyLayout(
    _layout: MultiplexerLayout,
    _mainPaneSize: number,
  ): Promise<void> {
    void this.storedLayout;
    void this.storedMainPaneSize;
    // No-op for zellij - zellij uses its own native layout algorithm.
    // Unlike tmux, zellij does not support programmatic layout control.
  }

  private async getBinary(): Promise<string | null> {
    await this.isAvailable();
    return this.binaryPath;
  }

  private async findBinary(): Promise<string | null> {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    try {
      const proc = spawn([cmd, 'zellij'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });
      if ((await proc.exited) !== 0) return null;
      const stdout = await new Response(proc.stdout).text();
      return stdout.trim().split('\n')[0] || null;
    } catch {
      return null;
    }
  }
}
