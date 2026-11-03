import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TransferReceipt } from '../types/banking';

/**
 * Mask account number to protect privacy (e.g. •••• •••• 0091)
 */
export function maskAccountNumber(acc?: string): string {
  if (!acc) return '';
  const clean = acc.replace(/\D/g, '');
  if (clean.length <= 4) return `•••• ${clean}`;
  return `•••• •••• ${clean.slice(-4)}`;
}

/**
 * Render a high-resolution canvas receipt (Retina 2x resolution: 1200 x 1560)
 * strictly without remaining balances or sensitive credentials.
 */
export function generateReceiptCanvas(receipt: TransferReceipt): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const width = 1200;
  const height = 1560;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // Background
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, width, height);

  // Outer container card
  const pad = 60;
  const cardW = width - pad * 2;
  const cardH = height - pad * 2;
  const radius = 32;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, cardW, cardH, radius);
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 20;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#E2E8F0';
  ctx.stroke();
  ctx.restore();

  // Top header bar (Aurelith Reserve Navy)
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pad, pad, cardW, 200, [radius, radius, 0, 0]);
  ctx.fillStyle = '#1C2B4C';
  ctx.fill();

  // Red accent line under header
  ctx.fillStyle = '#C8102E';
  ctx.fillRect(pad, pad + 200 - 6, cardW, 6);

  // Crest Emblem / Monogram
  const emblemX = pad + 60;
  const emblemY = pad + 100;
  ctx.beginPath();
  ctx.arc(emblemX, emblemY, 36, 0, Math.PI * 2);
  ctx.fillStyle = '#2A3F6D';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#D4AF37';
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 28px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('AR', emblemX, emblemY);

  // Brand Titles
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('AURELITH RESERVE', emblemX + 54, emblemY - 10);

  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('PRIVATE BANKING & DIGITAL TREASURY • AUTHORIZED CLEARING', emblemX + 54, emblemY + 22);

  // Status Badge in Header (Right aligned)
  const badgeW = 210;
  const badgeH = 50;
  const badgeX = pad + cardW - badgeW - 60;
  const badgeY = emblemY - 25;

  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 25);
  ctx.fillStyle = '#10B981';
  ctx.fill();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SENT • CONFIRMED', badgeX + badgeW / 2, badgeY + badgeH / 2);
  ctx.restore();

  // Content Area
  let y = pad + 260;

  // Title: Official Transfer Receipt
  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('OFFICIAL ELECTRONIC WIRE & SETTLEMENT RECEIPT', width / 2, y);

  y += 55;
  // Large Amount Display
  ctx.fillStyle = '#1C2B4C';
  ctx.font = '800 64px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`$${receipt.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`, width / 2, y);

  y += 35;
  ctx.fillStyle = '#10B981';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText('Transaction Successfully Authorized & Dispatched', width / 2, y);

  y += 45;
  // Divider
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pad + 60, y);
  ctx.lineTo(pad + cardW - 60, y);
  ctx.stroke();

  y += 40;

  // Details Table
  const tableData: Array<[string, string, boolean?]> = [
    ['Transaction Reference', receipt.reference, true],
    ['Settlement Status', 'Sent • Settled via Interbank Network', true],
    ['Date & Time', new Date(receipt.timestamp).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'medium' })],
    ['Funding Account', `${receipt.sourceAccountName} (${maskAccountNumber(receipt.sourceAccountNumber)})`],
    ['Recipient Bank', receipt.recipientBank || 'Aurelith Reserve'],
    ['Verified Recipient', receipt.recipientName, true],
    ['Recipient Account', maskAccountNumber(receipt.recipientAccountNumber)],
  ];

  if (receipt.routingNumber) {
    tableData.push(['Routing Number (ABA)', receipt.routingNumber]);
  }
  if (receipt.swiftCode) {
    tableData.push(['SWIFT / BIC Code', receipt.swiftCode]);
  }
  if (receipt.paymentReference) {
    tableData.push(['Payment Reference', receipt.paymentReference]);
  }
  const actualFee = receipt.fee ?? Number((receipt.amount * 0.001).toFixed(2));
  const totalDebited = Number((receipt.amount + actualFee).toFixed(2));
  tableData.push(['Transfer Fee (0.1%)', `$${actualFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`]);
  tableData.push(['Total Amount Debited', `$${totalDebited.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`, true]);

  const leftX = pad + 70;
  const rightX = pad + cardW - 70;
  const rowH = 46;

  tableData.forEach(([label, value, isBold], idx) => {
    // Alternating row background
    if (idx % 2 === 0) {
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.roundRect(leftX - 12, y - 28, cardW - 116, rowH, 8);
      ctx.fill();
    }

    // Label
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748B';
    ctx.font = '500 17px sans-serif';
    ctx.fillText(label, leftX, y);

    // Value
    ctx.textAlign = 'right';
    if (label === 'Total Amount Debited') {
      ctx.fillStyle = '#C8102E';
      ctx.font = 'bold 20px monospace';
    } else if (label === 'Settlement Status') {
      ctx.fillStyle = '#10B981';
      ctx.font = 'bold 18px sans-serif';
    } else if (isBold) {
      ctx.fillStyle = '#1C2B4C';
      ctx.font = 'bold 18px sans-serif';
    } else {
      ctx.fillStyle = '#1E293B';
      ctx.font = '500 17px sans-serif';
    }
    ctx.fillText(value, rightX, y);

    y += rowH;
  });

  // Footer / Security Seal Notice
  y = pad + cardH - 120;
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad + 60, y);
  ctx.lineTo(pad + cardW - 60, y);
  ctx.stroke();

  y += 35;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748B';
  ctx.font = '13px sans-serif';
  ctx.fillText(
    'This non-negotiable electronic document certifies that the above funds transfer was authorized and debited.',
    width / 2,
    y
  );

  y += 24;
  ctx.fillStyle = '#94A3B8';
  ctx.font = '12px sans-serif';
  ctx.fillText(
    `Aurelith Reserve Private Banking • Member FDIC • Routing: 111301122 • Generated: ${new Date().toISOString()}`,
    width / 2,
    y
  );

  return canvas;
}

