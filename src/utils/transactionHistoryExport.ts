import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BankTransaction } from '../types/banking';

export function formatUtcDateTime(isoString: string): { dateStr: string; timeStr: string; combined: string } {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) {
      const clean = (isoString || '').slice(0, 10);
      return { dateStr: clean, timeStr: '', combined: clean };
    }
    const dateStr = d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
    const timeStr = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
    return { dateStr, timeStr, combined: `${dateStr} ${timeStr}` };
  } catch {
    const fallback = (isoString || '').slice(0, 10);
    return { dateStr: fallback, timeStr: '', combined: fallback };
  }
}

/**
 * Export filtered transactions to CSV per strict guidelines:
 * Columns: Date, Reference, Type, Description, Counterparty, Amount, Fee, Status
 * Strictly omits account balances or remaining balance.
 */
export function exportTransactionsCsv(transactions: BankTransaction[], filename?: string): void {
  const headers = ['Date,Reference,Type,Description,Counterparty,Amount,Fee,Status\n'];
  const rows = transactions.map((t) => {
    const isCredit = t.direction === 'credit';
    const counterparty = isCredit
      ? (t.senderName || '') + (t.senderBank ? ` (${t.senderBank})` : '')
      : (t.recipientName || '') + (t.recipientBank ? ` (${t.recipientBank})` : '');
    const typeLabel = isCredit ? 'Credit' : 'Debit';
    const amountStr = `${isCredit ? '+' : '-'}${t.amount.toFixed(2)}`;
    const feeStr = (t.fee && t.fee > 0 ? t.fee.toFixed(2) : '0.00');
    const { combined: dateStr } = formatUtcDateTime(t.timestamp);

    const escapeCsv = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;

    return `${escapeCsv(dateStr)},${escapeCsv(t.reference)},${escapeCsv(typeLabel)},${escapeCsv(
      t.description
    )},${escapeCsv(counterparty)},${escapeCsv(amountStr)},${escapeCsv(feeStr)},${escapeCsv(t.status)}\n`;
  });

  const blob = new Blob([...headers, ...rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `Aurelith_Reserve_Transaction_History_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Export filtered transactions to a branded Aurelith Reserve PDF.
 * Columns: Date & Time, Description, Sender / Recipient, Type, Amount, Fee, Reference, Status
 * Strictly omits account balances or remaining balance per privacy guidelines.
 */
export function exportTransactionsPdf(
  transactions: BankTransaction[],
  reportingPeriod: string,
  userFullName?: string
): void {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // 1. TOP BRAND LETTERHEAD
  // Navy background top bar accent
  doc.setFillColor(28, 43, 76); // #1C2B4C
  doc.rect(0, 0, pageWidth, 5, 'F');

  // Red accent line
  doc.setFillColor(200, 16, 46); // #C8102E
  doc.rect(0, 5, pageWidth, 1.2, 'F');

  // Emblem (drawn geometrically)
  doc.setFillColor(200, 16, 46);
  doc.triangle(margin, 12, margin + 5, 12, margin + 2.5, 23, 'F');
  doc.setFillColor(28, 43, 76);
  doc.triangle(margin + 3, 12, margin + 8, 12, margin + 5.5, 23, 'F');

  // Bank Title
  doc.setTextColor(28, 43, 76);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('AURELITH RESERVE', margin + 11, 16);

  doc.setTextColor(200, 16, 46);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text('WEALTH MANAGEMENT & BANKING SERVICES', margin + 11, 20);

  // Bank Coordinates (Right aligned)
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(90, 100, 115);
  doc.text('400 Pine Street, Headquarters', pageWidth - margin, 13, { align: 'right' });
  doc.text('Dallas, Texas 75201', pageWidth - margin, 17, { align: 'right' });
  doc.text('Routing / Transit: 111301122  •  SWIFT: AURUS33D', pageWidth - margin, 21, { align: 'right' });
  doc.text('Member FDIC  •  Equal Housing Lender', pageWidth - margin, 25, { align: 'right' });

  // Divider
  doc.setDrawColor(220, 226, 235);
  doc.setLineWidth(0.4);
  doc.line(margin, 28, pageWidth - margin, 28);

  // 2. DOCUMENT TITLE & METADATA
  doc.setTextColor(28, 43, 76);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('OFFICIAL TRANSACTION HISTORY REPORT', margin, 35);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);

  const genDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  doc.text(`Report Generation Date: ${genDate}`, margin, 40);
  doc.text(`Reporting Period: ${reportingPeriod}`, margin, 44);
  doc.text(`Total Filtered Records: ${transactions.length}`, margin, 48);

  if (userFullName) {
    doc.text(`Account Holder: ${userFullName}`, pageWidth - margin, 40, { align: 'right' });
    doc.text('Confidential Banking Record', pageWidth - margin, 44, { align: 'right' });
  }

  // 3. TRANSACTION TABLE
  // Columns: Date & Time, Description, Sender / Recipient, Type, Amount, Fee, Reference, Status
  const tableData = transactions.map((t) => {
    const isCredit = t.direction === 'credit';
    const counterparty = isCredit
      ? (t.senderName || '') + (t.senderBank ? `\n(${t.senderBank})` : '')
      : (t.recipientName || '') + (t.recipientBank ? `\n(${t.recipientBank})` : '');
    const { combined: dateStr } = formatUtcDateTime(t.timestamp);
    const typeLabel = isCredit ? 'Credit' : 'Debit';
    const amountStr = `${isCredit ? '+' : '-'}$${t.amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
    const feeStr = t.fee && t.fee > 0 ? `$${t.fee.toFixed(2)}` : '$0.00';

    return [
      dateStr,
      t.description || 'Account Transaction',
      counterparty || '—',
      typeLabel,
      amountStr,
      feeStr,
      t.reference,
      (t.status || 'COMPLETED').toUpperCase(),
    ];
  });

  autoTable(doc, {
    startY: 52,
    head: [['Date & Time', 'Description', 'Sender / Recipient', 'Type', 'Amount (USD)', 'Fee', 'Reference', 'Status']],
    body: tableData,
    theme: 'plain',
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [28, 43, 76],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 32 }, // Date & Time
      1: { cellWidth: 64 }, // Description
      2: { cellWidth: 54 }, // Sender / Recipient
      3: { cellWidth: 18, halign: 'center' }, // Type
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' }, // Amount
      5: { cellWidth: 16, halign: 'right' }, // Fee
      6: { cellWidth: 34, font: 'courier' }, // Reference
      7: { cellWidth: 23, halign: 'center' }, // Status
    },
    margin: { left: margin, right: margin, bottom: 20 },
    didDrawPage: (data) => {
      // Footer on every page
      const pageStr = `Page ${data.pageNumber}`;
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text(pageStr, pageWidth - margin, pageHeight - 8, { align: 'right' });
      doc.text(
        'Aurelith Reserve • Private Wealth Management • Confidential document intended solely for authorized recipient.',
        margin,
        pageHeight - 8
      );
    },
  });

  doc.save(`Aurelith_Reserve_Transaction_History_${new Date().toISOString().slice(0, 10)}.pdf`);
}
