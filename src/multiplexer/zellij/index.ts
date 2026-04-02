/**
 * Zellij multiplexer implementation
 *
 * Creates a dedicated tab per agent type for sub-agent panes.
 * - Each agent type (explorer, fixer, etc.) gets its own named tab
 * - First pane per agent reuses the default pane from new-tab
 * - Subsequent panes for the same agent open in the same tab
 * - User stays in their original tab
 */

import { spawn } from 'bun';
import type { MultiplexerLayout } from '../../config/schema';
import type { Multiplexer, PaneResult } from '../types';

interface ZellijTabInfo {
  position: number;
  name: string;
  active: boolean;
  tab_id: number;
}

interface AgentTabState {
  tabId: string;
  firstPaneId: string | null;
  firstPaneUsed: boolean;
}

export class ZellijMultiplexer implements Multiplexer {
  readonly type = 'zellij' as const;

  private binaryPath: string | null = null;
  private hasChecked = false;
  private storedLayout: MultiplexerLayout;
  private storedMainPaneSize: number;
  private agentTabs = new Map<string, AgentTabState>();

  constructor(layout: MultiplexerLayout = 'main-vertical', mainPaneSize = 60) {
    // Note: Zellij does NOT support layout configuration like tmux.
    // These params are accepted for API consistency but are no-ops.
    // Zellij uses its own native layout algorithm for pane arrangement.
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

      // Ensure a tab exists for this agent
      let tabState = this.agentTabs.get(agentName);
      if (!tabState) {
        const result = await this.ensureAgentTab(zellij, agentName);
        if (!result) return { success: false };
        tabState = {
          tabId: result.tabId,
          firstPaneId: result.firstPaneId,
          firstPaneUsed: false,
        };
        this.agentTabs.set(agentName, tabState);
      }

      // Use the default pane from new-tab for the first pane in this agent tab
      if (!tabState.firstPaneUsed && tabState.firstPaneId) {
        const success = await this.runInPane(
          zellij,
          tabState.firstPaneId,
          sessionId,
          serverUrl,
          description,
        );
        if (success) {
          tabState.firstPaneUsed = true;
          return { success: true, paneId: tabState.firstPaneId };
        }
        // fall through to createPaneInAgentTab on failure
      }

      // Create additional pane in this agent's tab
      return await this.createPaneInAgentTab(
        zellij,
        tabState.tabId,
        sessionId,
        serverUrl,
        description,
      );
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

  private extractAgentName(description: string): string {
    const match = description.match(/^\[([^\]]+)\]/);
    return match ? match[1] : 'agent';
  }

