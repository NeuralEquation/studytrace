export function compressItemNumbers(numbers: number[]): string {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const out: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    let end = start;
    while (sorted[i + 1] === end + 1) end = sorted[++i];
    out.push(start === end ? String(start) : `${start}〜${end}`);
  }
  return out.join("、");
}
