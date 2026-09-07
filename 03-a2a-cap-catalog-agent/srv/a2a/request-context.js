"use strict";

/**
 * Per-request context propagated through the A2A execution chain.
 *
 * The @a2a-js/sdk hands our executor a `RequestContext` that does NOT carry the
 * raw Express request, yet the backend OData call needs the caller's IAS JWT to
 * perform *principal propagation* (email -> X.509 via the Cloud Connector). We
 * bridge that gap with an AsyncLocalStorage: the `authenticate` middleware runs
 * the rest of the request inside `run({ jwt, principal }, next)`, and the
 * backend helper reads it back with `current()` when it builds the destination.
 *
 * AsyncLocalStorage propagates across `await` boundaries, so the store set in
 * the middleware is still visible inside the executor and the outbound HTTP
 * call, without threading `req` through the SDK.
 */

const { AsyncLocalStorage } = require("node:async_hooks");

const storage = new AsyncLocalStorage();

/**
 * Run `callback` with the given request-scoped context in scope.
 * @param {{ jwt?: string, principal?: object }} context
 * @param {Function} callback
 */
function run(context, callback) {
  return storage.run(context || {}, callback);
}

/**
 * @returns {{ jwt?: string, principal?: object }} the current context (or {}).
 */
function current() {
  return storage.getStore() || {};
}

module.exports = { run, current };
