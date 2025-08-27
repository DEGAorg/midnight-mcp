/**
 * Global setup for Jest tests
 * This initializes tracking for intervals, timeouts, and other resources
 */

export default async function globalSetup(): Promise<void> {
  // Prevent EventEmitter memory leak warnings
  if (process && process.setMaxListeners) {
    process.setMaxListeners(20); // Increase limit to prevent warnings
  }
  
  // Initialize global tracking arrays
  (global as any).__JEST_ACTIVE_INTERVALS__ = [];
  (global as any).__JEST_ACTIVE_TIMEOUTS__ = [];
  (global as any).__JEST_ACTIVE_IMMEDIATES__ = [];
  
  // Override setInterval to track intervals
  const originalSetInterval = global.setInterval;
  global.setInterval = ((callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
    const intervalId = originalSetInterval(callback, delay, ...args);
    (global as any).__JEST_ACTIVE_INTERVALS__.push(intervalId);
    return intervalId;
  }) as typeof global.setInterval;
  
  // Override setTimeout to track timeouts
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = ((callback: (...args: any[]) => void, delay?: number, ...args: any[]) => {
    const timeoutId = originalSetTimeout(callback, delay, ...args);
    (global as any).__JEST_ACTIVE_TIMEOUTS__.push(timeoutId);
    return timeoutId;
  }) as typeof global.setTimeout;
  
  // Override setImmediate to track immediates
  const originalSetImmediate = global.setImmediate;
  global.setImmediate = ((callback: (...args: any[]) => void, ...args: any[]) => {
    const immediateId = originalSetImmediate(callback, ...args);
    (global as any).__JEST_ACTIVE_IMMEDIATES__.push(immediateId);
    return immediateId;
  }) as typeof global.setImmediate;
  
  // Override clearInterval to remove from tracking
  const originalClearInterval = global.clearInterval;
  global.clearInterval = ((intervalId: NodeJS.Timeout) => {
    const index = (global as any).__JEST_ACTIVE_INTERVALS__.indexOf(intervalId);
    if (index > -1) {
      (global as any).__JEST_ACTIVE_INTERVALS__.splice(index, 1);
    }
    return originalClearInterval(intervalId);
  }) as typeof global.clearInterval;
  
  // Override clearTimeout to remove from tracking
  const originalClearTimeout = global.clearTimeout;
  global.clearTimeout = ((timeoutId: NodeJS.Timeout) => {
    const index = (global as any).__JEST_ACTIVE_TIMEOUTS__.indexOf(timeoutId);
    if (index > -1) {
      (global as any).__JEST_ACTIVE_TIMEOUTS__.splice(index, 1);
    }
    return originalClearTimeout(timeoutId);
  }) as typeof global.clearTimeout;
  
  // Override clearImmediate to remove from tracking
  const originalClearImmediate = global.clearImmediate;
  global.clearImmediate = ((immediateId: NodeJS.Immediate) => {
    const index = (global as any).__JEST_ACTIVE_IMMEDIATES__.indexOf(immediateId);
    if (index > -1) {
      (global as any).__JEST_ACTIVE_IMMEDIATES__.splice(index, 1);
    }
    return originalClearImmediate(immediateId);
  }) as typeof global.clearImmediate;
}
