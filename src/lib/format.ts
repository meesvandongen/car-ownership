const eurFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const eurFormatter2 = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("nl-NL", {
  maximumFractionDigits: 0,
});

export function formatEuro(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return eurFormatter.format(n);
}

export function formatEuroPrecise(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return eurFormatter2.format(n);
}

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return numberFormatter.format(n);
}

export function formatPercent(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}
