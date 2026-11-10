/**
 * Invoke an optional progress observer without allowing UI/reporting failures
 * to interrupt the work being observed.
 *
 * Returns false when the callback is missing or throws synchronously. Promise
 * rejections are reported asynchronously and never escape as unhandled errors.
 */
function reportCallbackError(onError, error, payload) {
  try {
    if (typeof onError === "function") onError(error, payload);
  } catch {
    // Error reporting must not become a second failure path.
  }
}

export function emitProgressSafely(callback, payload, onError = null) {
  if (typeof callback !== "function") return false;

  try {
    const result = callback(payload);
    if (result && (typeof result === "object" || typeof result === "function")
      && typeof result.then === "function") {
      Promise.resolve(result).catch(error => reportCallbackError(onError, error, payload));
    }
    return true;
  } catch (error) {
    reportCallbackError(onError, error, payload);
    return false;
  }
}
