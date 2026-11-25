import test from 'node:test';
import assert from 'node:assert/strict';
import { addressOptions, changeAddress, emptyAddress, findApartment, projectFor, salesCatalog } from '../src/lib/sales-catalog';
import { captchaPlan, SalesClock } from '../src/lib/sales-flow';
import { fetchBuilding } from '../src/lib/server/sales-catalog';
import { sessionFields } from '../src/lib/server/data';

const sample = { projectId: '300016', building: '2', entrance: '307', floor: '5', apartment: '3' };
test('Published Lankaran address matches the reference and has only residential floors', () => {
  assert.deepEqual(findApartment(sample), { ...sample, floorCount: 9, rooms: 4, internalArea: 114.6, externalArea: 135.6 });
  assert.deepEqual(addressOptions(sample), { buildings: ['1', '2', '3', '4', '5'], entrances: ['305', '307'], floors: ['2', '3', '4', '5', '6', '7', '8', '9'], apartments: ['1', '2', '3'] });
  assert.equal(findApartment({ ...sample, floor: '1' }), null);
  assert.equal(findApartment({ ...sample, entrance: '1' }), null);
  assert.equal(findApartment({ ...sample, apartment: '48' }), null);
});
test('Each parent change clears dependent address values, preserving ancestors', () => {
  assert.deepEqual(changeAddress(sample, 'building', '3'), { ...sample, building: '3', entrance: '', floor: '', apartment: '' });
  assert.deepEqual(changeAddress(sample, 'entrance', '305'), { ...sample, entrance: '305', floor: '', apartment: '' });
  assert.deepEqual(changeAddress(sample, 'floor', '9'), { ...sample, floor: '9', apartment: '' });
  assert.deepEqual(changeAddress(sample, 'projectId', '1'), { ...emptyAddress, projectId: '1' });
});
test('Every cached address resolves to its source record, with no duplicate building IDs', () => {
  for (const project of salesCatalog.projects) {
    assert.equal(new Set(project.buildings.map(b => b.number)).size, project.buildings.length);
    for (const building of project.buildings) for (const layout of building.layouts) for (const floor of layout.floors) for (const unit of layout.units) {
      const address = { projectId: project.id, building: building.number, entrance: unit[0], floor: String(floor), apartment: unit[1] };
      const result = findApartment(address)!;
      assert.deepEqual([result.rooms, result.internalArea, result.externalArea], unit.slice(2));
      assert.ok(floor <= building.floorCount);
    }
  }
});
test('Official loader groups identical floor plans and merges all building sectors without inventing units', async () => {
  const source = projectFor('300016')!.buildings.find(b => b.number === '1')!;
  const paths: string[] = [];
  const result = await fetchBuilding('300016', '1', async path => {
    paths.push(path);
    if (path.startsWith('/getSectorFloors/')) return { floors: [{ id: 100, floor_number: 2, sector_floor_plan_id: 90 }, { id: 101, floor_number: 3, sector_floor_plan_id: 90 }] };
    return { apartments: [{ entrance_number: 319, apartment_number: 1, count_of_rooms: 3, internal_size: 80, external_size: 90 }] };
  }, true);
  assert.equal(paths.length, source.sectors.length * 2);
  assert.equal(result.complete, true);
  assert.equal(findApartment({ projectId: '300016', building: '1', entrance: '319', floor: '3', apartment: '1' }, result)?.rooms, 3);
  await assert.rejects(fetchBuilding('300016', '../../fake'), /Bina tapılmadı/);
  await assert.rejects(fetchBuilding('300016', '1', async () => ({}), true), /Invalid floor list/);
});
test('Stage timing includes returning to choices and stops exactly once', () => {
  let at = 0; const clock = new SalesClock(() => at);
  at = 5000; clock.enter(2); at = 8000; clock.enter(1); at = 10000; clock.enter(2); at = 14000;
  assert.deepEqual(clock.finish(), { step1Duration: 7, step2Duration: 7 });
  at = 30000; clock.enter(1); assert.deepEqual(clock.finish(), { step1Duration: 7, step2Duration: 7 });
});
test('CAPTCHA settings retain total/type selection, guarantee both stages for multi-challenge runs', () => {
  assert.deepEqual(captchaPlan(false, 5, ['number']), []);
  assert.deepEqual(captchaPlan(true, 1, ['number']), [{ type: 'number', step: 1 }]);
  for (const random of [() => 0, () => .999]) for (const count of [2, 3, 4, 5]) {
    const plan = captchaPlan(true, count, ['number', 'text'], random);
    assert.equal(plan.length, count); assert.equal(new Set(plan.map(p => p.step)).size, 2);
    for (let i = 1; i < plan.length; i++) assert.notEqual(plan[i].type, plan[i - 1].type);
  }
});
test('Sales session metadata survives validation while legacy sessions remain valid', () => {
  const base = { startTime: { $timestamp: 1000 }, endTime: { $timestamp: 2000 }, totalDuration: 1000, totalDurationSeconds: 1, step1Duration: .5, step2Duration: .5, captchaDuration: 0, correctCaptchas: 0, incorrectCaptchas: 0, project: 'Lənkəran Yaşayış Kompleksi' };
  assert.equal(sessionFields('sales', base).selection, undefined);
  const selection = { ...findApartment(sample)!, paymentMethod: 'own', method: 'address', catalogVersion: salesCatalog.version };
  assert.deepEqual(sessionFields('sales', { ...base, selection }).selection, selection);
  assert.throws(() => sessionFields('sales', { ...base, selection: { ...selection, method: 'invalid' } }));
});