/**
 * Convert receipt canvas to a PNG Blob
 */
export function generateReceiptBlob(receipt: TransferReceipt): Promise<Blob> {
  const canvas = generateReceiptCanvas(receipt);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to generate receipt image blob.'));
      }
    }, 'image/png', 0.95);
  });
}

/**
 * Generate high-quality PDF Receipt using jsPDF
 */
export function generateReceiptPdf(receipt: TransferReceipt): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 18;

  // 1. TOP BRAND LETTERHEAD
  doc.setFillColor(28, 43, 76); // #1C2B4C
  doc.rect(0, 0, pageWidth, 5, 'F');

  doc.setFillColor(200, 16, 46); // #C8102E
  doc.rect(0, 5, pageWidth, 1.5, 'F');

  // Title
  doc.setTextColor(28, 43, 76);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('AURELITH RESERVE', margin, 20);

  doc.setTextColor(200, 16, 46);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('PRIVATE BANKING & DIGITAL TREASURY', margin, 25);

  // Address right aligned
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('400 Crescent Court, Suite 400', pageWidth - margin, 18, { align: 'right' });
  doc.text('Dallas, Texas 75201', pageWidth - margin, 22, { align: 'right' });
  doc.text('Member FDIC • Equal Housing Lender', pageWidth - margin, 26, { align: 'right' });

  // Divider
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, 31, pageWidth - margin, 31);

  // Status Banner
  doc.setFillColor(240, 253, 244); // light green
  doc.roundedRect(margin, 36, pageWidth - margin * 2, 22, 3, 3, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(margin, 36, pageWidth - margin * 2, 22, 3, 3, 'D');

  doc.setTextColor(22, 101, 52);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TRANSFER STATUS: SENT • COMPLETED', margin + 8, 45);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Reference: ${receipt.reference}  •  Settlement Date: ${new Date(receipt.timestamp).toLocaleString()}`, margin + 8, 52);

  // Table Data
  const rows: Array<[string, string]> = [
    ['Transaction Reference', receipt.reference],
    ['Funding Account', `${receipt.sourceAccountName} (${maskAccountNumber(receipt.sourceAccountNumber)})`],
    ['Recipient Financial Institution', receipt.recipientBank || 'Aurelith Reserve'],
    ['Verified Recipient Name', receipt.recipientName],
    ['Recipient Account Number', maskAccountNumber(receipt.recipientAccountNumber)],
  ];

  if (receipt.routingNumber) {
    rows.push(['Routing Transit Number (ABA)', receipt.routingNumber]);
  }
  if (receipt.swiftCode) {
    rows.push(['SWIFT / BIC Wire Code', receipt.swiftCode]);
  }
  if (receipt.paymentReference) {
    rows.push(['Payment Reference / Narration', receipt.paymentReference]);
  }
  const pdfFee = receipt.fee ?? Number((receipt.amount * 0.001).toFixed(2));
  const pdfTotal = Number((receipt.amount + pdfFee).toFixed(2));
  rows.push(['Transfer Amount', `$${receipt.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`]);
  rows.push(['Transfer Fee (0.1%)', `$${pdfFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`]);
  rows.push(['Total Debited Amount', `$${pdfTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`]);

  autoTable(doc, {
    startY: 64,
    margin: { left: margin, right: margin },
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3.5,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [28, 43, 76],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70, textColor: [71, 85, 105] },
      1: { fontStyle: 'bold', textColor: [15, 23, 42] },
    },
    body: rows,
  });

  // Footer certification
  const finalY = (doc as any).lastAutoTable.finalY + 14;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'This electronic receipt certifies that the above funds transfer was authorized and executed through authorized clearing channels.',
    pageWidth / 2,
    finalY,
    { align: 'center', maxWidth: pageWidth - margin * 2 }
  );

  doc.setFontSize(7.5);
  doc.text(
    'Aurelith Reserve Private Banking • Confidential Financial Record • No Private Balances Disclosed',
    pageWidth / 2,
    finalY + 6,
    { align: 'center' }
  );

  return doc;
}

