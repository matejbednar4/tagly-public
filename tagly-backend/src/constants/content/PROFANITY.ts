/**
 * Czech profanity/slur list for the text content check
 * (`utils/moderation/assertTextAllowedOrThrow`). English is covered by the
 * `obscenity` package's maintained dataset; Czech has no standard package, so
 * this curated list is ours.
 *
 * Matching notes (see the util): input is lowercased and diacritics-stripped
 * before matching, so entries here are written WITHOUT diacritics; each entry
 * is matched as a whole word (word-boundary), so keep entries to unambiguous
 * strong vulgarisms and slurs — short stems would false-flag ordinary words
 * (and business names like wineries/bars must never trip this).
 */
export const CS_PROFANITY = [
  // strong vulgarisms (with common case declensions — Czech inflects, so the
  // nominative alone misses e.g. "U Cikána"; every form is listed explicitly
  // rather than via suffix wildcards, which false-flag names like "Picasso")
  "kurva",
  "kurvy",
  "kurvo",
  "kurve",
  "kurvou",
  "pica",
  "pice",
  "picu",
  "pico",
  "picou",
  "pici",
  "kokot",
  "kokota",
  "kokote",
  "kokoti",
  "kokotu",
  "curak",
  "curaka",
  "curaci",
  "curaku",
  "zmrd",
  "zmrda",
  "zmrde",
  "zmrdi",
  "zmrdu",
  "mrdat",
  "mrdka",
  "mrdky",
  "jebat",
  "vyjebanec",
  "vyjebance",
  "dojebany",
  "zajebany",
  "hovado",
  "sracka",
  "sracky",
  "prdel",
  "prdele",
  "debil",
  "debila",
  "debilni",
  "kreten",
  "kretena",
  "kreteni",
  "idiot",
  "idiota",
  // slurs (again with declensions)
  "cikan",
  "cikana",
  "cikanovi",
  "cikane",
  "cikanem",
  "cikanu",
  "cikani",
  "cikanka",
  "cikanky",
  "cikansky",
  "negr",
  "negra",
  "negre",
  "negri",
  "negrovi",
  "negru",
  "bukvice",
  "buzna",
  "buzny",
  "buzerant",
  "buzeranta",
  "buzeranti",
  "teplous",
  "teplouse",
  "teplousi",
] as const;
