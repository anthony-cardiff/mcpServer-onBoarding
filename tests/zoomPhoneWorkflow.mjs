/* Mocked Zoom Phone workflow checks. No credentials or live requests. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '');
const require = createRequire(root + '/package.json');
const { transformSync } = require('esbuild');
const z = require('zod/v4');
const calls = [];
const good = { id: 'number-1', number: '+18585550123', source: 'Zoom', number_type: 'Toll', allocated_product: 'ZOOM_PHONE', assigned_list: [] };
let number, phoneUser, pages, active, directLine, name, failDisplay, conflict;
function reset() {
  calls.length = 0;
  number = structuredClone(good);
  phoneUser = { calling_plans: [], phone_numbers: [] };
  pages = [];
  active = true;
  directLine = true;
  name = 'MCP Tester';
  failDisplay = false;
  conflict = false;
}
const json = value => new Response(JSON.stringify(value), { status: 200 });
globalThis.__phoneFetch = async (path, init = {}) => {
  const method = init.method ?? 'GET';
  const body = init.body ? JSON.parse(init.body) : undefined;
  calls.push({ path, method, body });
  if (path.startsWith('/number_management/numbers?') && method === 'GET') {
    return json(pages.shift() ?? { numbers: [number] });
  }
  if (path === '/phone/users/user-1' && method === 'GET') return json(phoneUser);
  if (path === '/number_management/numbers/number-1' && method === 'GET') {
    if (conflict && calls.filter(c => c.path === path).length > 1) {
      return json({ ...number, assigned_list: [{ assigned_to_id: 'other', assigned_to_type: 'User' }] });
    }
    return json(number);
  }
  if (path === '/phone/users/user-1/calling_plans' && method === 'POST') {
    assert.deepEqual(body, { calling_plans: [{ type: 200 }] });
    phoneUser.calling_plans = body.calling_plans;
    return new Response(null, { status: 200 });
  }
  if (path === '/number_management/numbers/number-1' && method === 'PATCH') {
    assert.deepEqual(Object.keys(body), ['display_name']);
    if (failDisplay) return jsonError();
    Object.assign(number, body);
    return new Response(null, { status: 204 });
  }
  if (path === '/phone/users/user-1/phone_numbers' && method === 'POST') {
    phoneUser.phone_numbers = body.phone_numbers;
    number.assigned_list = [{ assigned_to_id: 'user-1', assigned_to_type: 'User' }];
    return json(body);
  }
  throw new Error('Unexpected endpoint: ' + method + ' ' + path);
};
function jsonError() {
  return new Response(JSON.stringify({ code: 999, message: 'Invalid field sensitive-marker' }), { status: 400 });
}
async function load(path, header) {
  const source = readFileSync(path, 'utf8').replace(/^import[\s\S]*?;\n/gm, '');
  const code = transformSync(header + '\n' + source, { loader: 'ts', format: 'esm', target: 'es2022' }).code;
  return import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
}
const api = await load(root + '/src/services/zoomPhoneApi.ts', 'const zoomFetch = globalThis.__phoneFetch;');
globalThis.__phoneDeps = {
  z, ...api,
  getGoogleSheetRow: async () => [],
  mapRowToNewHire: () => ({ firstName: name.split(' ')[0], lastName: name.split(' ').slice(1).join(' '), cardiffEmail: 'test@example.invalid', zoom: { accountRequired: true, directLineRequired: directLine } }),
  findZoomUserByEmail: async () => ({ id: 'user-1', status: active ? 'active' : 'pending' }),
  getZoomUserProvisioningState: async user => ({ status: user.status, readyForPhoneProvisioning: user.status === 'active' }),
};
const tool = await load(root + '/src/tools/zoomPhone.ts', 'const { z, getGoogleSheetRow, mapRowToNewHire, findZoomUserByEmail, getZoomUserProvisioningState, assignZoomPhoneNumber, ensureZoomPhoneCallingPlan, getZoomPhoneNumber, getZoomPhoneUser, isEligibleZoomPhoneNumber, listEligibleZoomPhoneNumbers, resolveZoomPhoneNumberId, updateZoomPhoneNumberDisplayName, US_CA_UNLIMITED_PLAN, ZoomPhoneError } = globalThis.__phoneDeps;');
const registered = new Map();
tool.registerZoomPhoneTools({ registerTool: (name, config, handler) => registered.set(name, { config, handler }) });
assert.deepEqual([...registered.keys()], ['preview_zoom_phone_options', 'provision_zoom_phone']);
const previewTool = registered.get('preview_zoom_phone_options');
const provisionTool = registered.get('provision_zoom_phone');
const preview = args => previewTool.handler(previewTool.config.inputSchema.parse(args));
const run = (extra = {}) => provisionTool.handler(provisionTool.config.inputSchema.parse({ row: 2, confirm: true, phoneNumber: '+18585550123', ...extra }));
const writes = () => calls.filter(c => c.method !== 'GET');
assert.deepEqual(Object.keys(previewTool.config.inputSchema.shape), ['row', 'phoneNumber']);
assert.deepEqual(Object.keys(provisionTool.config.inputSchema.shape), ['row', 'confirm', 'phoneNumber']);
reset();
pages = [{ numbers: [{ ...good, id: 'first' }], next_page_token: 'page-2' }, { numbers: [{ ...good, id: 'second' }, { ...good, source: 'ZoomPorted' }] }];
let result = await preview({ row: 2 });
assert.deepEqual(result.structuredContent.availablePhoneNumbers.map(n => n.id), ['first', 'second']);
assert.ok(calls.some(c => c.path.includes('next_page_token=page-2')));
assert.equal(writes().length, 0);
reset();
result = await preview({ row: 2, phoneNumber: '(858) 555-0123' });
assert.equal(result.structuredContent.selectedNumberEligible, true);
assert.equal(result.structuredContent.readyForPhoneProvisioning, true);
assert.equal(Object.hasOwn(result.structuredContent, 'availablePhoneNumbers'), false);
assert.equal(writes().length, 0);
assert.equal(Object.hasOwn(result.structuredContent, 'newNumberAcquisition'), false);
assert.equal(result.structuredContent.selectedNumber.number, good.number);
result = await run();
assert.equal(result.structuredContent.success, true);
assert.equal(result.structuredContent.phoneProvisioningComplete, true);
assert.equal(number.display_name, name);
assert.deepEqual(writes().map(c => c.path), ['/phone/users/user-1/calling_plans', '/number_management/numbers/number-1', '/phone/users/user-1/phone_numbers']);
calls.length = 0;
result = await run();
assert.equal(result.structuredContent.alreadyAssigned, true);
assert.equal(result.structuredContent.success, true);
assert.ok(!calls.some(c => c.method === 'POST'));
reset();
result = await preview({ row: 2, phoneNumber: '   ' });
assert.ok(Array.isArray(result.structuredContent.availablePhoneNumbers));
assert.equal(writes().length, 0);
reset();
phoneUser.phone_numbers = [{ id: 'different', number: '+18585550999' }];
result = await preview({ row: 2, phoneNumber: good.number });
assert.equal(result.structuredContent.selectedNumberEligible, false);
assert.equal(result.structuredContent.readyForPhoneProvisioning, false);
assert.equal(Object.hasOwn(result.structuredContent, 'availablePhoneNumbers'), false);
assert.equal(result.structuredContent.currentPhoneNumbers.length, 0);
assert.ok(!JSON.stringify(result).includes('+18585550999'));
assert.equal(writes().length, 0);
reset();
delete number.assigned_list;
result = await run();
assert.equal(result.structuredContent.success, true);
assert.ok(calls.some(c => c.path.includes('assigned_to_type=PhoneUnassigned')));
reset();
phoneUser.phone_numbers = [{ id: 'different', number: '+18585550999' }];
result = await run();
assert.equal(result.isError, true);
assert.equal(writes().length, 0);
reset();
active = false;
result = await run();
assert.equal(result.isError, true);
assert.equal(writes().length, 0);
reset();
directLine = false;
result = await run();
assert.equal(result.isError, true);
assert.equal(writes().length, 0);
reset();
name = 'ABCDEFGHIJKLMNOP Smith';
result = await run();
assert.equal(result.structuredContent.success, true);
reset();
name = 'MCP VeryLongLastNameExceedingThirtyTwo';
result = await run();
assert.equal(result.isError, true);
assert.equal(writes().length, 0);
reset();
conflict = true;
result = await run();
assert.equal(result.isError, true);
assert.equal(result.structuredContent.callingPlanAssigned, true);
assert.ok(!calls.some(c => c.method === 'PATCH' || c.path.endsWith('/phone_numbers')));
reset();
failDisplay = true;
result = await run();
assert.equal(result.isError, true);
assert.equal(result.structuredContent.callingPlanAssigned, true);
assert.equal(result.structuredContent.displayNameUpdated, false);
assert.ok(!JSON.stringify(result).includes('sensitive-marker'));
for (const patch of [{ source: 'ZoomPorted' }, { source: 'BYOCCloud' }, { allocated_product: 'ZOOM_CONTACT_CENTER' }, { number_type: 'TollFree' }, { assigned_list: [{ assigned_to_id: 'other' }] }, { assigned_list: undefined }]) {
  assert.equal(api.isEligibleZoomPhoneNumber({ ...good, ...patch }), false);
}
assert.equal(api.normalizeZoomPhoneNumber('(858) 555-0123'), '+18585550123');
assert.throws(() => api.normalizeZoomPhoneNumber('8585550123 ext 1'), api.ZoomPhoneError);
assert.equal(provisionTool.config.inputSchema.safeParse({ row: 2, confirm: true }).success, false);
console.log('Passed phone-only workflow checks: read-only browse/selected previews, pagination, eligibility, formatted number lookup, plan/name/assignment ordering, retry, omitted assignment data, race protection, Direct Line requirement, and safe errors. No live API calls.');
