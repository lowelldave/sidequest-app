"use client";

import { formatDate } from "./format";
import { getShopSettings, logoUrl } from "./shop";
import { TRANSACTION_LABEL, type Toy, type Transaction } from "./types";

/**
 * Builds a PDF invoice and downloads it. Normally that's for one transaction, but
 * the lines of a restock that arrived as one delivery are passed together and
 * make a single invoice, with the delivery cost shown.
 *
 * The PDF library is loaded only when this runs, so it doesn't weigh down the
 * rest of the app. The PDF's built-in fonts only cover Western European
 * characters, so amounts use the currency code ("USD 49.98") rather than a
 * symbol, and text outside that range may not print.
 */

/** What the document calls itself and its total, by kind of transaction. */
const WORDING = {
  sale: {
    title: "INVOICE",
    total: "Total",
    // Replaced by the footer set in Shop setup, if there is one.
    footer: "Thank you for shopping with us.",
  },
  refund: {
    title: "REFUND RECEIPT",
    total: "Total refunded",
    footer: "This amount was refunded to the customer.",
  },
  restock: {
    title: "RESTOCK RECORD",
    total: "Total cost",
    footer: "Record of stock bought for the shop.",
  },
} as const;

/** A short, readable number for the document: INV-<date>-<last six letters of the id>. */
export function invoiceNumber(tx: Transaction): string {
  // Every line of one delivery shares a batch id, so they all get the same number.
  const tail = (tx.batchId ?? tx.id).replace(/[^a-z0-9]/gi, "").slice(-6).toUpperCase();
  return `INV-${tx.date.replaceAll("-", "")}-${tail}`;
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "code" })
    .format(amount)
    // The formatter separates the code from the number with a non-breaking space.
    .replace(/ /g, " ");
}

type Logo = { dataUrl: string; format: "PNG" | "JPEG"; width: number; height: number };

/**
 * The shop's logo (the one from Shop setup, or the built-in one) as a data URL
 * with its size, or null if it can't be loaded (the name is printed instead).
 */
async function loadLogo(path: string): Promise<Logo | null> {
  try {
    const response = await fetch(path ? logoUrl(path) : "/logo.png");
    if (!response.ok) return null;
    const blob = await response.blob();
    const dataUrl = await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
    if (!dataUrl) return null;
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return { dataUrl, format: blob.type === "image/png" ? "PNG" : "JPEG", ...size };
  } catch {
    return null;
  }
}

/**
 * Creates the invoice PDF for `txs` (all the same kind and date, usually just one),
 * saves it through the browser, and returns the file name. `toys` supplies the
 * manufacturer and SKU of each line where the toy still exists.
 */
