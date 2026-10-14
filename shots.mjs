// Minimal Chrome DevTools Protocol driver used to smoke-test the UI.
// Usage: node shots.mjs [url] [outDir]

import { writeFileSync } from 'node:fs';

const url = process.argv[2] || 'http://127.0.0.1:8899/';
const out = process.argv[3] || '/tmp/wc-shots';

const list = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const page = list.find((t) => t.type === 'page');
if (!page) throw new Error('no page target; is Chrome running with --remote-debugging-port?');

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg.result);
    pending.delete(msg.id);
  }
});

await new Promise((resolve) => ws.addEventListener('open', resolve));

function send(method, params = {}) {
  const msgId = ++id;
  return new Promise((resolve) => {
    pending.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

const evaluate = (expression) =>
  send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });

async function shot(name, { width, height }) {
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 2,
    mobile: width < 600,
  });
  await evaluate('new Promise(r => setTimeout(r, 600))');
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(`${out}/${name}.png`, Buffer.from(data, 'base64'));
  console.log(`${name}.png  ${width}x${height}`);
}

await send('Page.enable');
await send('Runtime.enable');
await send('Network.enable');
await send('Network.setCacheDisabled', { cacheDisabled: true });
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, 800));

// Drop the service worker and its caches so we always shoot the files on disk.
await evaluate(`(async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map(r => r.unregister()));
  const keys = await caches.keys();
  await Promise.all(keys.map(k => caches.delete(k)));
})()`);
await send('Page.navigate', { url: url + '?fresh=' + Date.now() });
await new Promise((r) => setTimeout(r, 1800));

const errors = await evaluate(`JSON.stringify(window.__errors || [])`);
console.log('page errors:', errors.result.value);

await shot('desktop-dark', { width: 1100, height: 900 });
await evaluate(`document.getElementById('settings').showModal()`);
await shot('settings', { width: 1100, height: 900 });
await evaluate(`document.getElementById('settings').close(); document.documentElement.dataset.theme='light'`);
await shot('light', { width: 1100, height: 900 });
await evaluate(`document.documentElement.dataset.theme='auto'`);
await shot('mobile', { width: 390, height: 844 });

ws.close();