/**
 * System Cleanup Service
 * Provides utilities to clean up stray processes (node, playwright, etc.)
 * Supports configurable cleanup server port
 */

export interface CleanupResult {
  success: boolean;
  killed: {
    node: number;
    playwright: number;
    total: number;
  };
  message: string;
  errors?: string[];
}

export interface ProcessStatus {
  nodeProcesses: number;
  playwrightProcesses: number;
  totalProcesses: number;
}

// Store port in localStorage
const CLEANUP_SERVER_PORT_KEY = 'cleanup-server-port';
const DEFAULT_PORT = 3000;

/**
 * Get the configured cleanup server port
 */
export function getCleanupServerPort(): number {
  try {
    const stored = localStorage.getItem(CLEANUP_SERVER_PORT_KEY);
    if (stored) {
      const port = parseInt(stored, 10);
      if (port > 0 && port < 65536) {
        return port;
      }
    }
  } catch (e) {
    // localStorage might be unavailable
  }
  return DEFAULT_PORT;
}

/**
 * Set the cleanup server port
 */
export function setCleanupServerPort(port: number): void {
  if (port < 1 || port > 65535) {
    throw new Error('Port must be between 1 and 65535');
  }
  try {
    localStorage.setItem(CLEANUP_SERVER_PORT_KEY, port.toString());
  } catch (e) {
    console.error('Failed to save port to localStorage:', e);
  }
}

/**
 * Get the cleanup server URL
 */
function getCleanupServerUrl(): string {
  const port = getCleanupServerPort();
  return `http://localhost:${port}`;
}

/**
 * Test connection to cleanup server
 */
export async function testCleanupServerConnection(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${getCleanupServerUrl()}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Request system cleanup to kill stray processes
 * Requires a local Node.js cleanup endpoint
 */
export async function requestSystemCleanup(): Promise<CleanupResult> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(`${getCleanupServerUrl()}/api/system/cleanup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Cleanup endpoint returned ${response.status}`);
    }

    const result: CleanupResult = await response.json();
    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const port = getCleanupServerPort();

    return {
      success: false,
      killed: { node: 0, playwright: 0, total: 0 },
      message: `Could not connect to cleanup service on port ${port}. Make sure the cleanup server is running.`,
      errors: [errorMsg],
    };
  }
}

/**
 * Get system process status
 */
export async function getSystemProcessStatus(): Promise<ProcessStatus> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${getCleanupServerUrl()}/api/system/processes`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Status endpoint returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    // Return empty status on error
    return {
      nodeProcesses: 0,
      playwrightProcesses: 0,
      totalProcesses: 0,
    };
  }
}
