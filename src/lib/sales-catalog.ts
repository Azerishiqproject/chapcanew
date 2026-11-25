import snapshot from '@/data/sales-catalog.json';

export type CatalogUnit = [entrance: string, apartment: string, rooms: number, internalArea: number, externalArea: number];
export interface CatalogBuilding { number: string; floorCount: number; complete: boolean; sectors: { id: number; floorCount: number }[]; layouts: { floors: number[]; units: CatalogUnit[] }[] }
export interface CatalogProject { id: string; name: string; source: string; buildings: CatalogBuilding[] }
export const salesCatalog = snapshot as unknown as { version: string; retrievedAt: string; projects: CatalogProject[] };
export interface SalesAddress { projectId: string; building: string; entrance: string; floor: string; apartment: string }
export interface SalesApartment extends SalesAddress { rooms: number; internalArea: number; externalArea: number; floorCount: number }
export const emptyAddress: SalesAddress = { projectId: '', building: '', entrance: '', floor: '', apartment: '' };
const sorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, 'az', { numeric: true }));
export function projectFor(id: string) { return salesCatalog.projects.find(project => project.id === id); }
function buildingFor(address: SalesAddress) { return projectFor(address.projectId)?.buildings.find(building => building.number === address.building); }
export function addressOptions(address: SalesAddress, override?: CatalogBuilding) {
  const project = projectFor(address.projectId), building = override ?? buildingFor(address);
  const layouts = building?.layouts ?? [];
  return {
    buildings: sorted(project?.buildings.filter(item => !item.complete || item.layouts.length > 0).map(item => item.number) ?? []),
    entrances: sorted(layouts.flatMap(layout => layout.units.map(unit => unit[0]))),
    floors: sorted(layouts.filter(layout => layout.units.some(unit => unit[0] === address.entrance)).flatMap(layout => layout.floors.map(String))),
    apartments: sorted(layouts.filter(layout => layout.floors.includes(Number(address.floor))).flatMap(layout => layout.units.filter(unit => unit[0] === address.entrance).map(unit => unit[1]))),
  };
}
export function changeAddress(address: SalesAddress, field: keyof SalesAddress, value: string): SalesAddress {
  const fields = ['projectId', 'building', 'entrance', 'floor', 'apartment'] as const;
  const next = { ...address, [field]: value };
  for (const descendant of fields.slice(fields.indexOf(field) + 1)) next[descendant] = '';
  return next;
}
export function findApartment(address: SalesAddress, override?: CatalogBuilding): SalesApartment | null {
  if (Object.values(address).some(value => !value)) return null;
  const building = override ?? buildingFor(address);
  const unit = building?.layouts.filter(layout => layout.floors.includes(Number(address.floor)))
    .flatMap(layout => layout.units).find(unit => unit[0] === address.entrance && unit[1] === address.apartment);
  return unit && building ? { ...address, rooms: unit[2], internalArea: unit[3], externalArea: unit[4], floorCount: building.floorCount } : null;
}
