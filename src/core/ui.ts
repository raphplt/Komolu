/** Storage actions report failures through the global error banner. */
export const act = (promise: Promise<unknown>) => { void promise.catch(() => undefined) }
