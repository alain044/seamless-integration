// Throwaway: verify the built bundle in dist/ is actually servable.
// Boots nothing — it talks to the running `vite preview` server and checks that
// index.html's references resolve and that every emitted chunk answers 200.
// A chunk that 404s means the code-splitting graph is broken and a real user
// would get a blank page on that route.
const base = process.env.BASE_URL ?? 'http://127.0.0.1:4173';

const res = await fetch(`${base}/`);
const html = await res.text();
console.log(`GET / -> ${res.status}`);
console.log(`root div present: ${html.includes('id="root"')}`);

const refs = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]))];
console.log(`assets referenced by index.html: ${refs.length}`);

const { readdirSync } = await import('node:fs');
const emitted = readdirSync('dist/assets').filter((f) => f.endsWith('.js'));
console.log(`chunks emitted by build: ${emitted.length}`);

const targets = [...new Set([...refs, ...emitted.map((f) => `/assets/${f}`)])];
const failures = [];
for (const path of targets) {
  const r = await fetch(`${base}${path}`);
  if (!r.ok) failures.push(`${path} -> ${r.status}`);
  else await r.arrayBuffer(); // drain so the socket is not left half-read
}

console.log(`checked ${targets.length} asset URLs`);
if (failures.length) {
  console.log('FAILURES:');
  for (const f of failures) console.log(`  ${f}`);
  process.exit(1);
}
console.log('RESULT: every emitted chunk and every index.html reference is served (200)');
