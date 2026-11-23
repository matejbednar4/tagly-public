declare module "tz-lookup" {
  /**
   * Returns the IANA timezone name (e.g. "America/New_York") for the given
   * WGS84 coordinates. Snaps to the nearest zone; throws a RangeError only if
   * latitude/longitude are out of range.
   */
  function tzlookup(latitude: number, longitude: number): string;
  export = tzlookup;
}