export async function downloadInvoice(txs: Transaction[], toys: Toy[], currency: string): Promise<string> {
  if (txs.length === 0) throw new Error("Nothing to invoice.");
  const first = txs[0];
  const shop = getShopSettings();
  const shopName = shop.name;
  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), loadLogo(shop.logo_path)]);
  const words = {
    ...WORDING[first.type],
    ...(first.type === "sale" && shop.invoice_footer.trim() ? { footer: shop.invoice_footer.trim() } : {}),
  };
  const number = invoiceNumber(first);
  const hasDelivery = txs.some((t) => (t.delivery ?? 0) > 0);

  // `compress` matters: without it the logo is stored as raw pixels and each PDF is over 600 KB.
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 20;
  const right = pageW - 20;
  const ink: [number, number, number] = [27, 26, 23];
  const muted: [number, number, number] = [102, 99, 91];
  const rule: [number, number, number] = [214, 210, 200];

  const text = (
    value: string,
    x: number,
    y: number,
    opts: { size?: number; bold?: boolean; color?: [number, number, number]; align?: "left" | "right" } = {},
  ) => {
    doc.setFont("helvetica", opts.bold ? "bold" : "normal");
    doc.setFontSize(opts.size ?? 10);
    doc.setTextColor(...(opts.color ?? ink));
    doc.text(value, x, y, { align: opts.align ?? "left" });
  };

  // ---- Header: shop on the left, document title on the right ----
  let headerBottom = 20;
  if (logo) {
    // Fit within 42 x 28 mm, keeping the logo's shape.
    const fit = Math.min(42 / logo.width, 28 / logo.height);
    const logoW = logo.width * fit;
    const logoH = logo.height * fit;
    doc.addImage(logo.dataUrl, logo.format, left, 16, logoW, logoH);
    headerBottom = 16 + logoH;
  } else {
    text(shopName, left, 24, { size: 14, bold: true });
    headerBottom = 28;
  }
  text(words.title, right, 24, { size: 22, bold: true, align: "right" });
  text(number, right, 31, { size: 10, color: muted, align: "right" });

  // The shop's contact details, from Shop setup.
  const contact = [
    ...shop.invoice_address.split("\n"),
    [shop.invoice_phone, shop.invoice_email].filter((v) => v.trim()).join("  |  "),
  ]
    .map((line) => line.trim())
    .filter(Boolean);
  if (contact.length > 0) {
    if (logo) text(shopName, left, headerBottom + 6, { size: 10, bold: true });
    const start = headerBottom + (logo ? 11 : 5);
    contact.forEach((line, i) => text(line, left, start + i * 4.4, { size: 8.5, color: muted }));
    headerBottom = start + (contact.length - 1) * 4.4 + 2;
  }
  headerBottom = Math.max(headerBottom, 34);

  // ---- Details block ----
  let y = headerBottom + 12;
  doc.setDrawColor(...rule);
  doc.line(left, y - 6, right, y - 6);
  const details: [string, string][] = [
    ["Date", formatDate(first.date)],
    ["Type", TRANSACTION_LABEL[first.type]],
    ["Payment", first.payment],
  ];
  const colW = (right - left) / details.length;
  details.forEach(([label, value], i) => {
    text(label.toUpperCase(), left + i * colW, y, { size: 8, bold: true, color: muted });
    text(value, left + i * colW, y + 6, { size: 11 });
  });
  y += 20;

  // ---- Item table ----
  // Column right edges. A delivery column makes room by pulling the others left.
  const qtyX = left + (hasDelivery ? 78 : 100);
  const priceX = left + (hasDelivery ? 102 : 135);
  const deliveryX = left + 130;
  const amountX = right - 3;
  const descWidth = qtyX - left - 14;
  const priceLabel = first.type === "restock" ? "UNIT COST" : "UNIT PRICE";
  /** Lowest y a row may reach, leaving room for the totals and footer. */
  const bottomLimit = pageH - 34;

  const drawTableHeader = () => {
    doc.setFillColor(243, 241, 235);
    doc.rect(left, y - 5, right - left, 9, "F");
    text("DESCRIPTION", left + 3, y + 1, { size: 8, bold: true, color: muted });
    text("QTY", qtyX, y + 1, { size: 8, bold: true, color: muted, align: "right" });
    text(priceLabel, priceX, y + 1, { size: 8, bold: true, color: muted, align: "right" });
    if (hasDelivery) text("DELIVERY", deliveryX, y + 1, { size: 8, bold: true, color: muted, align: "right" });
    text("AMOUNT", amountX, y + 1, { size: 8, bold: true, color: muted, align: "right" });
    y += 11;
  };
  drawTableHeader();

  txs.forEach((tx, index) => {
    const toy = toys.find((t) => t.id === tx.toyId);
    const delivery = tx.delivery ?? 0;

    // Measure first: if the row won't fit on this page, start a new one.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    const nameLines: string[] = doc.splitTextToSize(tx.toyName, descWidth);
    const subLines = [
      delivery > 0
        ? `Quality: ${tx.quality}  |  Final unit cost: ${formatAmount(tx.amount / tx.quantity, currency)}`
        : `Quality: ${tx.quality}`,
      [toy?.manufacturer, toy?.sku && `SKU ${toy.sku}`].filter(Boolean).join("  |  "),
    ].filter(Boolean);
    const rowHeight = nameLines.length * 5.2 + subLines.length * 4.4 + 5;
    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = 25;
      drawTableHeader();
    }

    const rowTop = y;
    nameLines.forEach((line, i) => text(line, left + 3, y + i * 5.2, { size: 10.5, bold: true }));
    y += (nameLines.length - 1) * 5.2;
    subLines.forEach((line, i) => text(line, left + 3, y + 5 + i * 4.4, { size: 8.5, color: muted }));
    y += 5 + (subLines.length - 1) * 4.4;

    text(String(tx.quantity), qtyX, rowTop, { size: 10.5, align: "right" });
    text(formatAmount(tx.unitPrice, currency), priceX, rowTop, { size: 10.5, align: "right" });
    if (hasDelivery) text(formatAmount(delivery, currency), deliveryX, rowTop, { size: 10.5, align: "right" });
    text(formatAmount(tx.amount, currency), amountX, rowTop, { size: 10.5, align: "right" });

    y += 6;
    if (index < txs.length - 1) {
      doc.setDrawColor(...rule);
      doc.setLineWidth(0.1);
      doc.line(left, y - 2, right, y - 2);
      doc.setLineWidth(0.2);
      y += 3;
    }
  });

  y += 1;
  doc.setDrawColor(...rule);
  doc.line(left, y, right, y);

  // ---- Totals ----
  const total = txs.reduce((sum, t) => sum + t.amount, 0);
  const deliveryTotal = txs.reduce((sum, t) => sum + (t.delivery ?? 0), 0);
  const itemsTotal = total - deliveryTotal;
  const labelX = right - 70;
  if (y + (hasDelivery ? 34 : 18) > bottomLimit + 12) {
    doc.addPage();
    y = 20;
  }
  y += 9;
  if (hasDelivery) {
    text("Items subtotal", labelX, y, { size: 10, color: muted });
    text(formatAmount(itemsTotal, currency), amountX, y, { size: 10, align: "right" });
    y += 6;
    text("Delivery cost", labelX, y, { size: 10, color: muted });
    text(formatAmount(deliveryTotal, currency), amountX, y, { size: 10, align: "right" });
    y += 4;
    doc.setDrawColor(...rule);
    doc.line(labelX, y, right, y);
    y += 7;
  }
  text(words.total, labelX, y, { size: 12, bold: true });
  text(formatAmount(total, currency), amountX, y, { size: 14, bold: true, align: "right" });
  if (hasDelivery) {
    y += 7;
    const units = txs.reduce((sum, t) => sum + t.quantity, 0);
    text(
      `Delivery is split across all ${units} units and included in each item's final unit cost.`,
      right,
      y,
      { size: 8, color: muted, align: "right" },
    );
  }

  // ---- Note ----
  if (first.note) {
    y += 14;
    if (y + 20 > pageH - 28) {
      doc.addPage();
      y = 25;
    }
    text("NOTE", left, y, { size: 8, bold: true, color: muted });
    // Measure with the font the note is drawn in, or the lines come out too long.
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const noteLines: string[] = doc.splitTextToSize(first.note, right - left);
    noteLines.forEach((line, i) => text(line, left, y + 6 + i * 5, { size: 10 }));
  }

  // ---- Footer, on every page ----
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(...rule);
    doc.line(left, pageH - 24, right, pageH - 24);
    text(words.footer, left, pageH - 17, { size: 9, color: muted });
    text(pages > 1 ? `${shopName}  |  Page ${page} of ${pages}` : shopName, right, pageH - 17, {
      size: 9,
      color: muted,
      align: "right",
    });
  }

  const fileName = `${number}.pdf`;
  doc.save(fileName);
  return fileName;
}
