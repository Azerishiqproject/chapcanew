'use client';
import { memo, useMemo } from 'react';
import { addressOptions, type CatalogBuilding, type SalesAddress } from '@/lib/sales-catalog';
interface Props { rowClassName: string; address: SalesAddress; building?: CatalogBuilding; loading: boolean; error: string; onChange: (field: keyof SalesAddress, value: string) => void; onFocus: (field: keyof SalesAddress) => void }
/** Keep native select nodes and their options stable during unrelated timer/save updates. */
export default memo(function SalesAddressFields({ rowClassName, address, building, loading, error, onChange, onFocus }: Props) {
  const options = useMemo(() => addressOptions(address, building), [address, building]);
  return <>{([{ field: 'building', label: 'Bina nömrəsi', values: options.buildings, enabled: true }, { field: 'entrance', label: 'Giriş nömrəsi', values: options.entrances, enabled: !!address.building }, { field: 'floor', label: 'Mərtəbə nömrəsi', values: options.floors, enabled: !!address.entrance }, { field: 'apartment', label: 'Mənzil nömrəsi', values: options.apartments, enabled: !!address.floor }] as const).map(({ field, label, values, enabled }) => <label className={rowClassName} key={field}><span>{label}</span><select aria-label={label} value={address[field]} disabled={!enabled || (field !== 'building' && (loading || !!error))} onFocus={() => onFocus(field)} onChange={event => onChange(field, event.target.value)}><option value="" aria-label={loading && field === 'entrance' ? 'Yüklənir' : 'Seçin'}>{loading && field === 'entrance' ? '...' : ''}</option>{values.map(value => <option key={value} value={value}>{value}</option>)}</select></label>)}</>;
});
