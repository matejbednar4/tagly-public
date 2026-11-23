// Czech administrative regions (kraje). Each `value` must match exactly what the
// geocoder (Amazon Location) returns as the region for a CZ address, because the
// stored `Address.region` is that normalized string and the edit form reselects
// the matching option by value. `label` is the friendly display name (may differ
// from value, e.g. "Praha" vs the normalized "Hlavní město Praha").
//
// Mirrors the structure of US_STATES (whose full state names already match the
// geocoder's Region.Name, so US needs no such divergence).
export const CZ_REGIONS = [
  { label: "Praha", value: "Hlavní město Praha" },
  { label: "Středočeský kraj", value: "Středočeský kraj" },
  { label: "Jihočeský kraj", value: "Jihočeský kraj" },
  { label: "Plzeňský kraj", value: "Plzeňský kraj" },
  { label: "Karlovarský kraj", value: "Karlovarský kraj" },
  { label: "Ústecký kraj", value: "Ústecký kraj" },
  { label: "Liberecký kraj", value: "Liberecký kraj" },
  { label: "Královéhradecký kraj", value: "Královéhradecký kraj" },
  { label: "Pardubický kraj", value: "Pardubický kraj" },
  { label: "Kraj Vysočina", value: "Vysočina" },
  { label: "Jihomoravský kraj", value: "Jihomoravský kraj" },
  { label: "Olomoucký kraj", value: "Olomoucký kraj" },
  { label: "Zlínský kraj", value: "Zlínský kraj" },
  { label: "Moravskoslezský kraj", value: "Moravskoslezský kraj" },
];
