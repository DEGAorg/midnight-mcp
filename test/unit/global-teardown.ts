/**
 * Global teardown for Jest tests
 * This ensures that any remaining intervals, timeouts, or other resources are properly cleaned up
 */

export default async function globalTeardown(): Promise<void> {
  // Clear any remaining intervals
  const activeIntervals = (global as any).__JEST_ACTIVE_INTERVALS__ || [];
  activeIntervals.forEach((intervalId: NodeJS.Timeout) => {
    clearInterval(intervalId);
  });
  
  // Clear any remaining timeouts
  const activeTimeouts = (global as any).__JEST_ACTIVE_TIMEOUTS__ || [];
  activeTimeouts.forEach((timeoutId: NodeJS.Timeout) => {
    clearTimeout(timeoutId);
  });
  
  // Clear any remaining immediate timers
  const activeImmediates = (global as any).__JEST_ACTIVE_IMMEDIATES__ || [];
  activeImmediates.forEach((immediateId: NodeJS.Immediate) => {
    clearImmediate(immediateId);
  });
  
  // Reset global tracking arrays
  (global as any).__JEST_ACTIVE_INTERVALS__ = [];
  (global as any).__JEST_ACTIVE_TIMEOUTS__ = [];
  (global as any).__JEST_ACTIVE_IMMEDIATES__ = [];
  
  // Handle EventEmitter memory leaks
  if (process && process.setMaxListeners) {
    process.setMaxListeners(0);
  }
  
  // Remove all listeners from process to prevent memory leaks
  if (process && process.removeAllListeners) {
    process.removeAllListeners('exit');
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
  }
  
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
  
  // Wait a bit to ensure all async operations complete
  await new Promise(resolve => setTimeout(resolve, 50));
}
