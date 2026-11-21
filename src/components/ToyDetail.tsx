"use client";

import { useCan } from "@/lib/account";
import { useState } from "react";
import { formatDate, money } from "@/lib/format";
import { deleteToy } from "@/lib/store";
import { CATEGORY_EMOJI, costValue, retailValue, totalStock, type Toy } from "@/lib/types";
import { confirmDialog } from "./confirm";
import { ImageCarousel } from "./images";
import { StockBadge } from "./toy-parts";
import { ToyForm } from "./ToyForm";
import { Badge, Button, Modal, ModalActions, QUALITY_TONE } from "./ui";

/**
 * Everything about one toy in a modal: its pictures as a carousel, its details,
 * and buttons to edit or delete it without leaving the inventory.
 */
export function ToyDetail({
  toy,
  currency,
  onClose,
}: {
  toy: Toy;
  currency: string;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const can = useCan();

  async function remove() {
    const confirmed = await confirmDialog({
      title: `Delete "${toy.name}"?`,
      message: "It will be removed from the inventory, with its pictures. Past transactions are kept.",
      confirmLabel: "Delete toy",
      tone: "danger",
    });
    if (!confirmed) return;
    deleteToy(toy.id);
    onClose();
  }

  return (
    <Modal title={editing ? `Edit ${toy.name}` : toy.name} size={editing ? "md" : "xl"} onClose={onClose}>
      {editing ? (
        <ToyForm toy={toy} onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            <ImageCarousel ids={toy.images} alt={toy.name} />

            <div className="min-w-0 space-y-4">
              <div>
                <p className="text-sm text-muted">{toy.manufacturer || "No manufacturer listed"}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge>
                    <span aria-hidden="true">{CATEGORY_EMOJI[toy.category]}&nbsp;</span>
                    {toy.category}
                  </Badge>
                  <StockBadge toy={toy} />
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {[
                  ["SKU", toy.sku || "—"],
                  ["Total in stock", String(totalStock(toy))],
                  ["Stock value (retail)", money(retailValue(toy), currency)],
                  ["Stock value (cost)", money(costValue(toy), currency)],
                  ["Low-stock level", String(toy.reorderLevel)],
                  ["Added", formatDate(toy.createdAt.slice(0, 10))],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-muted">{label}</dt>
                    <dd className="font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>

              <div>
                <h3 className="mb-1.5 text-xs font-medium text-muted">Qualities</h3>
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs text-muted">
                        <th className="px-3 py-2 font-medium">Quality</th>
                        <th className="px-3 py-2 text-right font-medium">Price</th>
                        <th className="px-3 py-2 text-right font-medium">Cost</th>
                        <th className="px-3 py-2 text-right font-medium">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {toy.qualities.map((q) => (
                        <tr key={q.quality} className="border-b border-line last:border-0">
                          <td className="px-3 py-2">
                            <Badge tone={QUALITY_TONE[q.quality]}>{q.quality}</Badge>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{money(q.price, currency)}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted">
                            {money(q.cost, currency)}
                          </td>
                          <td
                            className={`px-3 py-2 text-right tabular-nums ${q.stock === 0 ? "text-muted" : ""}`}
                          >
                            {q.stock === 0 ? "Sold out" : q.stock}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {toy.notes && (
                <div>
                  <h3 className="mb-1 text-xs font-medium text-muted">Notes</h3>
                  <p className="text-sm whitespace-pre-wrap">{toy.notes}</p>
                </div>
              )}
            </div>
          </div>

          {(can("inventory.delete") || can("inventory.edit")) && (
            <ModalActions
              className="border-t border-line pt-4"
              start={
                can("inventory.delete") ? (
                  <Button variant="danger" onClick={remove}>
                    Delete
                  </Button>
                ) : undefined
              }
            >
              {can("inventory.edit") && (
                <Button variant="primary" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )}
            </ModalActions>
          )}
        </>
      )}
    </Modal>
  );
}
