/**
 * Immatriculation française (SIV) normalisée « AA-123-AA », pour rapprocher
 * les véhicules Webfleet (objectname) des tournées Business Central (Vehicle_No).
 */
export function canonicalPlate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const m = /([A-Z]{2})(\d{3})([A-Z]{2})/.exec(compact);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}
