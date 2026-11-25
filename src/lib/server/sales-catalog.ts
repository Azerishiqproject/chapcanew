import { projectFor, type CatalogBuilding, type CatalogUnit } from '@/lib/sales-catalog';
import { ApiError } from './security';

const base = 'https://api.mida.gov.az/api/front';
type ReadJson = (path: string) => Promise<unknown>;
interface Floor { id: number; floor_number: number; sector_floor_plan_id: number }
interface Apartment { entrance_number: number | string; apartment_number: number | string; count_of_rooms: number; internal_size: number; external_size: number }
const cache = new Map<string, { until: number; promise: Promise<CatalogBuilding> }>();
const readJson: ReadJson = async path => {
  const response = await fetch(base + path, { signal: AbortSignal.timeout(10000), next: { revalidate: 86400 } });
  if (!response.ok) throw new Error('MIDA catalog unavailable');
  return response.json();
};
/** Only allowlisted official sector IDs are fetched; this route accepts no upstream URL. */
export async function fetchBuilding(projectId: string, number: string, read: ReadJson = readJson): Promise<CatalogBuilding> {
  const source = projectFor(projectId)?.buildings.find(building => building.number === number);
  if (!source) throw new ApiError(404, 'Bina tapılmadı.');
  if (source.complete) return source;
  const building: CatalogBuilding = { ...source, complete: true, layouts: [] };
  // The official floor-plan ID identifies repeated layouts within the same sector.
  for (const sector of source.sectors) {
    const data = await read(`/getSectorFloors/${sector.id}`) as { floors?: Floor[] };
    if (!Array.isArray(data.floors)) throw new Error('Invalid floor list');
    const groups = new Map<number, Floor[]>();
    for (const floor of data.floors) {
      if (!Number.isInteger(floor.floor_number) || floor.floor_number < 1) continue;
      groups.set(floor.sector_floor_plan_id, [...(groups.get(floor.sector_floor_plan_id) ?? []), floor]);
    }
    for (const floors of groups.values()) {
      const detail = await read(`/getSectorFloorsApartments/${sector.id}/${floors[0].id}`) as { apartments?: Apartment[] };
      if (!Array.isArray(detail.apartments)) throw new Error('Invalid apartment list');
      const units: CatalogUnit[] = detail.apartments.map(unit => {
        const rooms = Number(unit.count_of_rooms), inside = Number(unit.internal_size), outside = Number(unit.external_size);
        if (unit.entrance_number == null || unit.apartment_number == null || ![rooms, inside, outside].every(value => Number.isFinite(value) && value > 0)) throw new Error('Invalid apartment');
        return [String(unit.entrance_number), String(unit.apartment_number), rooms, inside, outside];
      });
      if (units.length) building.layouts.push({ floors: floors.map(floor => floor.floor_number), units });
    }
  }
  if (!building.layouts.length) throw new Error('Empty apartment catalogue');
  return building;
}
export async function salesBuilding(projectId: string, number: string) {
  const key = `${projectId}/${number}`, existing = cache.get(key);
  if (existing && existing.until > Date.now()) return existing.promise;
  const promise = fetchBuilding(projectId, number).catch(error => {
    cache.delete(key);
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, 'Bina məlumatı hazırda yüklənmədi. Yenidən yoxlayın.');
  });
  cache.set(key, { until: Date.now() + 86400000, promise });
  return promise;
}
