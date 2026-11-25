import type { ReactNode } from 'react';
import { z } from 'zod';
import type { HttpClientManager } from './http';
import { useGlobalization } from './globalization';
import { validateContact, type FormErrors } from './forms';
import { Field, FormGroup, SelectField } from './ui/primitives';

const text = z.string().nullish();
const id = z.number().int();
export const contactSchema = z.object({
  id, userName: text, nameSurname: text, email: text, email2: text, phone: text, phone2: text,
  gender: id, birthDate: text, localBirthDate: text, birthDateWithOffset: text,
  useCalendarBirthDate: z.boolean().optional(), countryId: id, countryRegionId: id, cityId: id,
  lastPasswordChangedDate: text, website: text, description: text,
});
export type ContactValues = z.infer<typeof contactSchema>;
const place = z.object({ id, name: text, countryName: text, countryId: id.optional(),
  countryRegionId: id.optional(), regionName: text, cityName: text });
type Place = z.infer<typeof place>;
export interface Places { countries: Place[]; regions: Place[]; cities: Place[] }

export async function loadPlaces(http: HttpClientManager, signal: AbortSignal): Promise<Places> {
  const prefix = '/api/globalentityservice/';
  const [countries, regions, cities] = await Promise.all(
    ['getcountriessimple', 'getcountryregionssimple', 'getcitiessimple'].map(route =>
      http.json(prefix + route, z.array(place), { signal })),
  );
  return { countries, regions, cities };
}

export function toEditorContact<T extends ContactValues>(value: T): T {
  return { ...value, birthDate: value.localBirthDate ?? value.birthDate?.slice(0, 10) ?? '' };
}

export function toSaveContact<T extends ContactValues>(value: T, original: ContactValues): T {
  const unchanged = value.birthDate === toEditorContact(original).birthDate;
  return {
    ...value, useCalendarBirthDate: true,
    localBirthDate: unchanged && original.birthDateWithOffset ? null : value.birthDate || null,
    birthDateWithOffset: unchanged ? original.birthDateWithOffset : null,
    birthDate: value.birthDate ? value.birthDate + 'T00:00:00' : null,
  };
}

export function ContactFields<T extends ContactValues>({ values, places, errors, change, replace, isModified, disabled, includeAdmin, generalDetails }: {
  values: T; places: Places; errors: FormErrors; change: <K extends keyof T>(key: K, value: T[K]) => void;
  replace: (value: T) => void; isModified: (key: keyof T) => boolean;
  disabled?: boolean; includeAdmin?: boolean; generalDetails?: ReactNode;
}) {
  const { t } = useGlobalization();
  const empty = { value: 0, label: '–' };
  const options = (values: Place[], name: 'countryName' | 'regionName' | 'cityName') =>
    [empty, ...values.map(place => ({ value: place.id, label: place[name] ?? place.name ?? String(place.id) }))];
  const regions = places.regions.filter(region => region.countryId === values.countryId);
  const cities = places.cities.filter(city => city.countryId === values.countryId
    && (!values.countryRegionId || city.countryRegionId === values.countryRegionId));
  const validation = validateContact(values, t('Common.Required'), t('Common.Invalid'));
  const valid = (key: keyof ContactValues) => isModified(key) && !validation[key];
  const textField = (key: 'userName' | 'nameSurname' | 'email' | 'email2' | 'phone' | 'phone2' | 'website' | 'description', label: string, type = 'text') =>
    <Field key={key} name={key} label={label} disabled={disabled} type={type}
      value={values[key] ?? ''} onChange={value => change(key, value as T[typeof key])} error={errors[key]} valid={valid(key)} />;
  return <>
    <FormGroup title={t('Common.General')}>
      {textField('userName', t('UserName', undefined, 'Core'))}
      {textField('nameSurname', t('Field.Name'))}
      <SelectField label={t('Field.Gender')} value={values.gender} disabled={disabled}
        valid={valid('gender')}
        options={[{ value: 0, label: t('Field.Unspecified') }, { value: 1, label: t('Field.Male') }, { value: 2, label: t('Field.Female') }]}
        onChange={value => change('gender', Number(value) as T['gender'])} />
      <Field label={t('Field.BirthDate')} type="date" value={values.birthDate ?? ''} disabled={disabled}
        onChange={value => change('birthDate', value as T['birthDate'])} error={errors.birthDate} valid={valid('birthDate')} />
      {includeAdmin && textField('description', t('Field.Description'))}
      {generalDetails}
    </FormGroup>
    <FormGroup title={t('Common.Contact')}>
      {textField('email', t('Field.Email'), 'email')}{textField('email2', t('Field.Email2'), 'email')}
      {textField('phone', t('Field.Phone'), 'tel')}{textField('phone2', t('Field.Phone2'), 'tel')}
      {includeAdmin && textField('website', t('Field.Website'), 'url')}
      <SelectField label={t('Field.Country')} value={values.countryId} disabled={disabled} error={errors.countryId}
        valid={valid('countryId')}
        options={options(places.countries, 'countryName')}
        onChange={country => replace({ ...values, countryId: Number(country), countryRegionId: 0, cityId: 0 })} />
      <SelectField label={t('Field.Region')} value={values.countryRegionId} disabled={disabled || !values.countryId}
        valid={valid('countryRegionId')}
        options={options(regions, 'regionName')}
        onChange={region => replace({ ...values, countryRegionId: Number(region), cityId: 0 })} />
      <SelectField label={t('Field.City')} value={values.cityId} disabled={disabled || !values.countryId}
        valid={valid('cityId') && cities.some(city => city.id === values.cityId)}
        error={errors.cityId} options={options(cities, 'cityName')}
        onChange={city => change('cityId', Number(city) as T['cityId'])} />
    </FormGroup>
  </>;
}
