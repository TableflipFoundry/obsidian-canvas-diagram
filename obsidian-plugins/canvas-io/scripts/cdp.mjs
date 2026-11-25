// Development-only connection to an already-running local Obsidian debugger.
export async function connect(vaultRoot = process.env.OBSIDIAN_VAULT) {
  if (!vaultRoot) throw new Error('Set OBSIDIAN_VAULT to the absolute test-vault path.');
  const { fileURLToPath } = await import('node:url');
  const { resolve } = await import('node:path');
  const expected = resolve(vaultRoot instanceof URL ? fileURLToPath(vaultRoot) : vaultRoot).toLowerCase();
  const targets = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  for (const target of targets.filter(t => t.type === 'page' && t.url.startsWith('app://obsidian.md'))) {
    const client = await openTarget(target);
    const actual = await client.evaluate(`app.vault.adapter.basePath`);
    if (resolve(actual).toLowerCase() === expected) return client;
    client.close();
  }
  throw new Error(`No Obsidian debugger window found for ${expected}`);
}

async function openTarget(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const result = JSON.parse(event.data);
    const request = pending.get(result.id);
    if (!request) return;
    pending.delete(result.id);
    clearTimeout(request.timer);
    result.error ? request.reject(new Error(result.error.message)) : request.resolve(result.result);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial;
    const timer = setTimeout(() => {pending.delete(id);reject(new Error(`${method} timed out`));}, 30000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return {
    send,
    async evaluate(expression) {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.text + ': ' + result.exceptionDetails.exception?.description);
      return result.result.value;
    },
    close: () => socket.close()
  };
}
