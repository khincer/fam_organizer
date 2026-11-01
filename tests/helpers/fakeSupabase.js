// Chainable stand-in for the supabase-js client. Every finished request is
// recorded in `calls`; responses are scripted with `respond(key, value)` where
// key is "<table>.<op>" (op: select|insert|update|delete|upsert),
// "rpc.<name>", "invoke.<name>" or "storage.<op>". A value may be an object,
// a function of the call, or a Promise (to hold a request in flight).
export function createFakeSupabase() {
  const calls = []
  const responses = new Map()
  const channels = []
  const removed = []

  function resolve(key, call) {
    const queue = responses.get(key)
    let value = queue && queue.length ? (queue.length > 1 ? queue.shift() : queue[0]) : undefined
    if (typeof value === 'function') value = value(call)
    return Promise.resolve(value ?? { data: call.op === 'select' ? [] : null, error: null })
  }

  function builder(table) {
    const call = { table, op: 'select', filters: [], payload: undefined, options: undefined }
    const b = {
      select(cols) { call.columns = cols; return b },
      insert(v, o) { call.op = 'insert'; call.payload = v; call.options = o; return b },
      update(v) { call.op = 'update'; call.payload = v; return b },
      upsert(v, o) { call.op = 'upsert'; call.payload = v; call.options = o; return b },
      delete() { call.op = 'delete'; return b },
      eq(k, v) { call.filters.push(['eq', k, v]); return b },
      neq(k, v) { call.filters.push(['neq', k, v]); return b },
      order(k, o) { call.order = [k, o]; return b },
      limit(n) { call.limit = n; return b },
      single() { call.single = true; return b },
      then(res, rej) { calls.push(call); return resolve(`${table}.${call.op}`, call).then(res, rej) },
    }
    return b
  }

  const client = {
    from: builder,
    rpc(name, args) { const call = { rpc: name, args }; calls.push(call); return resolve(`rpc.${name}`, call) },
    channel(name) {
      const ch = { name, handlers: [], subscribe() { return ch }, on(ev, filter, cb) { ch.handlers.push({ ev, filter, cb }); return ch } }
      channels.push(ch)
      return ch
    },
    removeChannel(ch) { removed.push(ch); return Promise.resolve('ok') },
    functions: { invoke(name, opts) { const call = { invoke: name, opts }; calls.push(call); return resolve(`invoke.${name}`, call) } },
    storage: {
      from(bucket) {
        const op = (o) => (...args) => { const call = { storage: o, bucket, args }; calls.push(call); return resolve(`storage.${o}`, call) }
        return {
          upload: op('upload'), remove: op('remove'),
          getPublicUrl: (path) => ({ data: { publicUrl: `https://cdn.test/${bucket}/${path}` } }),
        }
      },
    },
  }

  return {
    client, calls, channels, removed,
    respond(key, ...values) { responses.set(key, values) },
    emit(table, payload) {
      for (const ch of channels) for (const h of ch.handlers) if (h.filter.table === table && (h.filter.event === '*' || h.filter.event === payload.eventType)) h.cb(payload)
    },
  }
}
