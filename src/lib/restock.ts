/**
 * Splitting a delivery cost across the items of a restock.
 *
 * The cost is shared out per unit delivered, so every unit carries the same
 * extra cost: a line of 10 units takes twice the share of a line of 5. That adds
 * the same amount to each item's final unit cost, whatever it costs to buy.
 */

/**
 * Splits `deliveryCost` between lines in proportion to their quantities.
 * Shares are rounded to cents, and any leftover cents go to the lines whose
 * exact share had the biggest fractions, so the shares always add up to
 * exactly the delivery cost.
 */
export function allocateDelivery(quantities: number[], deliveryCost: number): number[] {
  const cents = Math.max(0, Math.round(deliveryCost * 100));
  const units = quantities.reduce((sum, q) => sum + (q > 0 ? q : 0), 0);
  if (cents === 0 || units === 0) return quantities.map(() => 0);

  const exact = quantities.map((q) => (q > 0 ? (cents * q) / units : 0));
  const shares = exact.map(Math.floor);
  let leftover = cents - shares.reduce((a, b) => a + b, 0);

  const byFraction = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const { index } of byFraction) {
    if (leftover <= 0) break;
    if (quantities[index] > 0) {
      shares[index] += 1;
      leftover -= 1;
    }
  }
  return shares.map((c) => c / 100);
}
