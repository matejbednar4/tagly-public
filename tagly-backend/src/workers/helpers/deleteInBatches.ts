export async function deleteInBatches<TId extends number | string>(opts: {
  batchSize: number;
  maxBatches: number;
  findIds: (take: number) => Promise<TId[]>;
  hardDelete: (ids: TId[]) => Promise<number>;
}) {
  const { batchSize, maxBatches, findIds, hardDelete } = opts;

  let total = 0;
  for (let i = 0; i < maxBatches; i++) {
    const ids = await findIds(batchSize);
    if (ids.length === 0) break;

    const count = await hardDelete(ids);
    total += count;

    if (ids.length < batchSize) break;
  }

  return total;
}
