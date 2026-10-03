#!/usr/bin/env node

/**
 * System Cleanup Server
 * Runs on localhost:3000 and provides endpoints to kill stray processes
 * Usage: node scripts/cleanup-server.mjs
 */

import { execSync } from 'child_process';
import { platform } from 'os';
import http from 'http';

const PORT = 3000;
const IS_WINDOWS = platform() === 'win32';

/**
 * Get list of running processes (Windows-specific)
 */
function getRunningProcesses() {
  try {
    if (IS_WINDOWS) {
      const output = execSync('tasklist /FO CSV', { encoding: 'utf-8' });
      const lines = output.split('\n').slice(1); // Skip header
      const processes = lines
        .filter(line => line.trim())
        .map(line => {
          const match = line.match(/"([^"]+)"\s*,"(\d+)"/);
          return match ? { name: match[1], pid: parseInt(match[2]) } : null;
        })
        .filter(p => p !== null);
      return processes;
    } else {
      // Unix/Linux/Mac
      const output = execSync('ps aux', { encoding: 'utf-8' });
      const lines = output.split('\n');
      const processes = lines.map(line => {
        const parts = line.split(/\s+/);
        return { name: parts[10] || '', pid: parseInt(parts[1]) };
      });
      return processes;
    }
  } catch (error) {
    console.error('Error getting processes:', error.message);
    return [];
  }
}

/**
 * Count processes by type
 */
function countProcesses() {
  const processes = getRunningProcesses();
  const nodeProcesses = processes.filter(p => p.name.includes('node'));
  const playwrightProcesses = processes.filter(p => 
    p.name.includes('chrome') || p.name.includes('firefox') || p.name.includes('playwright')
  );

  return {
    nodeProcesses: nodeProcesses.length,
    playwrightProcesses: playwrightProcesses.length,
    totalProcesses: nodeProcesses.length + playwrightProcesses.length,
    details: { nodeProcesses, playwrightProcesses },
  };
}

/**
 * Snapshot the PIDs of all processes whose image name matches `filter`.
 * Used before AND after a kill so the reported kill count is the real
 * number of processes that disappeared, not a guess.
 */
function snapshotPids(filter) {
  return new Set(getRunningProcesses().filter(p => filter(p.name)).map(p => p.pid));
}

const isNodeImage = (name) => name.toLowerCase().includes('node');
const isBrowserImage = (name) => /chrome|firefox|msedge|playwright/i.test(name);

/**
 * Kill stray processes
 */
function killStrayProcesses() {
  const result = {
    success: true,
    killed: { node: 0, playwright: 0, total: 0 },
    message: 'Cleanup complete',
    errors: [],
  };

  try {
    if (IS_WINDOWS) {
      // Windows: taskkill /F /IM wipes every instance of an image at once,
      // so it never reports HOW MANY died. Count honestly: snapshot PIDs
      // before and after, and the kill count is the difference.
      const beforeBrowser = snapshotPids(isBrowserImage);

      // node.exe: kill per-PID instead of /IM. /IM would also kill THIS
      // server (it runs under node.exe), so the HTTP response died before
      // the UI ever saw a result. Excluding our own PID keeps the server
      // alive, and each successful kill is counted honestly.
      const nodeTargets = [...snapshotPids(isNodeImage)].filter(pid => pid !== process.pid);
      for (const pid of nodeTargets) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' });
          result.killed.node++;
        } catch (e) {
          if (!/not found|no processes/i.test(e.message)) {
            result.errors.push(`PID ${pid}: ${e.message}`);
          }
        }
      }

      // Kill stray browser processes (playwright drivers, zombie chrome…)
      const browserNames = ['chrome.exe', 'firefox.exe', 'msedge.exe'];
      for (const browser of browserNames) {
        try {
          execSync(`taskkill /F /IM ${browser}`, { stdio: 'pipe' });
        } catch (e) {
          if (!/not found|no processes/i.test(e.message)) {
            result.errors.push(`${browser}: ${e.message}`);
          }
        }
      }

      // browsers: /IM is safe here (the server is not a browser), and the
      // before/after PID diff reports exactly how many disappeared.
      const afterBrowser = snapshotPids(isBrowserImage);
      result.killed.playwright = [...beforeBrowser].filter(pid => !afterBrowser.has(pid)).length;
    } else {
      // Unix/Linux/Mac: use kill
      const processes = getRunningProcesses();
      
      for (const proc of processes) {
        try {
          if (proc.pid === process.pid) continue; // never kill ourselves (the cleanup server runs on node)
          if (proc.name.includes('node')) {
            execSync(`kill -9 ${proc.pid}`, { stdio: 'pipe' });
            result.killed.node++;
          } else if (proc.name.includes('chrome') || proc.name.includes('firefox')) {
            execSync(`kill -9 ${proc.pid}`, { stdio: 'pipe' });
            result.killed.playwright++;
          }
        } catch (e) {
          result.errors.push(`PID ${proc.pid}: ${e.message}`);
        }
      }
    }

    result.killed.total = result.killed.node + result.killed.playwright;
    result.message = `Killed ${result.killed.node} node + ${result.killed.playwright} playwright processes`;
    
    return result;
  } catch (error) {
    result.success = false;
    result.message = `Cleanup failed: ${error.message}`;
    result.errors.push(error.message);
    return result;
  }
}

/**
 * HTTP Request handler
 */
function requestHandler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/system/cleanup') {
    res.setHeader('Content-Type', 'application/json');
    const result = killStrayProcesses();
    res.writeHead(200);
    res.end(JSON.stringify(result));
  } else if (req.method === 'GET' && req.url === '/api/system/processes') {
    res.setHeader('Content-Type', 'application/json');
    const status = countProcesses();
    res.writeHead(200);
    res.end(JSON.stringify({
      nodeProcesses: status.nodeProcesses,
      playwrightProcesses: status.playwrightProcesses,
      totalProcesses: status.totalProcesses,
    }));
  } else if (req.method === 'GET' && req.url === '/health') {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok' }));
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}

// Start server
const server = http.createServer(requestHandler);
server.listen(PORT, 'localhost', () => {
  console.log(`\n🧹 System Cleanup Server running on http://localhost:${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  POST /api/system/cleanup   - Kill stray processes`);
  console.log(`  GET  /api/system/processes - Get process counts`);
  console.log(`  GET  /health               - Health check\n`);
  console.log(`Platform: ${IS_WINDOWS ? 'Windows' : 'Unix/Linux/Mac'}\n`);
});

process.on('SIGINT', () => {
  console.log('\n\n👋 Cleanup server shutting down...');
  server.close(() => process.exit(0));
});
