/**
 * System Cleanup Service
 * Provides utilities to clean up stray processes (node, playwright, etc.)
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

/**
 * Request system cleanup to kill stray processes
 * Requires a local Node.js cleanup endpoint
 */
export async function requestSystemCleanup(): Promise<CleanupResult> {
  try {
    // Try local cleanup endpoint first (for development)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch("http://localhost:3000/api/system/cleanup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Cleanup endpoint returned ${response.status}`);
    }

    const result: CleanupResult = await response.json();
    return result;
  } catch (error) {
    // If local endpoint fails, provide helpful error message
    const errorMsg = error instanceof Error ? error.message : String(error);
    
    return {
      success: false,
      killed: { node: 0, playwright: 0, total: 0 },
      message: "Could not connect to cleanup service. Make sure the cleanup server is running on port 3000.",
      errors: [errorMsg],
    };
  }
}

/**
 * Get system process status
 */
export async function getSystemProcessStatus(): Promise<{
  nodeProcesses: number;
  playwrightProcesses: number;
  totalProcesses: number;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch("http://localhost:3000/api/system/processes", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Status endpoint returned ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    return {
      nodeProcesses: 0,
      playwrightProcesses: 0,
      totalProcesses: 0,
    };
  }
}
