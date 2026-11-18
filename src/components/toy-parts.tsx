import { money } from "@/lib/format";
import { stockStatus, totalStock, type Toy } from "@/lib/types";
import { Badge, QUALITY_TONE } from "./ui";

/** Overall stock level of a toy across all its qualities. */
export function StockBadge({ toy }: { toy: Toy }) {
  const status = stockStatus(toy);
  if (status === "out") return <Badge tone="red">Out of stock</Badge>;
  if (status === "low") return <Badge tone="amber">Low · {totalStock(toy)}</Badge>;
  return <Badge tone="green">In stock · {totalStock(toy)}</Badge>;
}

/** One badge per quality the toy comes in, with how many are in stock. */
export function QualityBadges({ toy }: { toy: Toy }) {
  return (
    <>
      {toy.qualities.map((q) => (
        <span key={q.quality} className={q.stock === 0 ? "opacity-50" : undefined}>
          <Badge tone={QUALITY_TONE[q.quality]}>
            {q.quality} · {q.stock}
          </Badge>
        </span>
      ))}
    </>
  );
}

/** "$14.99" when every quality costs the same, otherwise "$14.99–$24.99". */
export function priceText(min: number, max: number, currency: string): string {
  return min === max ? money(min, currency) : `${money(min, currency)}–${money(max, currency)}`;
}

/** Lowest and highest unit cost across a toy's qualities. */
export function costRange(toy: Toy): [number, number] {
  const costs = toy.qualities.map((q) => q.cost);
  return [Math.min(...costs), Math.max(...costs)];
}