/**
 * Share Receipt with Web Share API and automatic file download fallback
 */
export async function shareReceipt(receipt: TransferReceipt): Promise<{ shared: boolean; downloadedFallback: boolean }> {
  try {
    const blob = await generateReceiptBlob(receipt);
    const fileName = `Aurelith_Reserve_Receipt_${receipt.reference}.png`;
    const file = new File([blob], fileName, { type: 'image/png' });

    // Try Web Share API with files
    if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: 'Aurelith Reserve Transfer Receipt',
        text: `Official transfer receipt for ${receipt.recipientName} (${receipt.reference})`,
        files: [file],
      });
      return { shared: true, downloadedFallback: false };
    }
  } catch (shareErr: any) {
    // If user cancelled, don't fallback to download
    if (shareErr.name === 'AbortError') {
      return { shared: false, downloadedFallback: false };
    }
  }

  // Fallback to downloading image
  try {
    await saveReceiptImage(receipt);
    return { shared: false, downloadedFallback: true };
  } catch {
    return { shared: false, downloadedFallback: false };
  }
}

/**
 * Download Receipt as High-Res PNG Image
 */
export async function saveReceiptImage(receipt: TransferReceipt): Promise<void> {
  const blob = await generateReceiptBlob(receipt);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Aurelith_Reserve_Receipt_${receipt.reference}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Download Receipt as Executive PDF
 */
export function saveReceiptPdf(receipt: TransferReceipt): void {
  const pdf = generateReceiptPdf(receipt);
  pdf.save(`Aurelith_Reserve_Receipt_${receipt.reference}.pdf`);
}

/**
 * Share Receipt details via WhatsApp
 */
export function shareViaWhatsApp(receipt: TransferReceipt): void {
  const actualFee = receipt.fee ?? Number((receipt.amount * 0.001).toFixed(2));
  const totalDebited = Number((receipt.amount + actualFee).toFixed(2));
  const text =
    `*AURELITH RESERVE — OFFICIAL WIRE & TRANSFER RECEIPT*\n\n` +
    `*Status:* SENT • COMPLETED\n` +
    `*Reference:* ${receipt.reference}\n` +
    `*Date:* ${new Date(receipt.timestamp).toLocaleString()}\n` +
    `*Funding Account:* ${maskAccountNumber(receipt.sourceAccountNumber)}\n` +
    `*Recipient:* ${receipt.recipientName}\n` +
    `*Recipient Bank:* ${receipt.recipientBank || 'Aurelith Reserve'}\n` +
    `*Account Number:* ${maskAccountNumber(receipt.recipientAccountNumber)}\n` +
    (receipt.routingNumber ? `*Routing (ABA):* ${receipt.routingNumber}\n` : '') +
    (receipt.swiftCode ? `*SWIFT / BIC:* ${receipt.swiftCode}\n` : '') +
    (receipt.paymentReference ? `*Payment Ref:* ${receipt.paymentReference}\n` : '') +
    `*Transfer Amount:* $${receipt.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD\n` +
    `*Transfer Fee (0.1%):* $${actualFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD\n` +
    `*Total Debited:* $${totalDebited.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD\n\n` +
    `_This electronic receipt certifies that the above funds transfer was authorized and debited via authorized clearing channels._`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
