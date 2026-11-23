export const olderThan = (ms: number): Date => {
  return new Date(Date.now() - ms);
};
