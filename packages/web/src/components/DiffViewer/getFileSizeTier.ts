export type FileSizeTier = 'small' | 'medium' | 'large' | 'huge';

const MEDIUM_THRESHOLD = 500;
const LARGE_THRESHOLD = 5_000;
const HUGE_THRESHOLD = 50_000;

export const getFileSizeTier = (totalRows: number): FileSizeTier => {
  if (totalRows >= HUGE_THRESHOLD) {
    return 'huge';
  }
  if (totalRows >= LARGE_THRESHOLD) {
    return 'large';
  }
  if (totalRows >= MEDIUM_THRESHOLD) {
    return 'medium';
  }

  return 'small';
};
