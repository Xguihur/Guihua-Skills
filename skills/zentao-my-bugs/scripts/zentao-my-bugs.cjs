const { spawnSync } = require('node:child_process');
const { existsSync, readFileSync, renameSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { Writable } = require('node:stream');
const { parseArgs } = require('node:util');

const localDirectory = path.resolve(__dirname, '..', '.local');
const configPath = path.join(localDirectory, 'config.json');
const credentialPath = path.join(localDirectory, 'login.dpapi');

const bugScopes = new Map([
  ['assigned', { status: 'assigntome', actor: 'assignedTo' }],
  ['resolved', { status: 'resolvedbyme', actor: 'resolvedBy', date: 'resolvedDate' }],
  ['opened', { status: 'openedbyme', actor: 'openedBy', date: 'openedDate' }],
]);

function accountOf(user) {
  return (typeof user === 'string' ? user : user?.account) || null;
}

function dayStart(value, option) {
  const utc = Date.parse(`${value}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(utc) || new Date(utc).toISOString().slice(0, 10) !== value) {
    throw new Error(`Provide a valid YYYY-MM-DD date with --${option}.`);
  }
  return Date.parse(`${value}T00:00:00+08:00`);
}

function eventTime(value) {
  if (typeof value !== 'string') return NaN;
  const dateTime = value.trim().replace(' ', 'T');
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTime)) return Date.parse(`${dateTime}T00:00:00+08:00`);
  return Date.parse(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(dateTime) ? dateTime : `${dateTime}+08:00`);
}

function bugActivity(bug) {
  return {
    assignedTo: accountOf(bug.assignedTo), openedBy: accountOf(bug.openedBy), openedDate: bug.openedDate,
    resolvedBy: accountOf(bug.resolvedBy), resolvedDate: bug.resolvedDate, resolution: bug.resolution,
    closedBy: accountOf(bug.closedBy), closedDate: bug.closedDate,
  };
}

async function readPassword() {
  if (!process.stdin.isTTY) throw new Error('Run --save-login in your interactive terminal.');

  process.stderr.write('ZenTao password (input hidden): ');
  const input = readline.createInterface({
    input: process.stdin,
    output: new Writable({ write(_chunk, _encoding, done) { done(); } }),
    terminal: true,
    historySize: 0,
  });
  try {
    const password = await new Promise((resolve, reject) => {
      input.once('close', () => reject(new Error('Login cancelled.')));
      input.once('SIGINT', () => input.close());
      input.question('', resolve);
    });
    if (!password) throw new Error('No password entered.');
    return password;
  } finally {
    input.close();
    process.stderr.write('\n');
  }
}

function transformCredential(method, value, siteRoot, account) {
  if (process.platform !== 'win32') throw new Error('Local saved login requires Windows DPAPI.');
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const command = `
    $ErrorActionPreference = 'Stop'
    Add-Type -AssemblyName System.Security
    $ztContext = [Convert]::FromBase64String([Console]::ReadLine())
    $ztBytes = [Convert]::FromBase64String([Console]::ReadLine())
    $ztScope = [Security.Cryptography.DataProtectionScope]::CurrentUser
    $ztResult = [Security.Cryptography.ProtectedData]::${method}($ztBytes, $ztContext, $ztScope)
    [Console]::Write([Convert]::ToBase64String($ztResult))
  `;
  const context = Buffer.from(JSON.stringify([siteRoot, account])).toString('base64');
  const result = spawnSync(powershell, ['-NoProfile', '-NonInteractive', '-Command', command], {
    encoding: 'utf8',
    input: `${context}\n${value}\n`,
    timeout: 10000,
    windowsHide: true,
  });
  const encoded = result.stdout?.trim();
  if (result.error || result.status !== 0 || !encoded || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    throw new Error('Could not use the Windows login store. Run --save-login under the same Windows user.');
  }
  return encoded;
}

async function main() {
  const { values } = parseArgs({ options: {
    'count-only': { type: 'boolean' },
    'save-login': { type: 'boolean' },
    bug: { type: 'string' },
    scope: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'string' },
  } });
  if ([values['count-only'], values['save-login'], values.bug !== undefined].filter(Boolean).length > 1) {
    throw new Error('Choose one of --count-only, --save-login, and --bug.');
  }
  const bugId = values.bug;
  if (bugId !== undefined && (!/^[1-9]\d*$/.test(bugId) || !Number.isSafeInteger(Number(bugId)))) {
    throw new Error('Provide a positive Bug ID with --bug.');
  }
  const scope = bugScopes.get(values.scope ?? 'assigned');
  if (!scope) throw new Error('Choose assigned, resolved, or opened with --scope.');
  const filterByDate = values.from !== undefined || values.to !== undefined;
  if ((values['save-login'] || bugId !== undefined) && (values.scope !== undefined || filterByDate)) {
    throw new Error('Use --scope, --from, and --to with list or count queries.');
  }
  if (filterByDate && !scope.date) throw new Error('Use --from and --to with --scope resolved or --scope opened.');
  const from = values.from === undefined ? -Infinity : dayStart(values.from, 'from');
  const until = values.to === undefined ? Infinity : dayStart(values.to, 'to') + 86_400_000;
  if (from >= until) throw new Error('--from must be on or before --to.');

  if (!existsSync(configPath)) throw new Error('Create .local/config.json using config.example.json.');
  let config;
  try { config = JSON.parse(readFileSync(configPath, 'utf8')); } catch {
    throw new Error('Could not read .local/config.json as UTF-8 JSON.');
  }
  const account = typeof config?.account === 'string' ? config.account.trim() : '';
  let site;
  try { site = new URL(config?.url); } catch {
    throw new Error('Provide a valid site URL in .local/config.json.');
  }
  if (!account || !['http:', 'https:'].includes(site.protocol) || site.username || site.password || site.search || site.hash) {
    throw new Error('Provide an HTTP or HTTPS site root and an account in .local/config.json.');
  }
  const siteRoot = site.href.replace(/\/$/, '');
  let token = process.env.ZENTAO_V1_TOKEN?.trim();

  async function request(route, credentials) {
    const method = credentials ? 'POST' : 'GET';
    const response = await fetch(`${siteRoot}/api.php/v1${route}`, {
      method,
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: credentials ? { 'Content-Type': 'application/json' } : { Token: token },
      body: credentials ? JSON.stringify(credentials) : undefined,
    }).catch((error) => {
      throw new Error(`${method} ${route} failed: ${error.cause?.code ?? error.name}`);
    });
    if (!response.ok) {
      const advice = credentials && response.status === 400 ? ' Check the local login and run --save-login again.' : '';
      throw new Error(`ZenTao API returned HTTP ${response.status}: ${method} ${route}.${advice}`);
    }
    return response.json().catch(() => {
      throw new Error(`ZenTao API did not return JSON: ${method} ${route}`);
    });
  }

  async function signIn(password) {
    const login = await request('/tokens', { account, password });
    if (typeof login?.token !== 'string' || !login.token.trim()) {
      throw new Error('ZenTao authentication did not return a token.');
    }
    token = login.token;
  }

  if (values['save-login']) {
    if (process.platform !== 'win32') throw new Error('Local saved login requires Windows DPAPI.');
    const password = await readPassword();
    await signIn(password);
    const protectedLogin = transformCredential('Protect', Buffer.from(password).toString('base64'), siteRoot, account);
    const temporaryPath = `${credentialPath}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, protectedLogin, { encoding: 'ascii', flag: 'wx' });
    renameSync(temporaryPath, credentialPath);
    return { ok: true, loginSaved: true };
  }

  if (!token) {
    if (!existsSync(credentialPath)) throw new Error('Run --save-login once in your terminal or provide ZENTAO_V1_TOKEN.');
    const protectedLogin = readFileSync(credentialPath, 'ascii').trim();
    const encoded = transformCredential('Unprotect', protectedLogin, siteRoot, account);
    await signIn(Buffer.from(encoded, 'base64').toString('utf8'));
  }

  if (bugId !== undefined) {
    const bug = await request(`/bugs/${bugId}`);
    if (Number(bug?.id) !== Number(bugId)) throw new Error(`Unexpected detail response for Bug #${bugId}.`);
    return { ok: true, bug: {
      id: Number(bugId), title: bug.title, status: bug.status, priority: bug.pri,
      product: bug.productName, module: bug.moduleTitle, stepsHtml: bug.steps,
      url: `${siteRoot}/bug-view-${bugId}.html`,
      ...bugActivity(bug),
      actions: Array.isArray(bug.actions) ? bug.actions.map(({ id, actor, action, date, comment }) => ({
        id, actor, action, date, commentHtml: comment,
      })) : undefined,
    } };
  }

  async function list(route, params, field) {
    const records = [];
    let total;
    for (let page = 1; total === undefined || records.length < total; page++) {
      const query = new URLSearchParams({ ...params, page, limit: 100 });
      const reply = await request(`${route}?${query}`);
      total = Number(reply?.total);
      const items = reply?.[field];
      if (!Array.isArray(items) || reply.total == null || !Number.isSafeInteger(total) || total < 0 || Number(reply.page) !== page) {
        throw new Error(`Unexpected pagination response: ${route} (page ${page})`);
      }
      if (!items.length && records.length < total) throw new Error(`Empty page before the end of ${route} (page ${page}).`);
      records.push(...items);
    }
    return records;
  }

  const products = await list('/products', { status: 'all', order: 'id_asc' }, 'products');
  const bugsById = new Map();
  const undatedBugIds = new Set();
  for (const product of products) {
    const productId = Number(product.id);
    if (!Number.isSafeInteger(productId) || productId < 1) throw new Error('Invalid ZenTao product ID.');
    const bugs = await list(`/products/${productId}/bugs`, { status: scope.status }, 'bugs');
    for (const bug of bugs) {
      const id = Number(bug.id);
      if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid ZenTao Bug ID.');
      if (accountOf(bug[scope.actor]) !== account) {
        throw new Error(`Unexpected ${scope.actor} on Bug #${id}. Check the API account and list filter.`);
      }
      if (filterByDate) {
        const time = eventTime(bug[scope.date]);
        if (!Number.isFinite(time) || time <= 0) {
          undatedBugIds.add(id);
          continue;
        }
        if (time < from || time >= until) continue;
      }
      bugsById.set(id, {
        id, title: bug.title, status: bug.status, priority: bug.pri, product: product.name,
        url: `${siteRoot}/bug-view-${id}.html`,
        ...(scope.date && bugActivity(bug)),
      });
    }
  }

  const summary = { ok: true, count: bugsById.size };
  if (filterByDate) summary.undatedCount = undatedBugIds.size;
  if (values['count-only']) return summary;
  const bugs = [...bugsById.values()].sort((left, right) => right.id - left.id);
  return { ...summary, bugs };
}

main().then((result) => {
  console.log(JSON.stringify(result, null, 2));
}).catch((error) => {
  console.log(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
});
