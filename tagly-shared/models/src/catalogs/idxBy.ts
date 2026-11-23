export const idxBy = <T extends { slug: string }>(rows: T[]) => {
  const bySlug = new Map<string, T>();
  for (const r of rows) bySlug.set(r.slug, r);
  return bySlug;
};
