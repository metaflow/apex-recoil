export function percentile(values: number[], p: number) {
    const xx = values.map(x => x);
    if (xx.length === 0 || p < 0) return NaN;
    if (p > 1) p = 1;
    xx.sort((a, b) => a - b);
    const i = (xx.length - 1) * p;
    if ((i | 0) === i) return xx[i];
    var int_part = i | 0;
    var f = i - int_part;
    return (1 - f) * xx[int_part] + f * xx[Math.min(int_part + 1, xx.length - 1)];
  }