import type { SalesAction, SalesEvent } from '../../src/lib/sales-telemetry';
export function salesActions(): [number, SalesAction][] { return [
  [1000, { type: 'select', field: 'projectId', value: '300016' }], [2000, { type: 'phase', phase: 'payment' }], [2500, { type: 'select', field: 'payment', value: 'mortgage' }],
  [3000, { type: 'phase', phase: 'method' }], [3500, { type: 'select', field: 'method', value: 'address' }], [4000, { type: 'phase', phase: 'search' }],
  [4500, { type: 'focus', field: 'building' }], [5000, { type: 'select', field: 'building', value: '2' }], [6000, { type: 'select', field: 'entrance', value: '307' }],
  [7000, { type: 'select', field: 'floor', value: '5' }], [8000, { type: 'select', field: 'apartment', value: '3' }], [9000, { type: 'search', found: true }],
  [10000, { type: 'phase', phase: 'method' }], [11000, { type: 'phase', phase: 'search' }], [12000, { type: 'reset' }],
  [13000, { type: 'select', field: 'building', value: '2' }], [14000, { type: 'select', field: 'entrance', value: '307' }], [15000, { type: 'select', field: 'floor', value: '5' }],
  [16000, { type: 'select', field: 'apartment', value: '3' }], [17000, { type: 'search', found: true }], [18000, { type: 'finish', reason: 'selected' }],
]; }
export function numbered(actions: [number, SalesAction][], from = 0): SalesEvent[] { return actions.map(([atMs, action], i) => ({ ...action, atMs, seq: i + from })); }