  private async createPaneInAgentTab(
    zellij: string,
    agentTabId: string,
    sessionId: string,
    serverUrl: string,
    description: string,
  ): Promise<PaneResult> {
    const opencodeCmd = `opencode attach ${serverUrl} --session ${sessionId}`;
    const paneName = description.slice(0, 30).replace(/"/g, '\\"');

    const currentTabId = await this.getCurrentTabId(zellij);
    const inAgentTab = currentTabId === agentTabId;

    if (inAgentTab) {
      // Already in agent tab, create pane directly
      const args = [
        'action',
        'new-pane',
        '--name',
        paneName,
        '--close-on-exit',
        '--',
        'sh',
        '-c',
        opencodeCmd,
      ];

      const proc = spawn([zellij, ...args], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const exitCode = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const paneId = stdout.trim();

      // Accept success if exit code is 0 and we got a valid pane ID
      if (exitCode === 0 && paneId?.startsWith('terminal_')) {
        return { success: true, paneId };
      }
      return { success: false };
    }

    // Get current tab before switching
    const originalTab = await this.getCurrentTabId(zellij);

    // Switch to agent tab
    await spawn([zellij, 'action', 'go-to-tab-by-id', agentTabId], {
      stdout: 'ignore',
      stderr: 'ignore',
    }).exited;

    // Create pane
    const args = [
      'action',
      'new-pane',
      '--name',
      paneName,
      '--close-on-exit',
      '--',
      'sh',
      '-c',
      opencodeCmd,
    ];

    const proc = spawn([zellij, ...args], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const paneId = stdout.trim();

    // Switch back to original tab
    if (originalTab) {
      await spawn([zellij, 'action', 'go-to-tab-by-id', String(originalTab)], {
        stdout: 'ignore',
        stderr: 'ignore',
      }).exited;
    }

    // Accept success if exit code is 0 and we got a valid pane ID
    if (exitCode === 0 && paneId?.startsWith('terminal_')) {
      return { success: true, paneId };
    }
    return { success: false };
  }

  private async runInPane(
    zellij: string,
    paneId: string,
    sessionId: string,
    serverUrl: string,
    description: string,
  ): Promise<boolean> {
    try {
      const opencodeCmd = `opencode attach ${serverUrl} --session ${sessionId}`;

      await spawn([zellij, 'action', 'focus-pane', '--pane-id', paneId], {
        stdout: 'ignore',
        stderr: 'ignore',
      }).exited;

      await spawn(
        [zellij, 'action', 'rename-pane', '--name', description.slice(0, 30)],
        { stdout: 'ignore', stderr: 'ignore' },
      ).exited;

      await spawn([zellij, 'action', 'write-chars', opencodeCmd], {
        stdout: 'ignore',
        stderr: 'ignore',
      }).exited;

      await spawn([zellij, 'action', 'write-chars', '\n'], {
        stdout: 'ignore',
        stderr: 'ignore',
      }).exited;

      return true;
    } catch {
      return false;
    }
  }

  private async ensureAgentTab(
    zellij: string,
    agentName: string,
  ): Promise<{ tabId: string; firstPaneId: string } | null> {
    try {
      // Try to find existing tab for this agent
      const existingTab = await this.findTabByName(zellij, agentName);
      if (existingTab) {
        const firstPane = await this.getFirstPaneInTab(
          zellij,
          existingTab.tabId,
        );
        return {
          tabId: existingTab.tabId,
          firstPaneId: firstPane || 'terminal_0',
        };
      }

      // Get panes before creating tab
      const beforePanes = await this.listPanes(zellij);

      // Create new tab named after the agent
      const createProc = spawn(
        [zellij, 'action', 'new-tab', '--name', agentName],
        { stdout: 'pipe', stderr: 'pipe' },
      );
      const createExit = await createProc.exited;
      if (createExit !== 0) return null;

      // Get the new tab info
      const newTab = await this.findTabByName(zellij, agentName);
      if (!newTab) return null;

      // Get the new pane
      const afterPanes = await this.listPanes(zellij);
      const newPane = afterPanes.find((p) => !beforePanes.includes(p));

      return { tabId: newTab.tabId, firstPaneId: newPane || 'terminal_0' };
    } catch {
      return null;
    }
  }

  private async getFirstPaneInTab(
    zellij: string,
    tabId: string,
  ): Promise<string | null> {
    const originalTab = await this.getCurrentTabId(zellij);
    await spawn([zellij, 'action', 'go-to-tab-by-id', tabId], {
      stdout: 'ignore',
      stderr: 'ignore',
    }).exited;

    const panes = await this.listPanes(zellij);

    // Restore original tab
    if (originalTab) {
      await spawn([zellij, 'action', 'go-to-tab-by-id', String(originalTab)], {
        stdout: 'ignore',
        stderr: 'ignore',
      }).exited;
    }

    return panes[0] || null;
  }

  private async findTabByName(
    zellij: string,
    name: string,
  ): Promise<{ tabId: string; name: string } | null> {
    try {
      const proc = spawn([zellij, 'action', 'list-tabs', '--json'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const exitCode = await proc.exited;
      if (exitCode !== 0) return this.findTabByNameText(zellij, name);

      const stdout = await new Response(proc.stdout).text();

      try {
        const tabs: ZellijTabInfo[] = JSON.parse(stdout);
        for (const tab of tabs) {
          if (tab.name === name) {
            return { tabId: String(tab.tab_id), name: tab.name };
          }
        }
      } catch {
        return this.findTabByNameText(zellij, name);
      }
      return null;
    } catch {
      return null;
    }
  }

  private async findTabByNameText(
    zellij: string,
    name: string,
  ): Promise<{ tabId: string; name: string } | null> {
    try {
      const proc = spawn([zellij, 'action', 'list-tabs'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const exitCode = await proc.exited;
      if (exitCode !== 0) return null;

      const stdout = await new Response(proc.stdout).text();
      const lines = stdout.split('\n');

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 3 && parts[2] === name) {
          return { tabId: parts[0], name: parts[2] };
        }
      }
      return null;
    } catch {
      return null;
    }
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
      try {
        const info = JSON.parse(stdout);
        return String(info.tab_id);
      } catch {
        return null;
      }
    } catch {
      return null;
    }
  }

  private async listPanes(zellij: string): Promise<string[]> {
    try {
      const proc = spawn([zellij, 'action', 'list-panes'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const exitCode = await proc.exited;
      if (exitCode !== 0) return [];

      const stdout = await new Response(proc.stdout).text();
      return stdout
        .split('\n')
        .slice(1)
        .map((line) => line.trim().split(/\s+/)[0])
        .filter((id) => id?.startsWith('terminal_'));
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

  async applyLayout(
    _layout: MultiplexerLayout,
    _mainPaneSize: number,
  ): Promise<void> {
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
