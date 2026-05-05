// Shared invoice / quotation HTML template generator for mobile expo-print.
// Mirrors the 3 web templates (classic, modern_blue, tally_tax).

export interface DocItem {
  item_name?: string;
  description?: string | null;
  hsn_code?: string | null;
  unit?: string | null;
  qty?: number;
  rate?: number;
  discount_percent?: number;
  tax_rate?: number;
  amount?: number;
}

export interface DocBusiness {
  business_name?: string;
  business_logo?: string | null;
  address?: string | null;
  mobile?: string | null;
  email?: string | null;
  gst_number?: string | null;
  pan?: string | null;
}

export interface DocCustomer {
  contact_person?: string;
  business_name?: string | null;
  address?: string | null;
  mobile?: string | null;
  email?: string | null;
  gst_number?: string | null;
}

export interface DocSettings {
  invoice_title?: string;
  quote_title?: string;
  template?: string;
  header_logo?: string | null;
  font_family?: string;
  font_size?: string;
  footer_text?: string | null;
  signature_image?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_ifsc?: string | null;
  bank_branch?: string | null;
  qr_code_image?: string | null;
  terms_and_conditions?: string | null;
}

export interface DocPayment {
  payment_date?: string;
  amount?: number;
  payment_method?: string;
  reference_number?: string | null;
}

export interface DocData {
  // common
  status?: string;
  subtotal?: number;
  discount_type?: string | null;
  discount_value?: number;
  tax_amount?: number;
  total?: number;
  notes?: string | null;
  items?: DocItem[];
  customer_name?: string | null;
  // invoice
  invoice_number?: string;
  invoice_date?: string;
  due_date?: string | null;
  amount_paid?: number;
  balance_due?: number;
  freight_charges?: number;
  round_off?: number;
  // quotation
  quotation_number?: string;
  quotation_date?: string;
  valid_until?: string | null;
}

export interface BuildHtmlOptions {
  doc: DocData;
  business: DocBusiness | null;
  customer: DocCustomer | null;
  settings: DocSettings | null;
  payments?: DocPayment[];
  baseUrl: string;
  assetDir: 'invoice' | 'quotation';
  isQuotation?: boolean;
}

export function numberToWordsINR(num: number): string {
  if (!num || num === 0) return 'Rupees Zero Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const below1000 = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + below1000(n % 100) : '');
  };
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const rest = Math.floor(num % 1000);
  const paise = Math.round((num - Math.floor(num)) * 100);
  let words = '';
  if (crore) words += below1000(crore) + ' Crore ';
  if (lakh) words += below1000(lakh) + ' Lakh ';
  if (thousand) words += below1000(thousand) + ' Thousand ';
  if (rest) words += below1000(rest);
  words = 'Rupees ' + words.trim();
  if (paise) words += ' and ' + below1000(paise) + ' Paise';
  return words + ' Only';
}

const fmt = (n: number) => (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d?: string | null, short = false) => {
  if (!d) return '';
  const date = new Date(d);
  if (short) return date.toLocaleDateString('en-GB');
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const stateFromGST = (gst?: string | null) => {
  if (!gst || gst.length < 2) return '';
  const code = gst.substring(0, 2);
  const states: Record<string, string> = {
    '33': 'Tamil Nadu', '29': 'Karnataka', '27': 'Maharashtra', '07': 'Delhi', '06': 'Haryana',
    '09': 'Uttar Pradesh', '32': 'Kerala', '36': 'Telangana', '37': 'Andhra Pradesh', '24': 'Gujarat',
  };
  return states[code] ? `${states[code]}, Code : ${code}` : `Code : ${code}`;
};

function resolveCommon(opts: BuildHtmlOptions) {
  const { doc, business, settings, baseUrl, assetDir, isQuotation } = opts;
  const logoUrl = settings?.header_logo
    ? `${baseUrl}/assets/${assetDir}/${settings.header_logo}`
    : business?.business_logo ? `${baseUrl}/assets/logos/${business.business_logo}` : '';
  const fontFamily = settings?.font_family || 'Inter';
  const baseSize = settings?.font_size === 'small' ? 11 : settings?.font_size === 'large' ? 14 : 12;
  const title = isQuotation ? settings?.quote_title || 'Quotation' : settings?.invoice_title || 'Tax Invoice';
  const docNumber = doc.invoice_number || doc.quotation_number || '';
  const docDate = doc.invoice_date || doc.quotation_date || '';
  const docDue = doc.due_date || doc.valid_until || '';
  const halfTax = (doc.tax_amount || 0) / 2;
  const discAmt = doc.discount_type === 'percentage'
    ? (doc.subtotal || 0) * ((doc.discount_value || 0) / 100)
    : (doc.discount_value || 0);
  return { logoUrl, fontFamily, baseSize, title, docNumber, docDate, docDue, halfTax, discAmt };
}

// ============================================================
// CLASSIC TEMPLATE (default — current existing layout)
// ============================================================
function classicTemplate(opts: BuildHtmlOptions): string {
  const { doc, business, customer, settings, payments = [], baseUrl, assetDir, isQuotation } = opts;
  const { logoUrl, fontFamily, baseSize, title, docNumber, docDate, docDue, halfTax, discAmt } = resolveCommon(opts);

  const statusColor: Record<string, string> = {
    Paid: '#16a34a', Sent: '#2563eb', Draft: '#71717a', Overdue: '#dc2626',
    'Partially Paid': '#f59e0b', Cancelled: '#dc2626', Accepted: '#16a34a', Rejected: '#dc2626', Expired: '#71717a',
  };
  const sColor = statusColor[doc.status || ''] || '#71717a';

  const items = (doc.items || []).map((it, i) => `
    <tr>
      <td style="padding:9px 12px;border-bottom:1px solid #e4e4e7;color:#71717a">${i + 1}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e4e4e7;font-weight:500">${it.item_name || ''}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e4e4e7;color:#71717a">${it.description || '—'}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e4e4e7;font-family:monospace;font-size:11px">${it.hsn_code || '—'}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e4e4e7;text-align:right">${it.qty} ${it.unit || ''}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e4e4e7;text-align:right">₹${fmt(it.rate || 0)}</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e4e4e7;text-align:right">${it.discount_percent || 0}%</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e4e4e7;text-align:right">${it.tax_rate || 0}%</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e4e4e7;text-align:right;font-weight:500">₹${fmt(it.amount || 0)}</td>
    </tr>`).join('');

  const paymentRows = payments.map((p) => `
    <tr>
      <td style="padding:6px 0;border-bottom:1px dashed #e4e4e7">${fmtDate(p.payment_date)}</td>
      <td style="padding:6px 0;border-bottom:1px dashed #e4e4e7;text-align:right;color:#16a34a;font-weight:500">₹${fmt(p.amount || 0)}</td>
      <td style="padding:6px 0 6px 16px;border-bottom:1px dashed #e4e4e7">${p.payment_method || ''}</td>
      <td style="padding:6px 0 6px 16px;border-bottom:1px dashed #e4e4e7;color:#71717a">${p.reference_number || '—'}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box}
    body{font-family:'${fontFamily}',system-ui,sans-serif;margin:0;padding:24px;color:#18181b;font-size:${baseSize}px;line-height:1.5}
    .doc{max-width:780px;margin:0 auto}
    .row{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
    .biz-head{display:flex;align-items:center;gap:14px}
    .biz-head img{height:54px;width:54px;object-fit:contain;border:1px solid #e4e4e7;border-radius:8px}
    .biz-name{font-size:16px;font-weight:700;margin:0}
    .muted{color:#71717a;font-size:11px;margin:1px 0}
    .doc-title{font-size:22px;font-weight:700;color:#27272a;letter-spacing:1.5px;text-transform:uppercase;margin:0}
    .badge{display:inline-block;margin-top:6px;padding:3px 10px;border-radius:10px;font-size:10px;font-weight:600;color:#fff;background:${sColor}}
    .sep{height:1px;background:#e4e4e7;margin:18px 0}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:24px}
    .label{font-size:10px;font-weight:600;color:#71717a;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px}
    .info-card{display:inline-block;background:#fafafa;border:1px solid #e4e4e7;border-radius:8px;padding:10px 14px;text-align:left}
    .info-card p{margin:2px 0;font-size:11px}
    table.items{width:100%;border-collapse:separate;border-spacing:0;font-size:11px;margin-top:6px}
    table.items thead th{background:#18181b;color:#fff;padding:9px 12px;text-align:left;font-weight:500;font-size:11px}
    table.items thead th:first-child{border-top-left-radius:8px}
    table.items thead th:last-child{border-top-right-radius:8px}
    .sum-wrap{display:flex;justify-content:flex-end;margin-top:18px}
    .summary{width:300px}
    .sum-row{display:flex;justify-content:space-between;font-size:11px;padding:3px 0}
    .sum-row .lbl{color:#71717a}
    .sum-total{display:flex;justify-content:space-between;font-size:15px;font-weight:700;padding-top:8px;margin-top:6px;border-top:1px solid #e4e4e7}
    .words{font-size:10px;color:#71717a;font-style:italic;margin-top:4px}
    .pay-row-green{color:#16a34a}
    .pay-row-red{color:#dc2626;font-weight:700;font-size:13px}
    .notes{white-space:pre-wrap;color:#71717a;font-size:11px}
    .pay-table{width:100%;border-collapse:collapse;font-size:11px;margin-top:6px}
    .pay-table th{text-align:left;padding:6px 0;border-bottom:1px solid #e4e4e7;font-weight:500;color:#71717a;font-size:11px}
    .pay-table th.right{text-align:right}
    .qr{height:96px;width:96px;object-fit:contain;border:1px solid #e4e4e7;border-radius:6px}
    .sig{height:60px;object-fit:contain}
    .footer{text-align:center;font-size:9px;color:#71717a}
    @media print{body{padding:0}@page{margin:10mm}}
  </style></head><body><div class="doc">
    <div class="row">
      <div class="biz-head">
        ${logoUrl ? `<img src="${logoUrl}" alt=""/>` : ''}
        <div>
          <h2 class="biz-name">${business?.business_name || ''}</h2>
          ${business?.address ? `<p class="muted">${business.address}</p>` : ''}
          ${business?.mobile ? `<p class="muted">Tel: ${business.mobile}</p>` : ''}
          ${business?.email ? `<p class="muted">${business.email}</p>` : ''}
        </div>
      </div>
      <div style="text-align:right">
        <h1 class="doc-title">${title}</h1>
        <span class="badge">${doc.status || ''}</span>
      </div>
    </div>

    ${(business?.gst_number || business?.pan) ? `
    <div class="grid2" style="margin-top:14px">
      <div>
        ${business?.gst_number ? `<p class="muted" style="font-size:11px"><strong style="color:#27272a">GSTIN:</strong> ${business.gst_number}</p>` : ''}
        ${business?.pan ? `<p class="muted" style="font-size:11px"><strong style="color:#27272a">PAN:</strong> ${business.pan}</p>` : ''}
      </div><div></div>
    </div>` : ''}

    <div class="sep"></div>

    <div class="grid2">
      <div>
        <p class="label">Bill To</p>
        <p style="font-weight:600;margin:0 0 2px">${customer?.business_name || customer?.contact_person || doc.customer_name || ''}</p>
        ${customer?.business_name && customer?.contact_person ? `<p class="muted">${customer.contact_person}</p>` : ''}
        ${customer?.address ? `<p class="muted">${customer.address}</p>` : ''}
        ${customer?.mobile ? `<p class="muted">Tel: ${customer.mobile}</p>` : ''}
        ${customer?.gst_number ? `<p class="muted"><strong style="color:#27272a">GSTIN:</strong> ${customer.gst_number}</p>` : ''}
      </div>
      <div style="text-align:right">
        <div class="info-card">
          <p><strong>${isQuotation ? 'Quote No' : 'Invoice No'}:</strong> ${docNumber}</p>
          <p><strong>Date:</strong> ${fmtDate(docDate)}</p>
          ${docDue ? `<p><strong>${isQuotation ? 'Valid Until' : 'Due Date'}:</strong> ${fmtDate(docDue)}</p>` : ''}
        </div>
      </div>
    </div>

    <table class="items" style="margin-top:18px">
      <thead><tr>
        <th style="width:32px">#</th><th>Item</th><th>Description</th>
        <th style="width:70px">HSN</th>
        <th style="text-align:right;width:60px">Qty</th>
        <th style="text-align:right;width:80px">Rate</th>
        <th style="text-align:right;width:60px">Disc%</th>
        <th style="text-align:right;width:60px">Tax%</th>
        <th style="text-align:right;width:90px">Amount</th>
      </tr></thead>
      <tbody>${items}</tbody>
    </table>

    <div class="sum-wrap"><div class="summary">
      <div class="sum-row"><span class="lbl">Subtotal</span><span>₹${fmt(doc.subtotal || 0)}</span></div>
      ${discAmt > 0 ? `<div class="sum-row"><span class="lbl">Discount${doc.discount_type === 'percentage' ? ` (${doc.discount_value}%)` : ''}</span><span style="color:#dc2626">-₹${fmt(discAmt)}</span></div>` : ''}
      ${(doc.tax_amount || 0) > 0 ? `<div class="sum-row"><span class="lbl">CGST</span><span>₹${fmt(halfTax)}</span></div><div class="sum-row"><span class="lbl">SGST</span><span>₹${fmt(halfTax)}</span></div>` : ''}
      ${(doc.freight_charges || 0) > 0 ? `<div class="sum-row"><span class="lbl">Freight Charges</span><span>₹${fmt(doc.freight_charges || 0)}</span></div>` : ''}
      ${Math.abs(doc.round_off || 0) > 0 ? `<div class="sum-row"><span class="lbl">Round Off</span><span${(doc.round_off || 0) < 0 ? ' style="color:#dc2626"' : ''}>${(doc.round_off || 0) >= 0 ? '+' : '−'}₹${fmt(Math.abs(doc.round_off || 0))}</span></div>` : ''}
      <div class="sum-total"><span>Total</span><span>₹${fmt(doc.total || 0)}</span></div>
      <p class="words">${numberToWordsINR(doc.total || 0)}</p>
      ${!isQuotation && (doc.amount_paid || 0) > 0 ? `
        <div class="sum-row pay-row-green"><span>Amount Paid</span><span>₹${fmt(doc.amount_paid || 0)}</span></div>
        <div class="sum-row pay-row-red"><span>Balance Due</span><span>₹${fmt(doc.balance_due || 0)}</span></div>` : ''}
    </div></div>

    ${doc.notes ? `<div style="margin-top:18px"><p class="label">Notes</p><p class="notes">${doc.notes}</p></div>` : ''}

    ${payments.length > 0 ? `
      <div class="sep"></div>
      <p class="label">Payment History</p>
      <table class="pay-table">
        <thead><tr><th>Date</th><th class="right">Amount</th><th style="padding-left:16px">Method</th><th style="padding-left:16px">Reference</th></tr></thead>
        <tbody>${paymentRows}</tbody>
      </table>` : ''}

    ${(settings?.bank_name || settings?.qr_code_image) ? `
      <div class="sep"></div>
      <div class="grid2">
        ${settings?.bank_name ? `
          <div>
            <p class="label">Bank Details</p>
            <p style="font-size:11px;margin:1px 0"><strong>Bank:</strong> ${settings.bank_name}</p>
            ${settings.bank_account ? `<p style="font-size:11px;margin:1px 0"><strong>A/C No:</strong> ${settings.bank_account}</p>` : ''}
            ${settings.bank_ifsc ? `<p style="font-size:11px;margin:1px 0"><strong>IFSC:</strong> ${settings.bank_ifsc}</p>` : ''}
            ${settings.bank_branch ? `<p style="font-size:11px;margin:1px 0"><strong>Branch:</strong> ${settings.bank_branch}</p>` : ''}
          </div>` : '<div></div>'}
        ${settings?.qr_code_image ? `<div style="text-align:right"><img class="qr" src="${baseUrl}/assets/${assetDir}/${settings.qr_code_image}" alt="QR"/></div>` : '<div></div>'}
      </div>` : ''}

    ${settings?.terms_and_conditions ? `
      <div class="sep"></div>
      <p class="label">Terms & Conditions</p>
      <p class="notes">${settings.terms_and_conditions}</p>` : ''}

    ${settings?.signature_image ? `
      <div style="display:flex;justify-content:flex-end;margin-top:24px">
        <div style="text-align:center">
          <img class="sig" src="${baseUrl}/assets/${assetDir}/${settings.signature_image}" alt=""/>
          <p class="muted" style="margin-top:4px">Authorized Signature</p>
        </div>
      </div>` : ''}

    ${settings?.footer_text ? `<div class="sep"></div><p class="footer">${settings.footer_text}</p>` : ''}
  </div></body></html>`;
}

// ============================================================
// MODERN BLUE TEMPLATE (right-aligned blue title, info badges, blue wave footer)
// ============================================================
function modernBlueTemplate(opts: BuildHtmlOptions): string {
  const { doc, business, customer, settings, baseUrl, assetDir, isQuotation } = opts;
  const { logoUrl, fontFamily, baseSize, title, docNumber, docDate, halfTax, discAmt } = resolveCommon(opts);
  const BLUE = '#2596d4';
  const greeting = customer?.contact_person || customer?.business_name || '';
  const docType = isQuotation ? 'quotation' : 'invoice';
  const numberLabel = isQuotation ? 'Quotation No.' : 'Invoice No.';

  const items = (doc.items || []).map((it, i) => `
    <tr style="border-bottom:1px solid #e4e4e7">
      <td style="padding:10px 8px">${i + 1}</td>
      <td style="padding:10px 8px">
        <div style="font-weight:500">${it.item_name || ''}</div>
        ${it.description ? `<div style="font-size:11px;color:#71717a">${it.description}</div>` : ''}
      </td>
      <td style="padding:10px 8px;text-align:right;color:#52525b">${it.qty || 0} ${it.unit || ''}</td>
      <td style="padding:10px 8px;text-align:right;color:#52525b">${fmt(it.rate || 0)}</td>
      <td style="padding:10px 8px;text-align:right">${fmt(it.amount || 0)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box}
    body{font-family:'${fontFamily}',system-ui,sans-serif;margin:0;color:#18181b;font-size:${baseSize}px;line-height:1.5;background:#fff}
    .page{position:relative;min-height:1100px;padding:32px 40px 140px}
    .head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px}
    .logo{height:80px;width:80px;object-fit:contain}
    .logo-fallback{height:80px;width:80px;background:${BLUE};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700}
    .title{font-size:30px;font-weight:700;color:${BLUE};margin:0 0 8px}
    .biz-name{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin:0;color:#18181b}
    .biz-info{font-size:11px;color:#3f3f46;margin:1px 0}
    .info-row{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-top:18px}
    .bill-card{border:1px solid #e4e4e7;border-radius:8px;padding:14px 18px;flex:1;max-width:420px}
    .bill-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#71717a;margin:0 0 6px}
    .bill-name{font-weight:700;font-size:13px;margin:0 0 2px}
    .bill-line{font-size:11px;color:#52525b;margin:1px 0}
    .pill{border:1px solid #e4e4e7;border-radius:999px;padding:6px 16px;font-size:11px;display:block;margin-bottom:8px;white-space:nowrap}
    .pill-key{color:#52525b}
    .pill-val{font-weight:700;color:#18181b}
    .greet{margin-top:16px}
    .greet p{margin:2px 0;font-size:12px;color:#3f3f46}
    table.items{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
    table.items thead tr{border-top:2px solid ${BLUE};border-bottom:2px solid ${BLUE}}
    table.items thead th{padding:9px 8px;text-align:left;font-weight:700;color:#18181b}
    .sum-wrap{display:flex;justify-content:flex-end;margin-top:14px}
    .summary{width:300px;font-size:12px}
    .sum-row{display:flex;justify-content:space-between;padding:3px 0}
    .sum-row .lbl{color:#52525b}
    .grand{display:flex;justify-content:space-between;font-weight:700;font-size:16px;padding-top:8px;margin-top:6px;border-top:2px solid ${BLUE}}
    .grand .val{color:${BLUE}}
    .words{font-size:10px;color:#52525b;font-style:italic;margin-top:6px}
    .bank-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px;padding-top:14px;border-top:1px solid #e4e4e7}
    .bank-label{font-size:10px;font-weight:700;text-transform:uppercase;color:#71717a;margin-bottom:4px}
    .bank-line{font-size:11px;margin:1px 0;color:#3f3f46}
    .qr{height:96px;width:96px;object-fit:contain;justify-self:end}
    .sig-wrap{display:flex;justify-content:flex-end;margin-top:24px}
    .sig{height:56px;object-fit:contain;display:block;margin:0 auto}
    .sig-cap{font-size:10px;color:#52525b;text-align:center;margin-top:4px}
    .wave-wrap{position:absolute;bottom:0;left:0;right:0}
    .wave-text{text-align:center;padding:4px 32px 12px;font-size:10px;color:#52525b}
    @media print{body{padding:0}@page{margin:0}}
  </style></head><body><div class="page">
    <div class="head">
      <div>${logoUrl ? `<img class="logo" src="${logoUrl}" alt=""/>` : `<div class="logo-fallback">${(business?.business_name || '?').charAt(0)}</div>`}</div>
      <div style="text-align:right;flex:1">
        <h1 class="title">${title}</h1>
        <h2 class="biz-name">${business?.business_name || ''}</h2>
        ${business?.gst_number ? `<p class="biz-info">${business.gst_number}</p>` : ''}
        ${business?.address ? `<p class="biz-info">${business.address}</p>` : ''}
        ${business?.mobile ? `<p class="biz-info">Mobile: ${business.mobile}</p>` : ''}
        ${business?.email ? `<p class="biz-info">Email: ${business.email}</p>` : ''}
      </div>
    </div>

    <div class="info-row">
      <div class="bill-card">
        <p class="bill-label">Bill To</p>
        <p class="bill-name">${customer?.business_name || customer?.contact_person || doc.customer_name || ''}</p>
        ${customer?.business_name && customer?.contact_person ? `<p class="bill-line">${customer.contact_person}</p>` : ''}
        ${customer?.address ? `<p class="bill-line">${customer.address}</p>` : ''}
        ${customer?.mobile ? `<p class="bill-line">Tel: ${customer.mobile}</p>` : ''}
        ${customer?.gst_number ? `<p class="bill-line">GSTIN: ${customer.gst_number}</p>` : ''}
      </div>
      <div>
        <span class="pill"><span class="pill-key">Date: </span><span class="pill-val">${fmtDate(docDate, true)}</span></span>
        <span class="pill"><span class="pill-key">${numberLabel} </span><span class="pill-val">${docNumber}</span></span>
        <span class="pill"><span class="pill-key">Grand Total: </span><span class="pill-val">₹ ${fmt(doc.total || 0)}</span></span>
      </div>
    </div>

    <div class="greet">
      ${greeting ? `<p>Dear ${greeting},</p>` : ''}
      <p>Please find below a cost-breakdown for the ${docType}. Please consider this ${docType}, and do not hesitate to contact me with any question.</p>
      <p style="margin-top:8px">Many thanks,</p>
      <p style="font-weight:700;text-transform:uppercase;color:#18181b">${business?.business_name || ''}</p>
    </div>

    <table class="items">
      <thead><tr>
        <th style="width:36px">S.No.</th><th>Item Details</th>
        <th style="text-align:right;width:80px">Quantity</th>
        <th style="text-align:right;width:80px">Price</th>
        <th style="text-align:right;width:90px">Total</th>
      </tr></thead>
      <tbody>${items}</tbody>
    </table>

    <div class="sum-wrap"><div class="summary">
      <div class="sum-row"><span class="lbl">Subtotal</span><span>₹${fmt(doc.subtotal || 0)}</span></div>
      ${discAmt > 0 ? `<div class="sum-row"><span class="lbl">Discount${doc.discount_type === 'percentage' ? ` (${doc.discount_value}%)` : ''}</span><span style="color:#dc2626">-₹${fmt(discAmt)}</span></div>` : ''}
      ${(doc.tax_amount || 0) > 0 ? `<div class="sum-row"><span class="lbl">CGST</span><span>₹${fmt(halfTax)}</span></div><div class="sum-row"><span class="lbl">SGST</span><span>₹${fmt(halfTax)}</span></div>` : ''}
      <div class="grand"><span>Grand Total</span><span class="val">₹${fmt(doc.total || 0)}</span></div>
      <p class="words">${numberToWordsINR(doc.total || 0)}</p>
      ${!isQuotation && (doc.amount_paid || 0) > 0 ? `
        <div class="sum-row" style="color:#16a34a"><span>Amount Paid</span><span>₹${fmt(doc.amount_paid || 0)}</span></div>
        <div class="sum-row" style="color:#dc2626;font-weight:700"><span>Balance Due</span><span>₹${fmt(doc.balance_due || 0)}</span></div>` : ''}
    </div></div>

    ${(settings?.bank_name || settings?.qr_code_image) ? `
      <div class="bank-grid">
        <div>
          ${settings?.bank_name ? `
            <div class="bank-label">Bank Details</div>
            <div class="bank-line"><strong>Bank:</strong> ${settings.bank_name}</div>
            ${settings.bank_account ? `<div class="bank-line"><strong>A/C:</strong> ${settings.bank_account}</div>` : ''}
            ${settings.bank_ifsc ? `<div class="bank-line"><strong>IFSC:</strong> ${settings.bank_ifsc}</div>` : ''}
            ${settings.bank_branch ? `<div class="bank-line"><strong>Branch:</strong> ${settings.bank_branch}</div>` : ''}` : ''}
        </div>
        ${settings?.qr_code_image ? `<img class="qr" src="${baseUrl}/assets/${assetDir}/${settings.qr_code_image}" alt=""/>` : '<div></div>'}
      </div>` : ''}

    ${doc.notes ? `<div style="margin-top:14px"><div class="bank-label">Notes</div><div style="font-size:11px;color:#3f3f46;white-space:pre-wrap">${doc.notes}</div></div>` : ''}
    ${settings?.terms_and_conditions ? `<div style="margin-top:14px"><div class="bank-label">Terms & Conditions</div><div style="font-size:11px;color:#3f3f46;white-space:pre-wrap">${settings.terms_and_conditions}</div></div>` : ''}

    ${settings?.signature_image ? `
      <div class="sig-wrap"><div>
        <img class="sig" src="${baseUrl}/assets/${assetDir}/${settings.signature_image}" alt=""/>
        <div class="sig-cap">Authorized Signature</div>
      </div></div>` : ''}

    <div class="wave-wrap">
      <div class="wave-text">${settings?.footer_text || `This is a computer generated ${docType}`} &nbsp;·&nbsp; Page 1 of 1</div>
      <svg viewBox="0 0 600 60" preserveAspectRatio="none" style="width:100%;height:48px;display:block">
        <path d="M0,40 Q150,0 300,30 T600,20 L600,60 L0,60 Z" fill="${BLUE}" opacity="0.85"/>
        <path d="M0,50 Q150,20 300,40 T600,35 L600,60 L0,60 Z" fill="${BLUE}"/>
      </svg>
    </div>
  </div></body></html>`;
}

// ============================================================
// TALLY TAX TEMPLATE (bordered Tally-style GST tax invoice)
// ============================================================
function tallyTaxTemplate(opts: BuildHtmlOptions): string {
  const { doc, business, customer, settings, baseUrl, assetDir, isQuotation } = opts;
  const { logoUrl, fontFamily, baseSize, title, docNumber, docDate, docDue, halfTax } = resolveCommon(opts);
  const itemsCount = (doc.items || []).reduce((s, i) => s + (i.qty || 0), 0);
  const firstUnit = doc.items?.[0]?.unit || 'No';

  const items = (doc.items || []).map((it, i) => `
    <tr>
      <td class="cell" style="text-align:center">${i + 1}</td>
      <td class="cell">
        <div style="font-weight:700">${it.item_name || ''}</div>
        ${it.description ? `<div>${it.description}</div>` : ''}
      </td>
      <td class="cell" style="text-align:center">${it.hsn_code || ''}</td>
      <td class="cell" style="text-align:center">${it.qty || 0} ${it.unit || 'No'}</td>
      <td class="cell" style="text-align:right">${fmt(it.rate || 0)}</td>
      <td class="cell" style="text-align:center">${it.unit || 'No'}</td>
      <td class="cell" style="text-align:right">${fmt(it.amount || 0)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box}
    body{font-family:'${fontFamily}',system-ui,sans-serif;margin:0;padding:24px;color:#18181b;font-size:${Math.max(baseSize - 1, 10)}px;line-height:1.4}
    .title{text-align:center;font-weight:700;font-size:14px;padding-bottom:4px}
    table.frame{width:100%;border-collapse:collapse;border:1px solid #18181b}
    .cell{border:1px solid #18181b;padding:5px 8px;vertical-align:top}
    .meta-tbl{width:100%;border-collapse:collapse}
    .meta-tbl td{padding:3px 6px;vertical-align:top;font-size:10px}
    .meta-tbl .lbl{color:#52525b}
    .meta-tbl .v{font-weight:700}
    .b-r{border-right:1px solid #18181b}
    .b-b{border-bottom:1px solid #18181b}
    .head-cell{display:flex;gap:10px}
    .head-cell img{height:46px;width:46px;object-fit:contain}
    .biz-name{font-weight:700}
    .row-label{color:#52525b;font-size:10px}
    .items thead th{font-weight:600}
    .footer-note{text-align:center;color:#52525b;padding-top:6px;font-size:10px}
    .sig-block img{height:56px;object-fit:contain}
    @media print{body{padding:0}@page{margin:8mm}}
  </style></head><body>
    <div class="title">${title}</div>
    <table class="frame"><tbody>
      <tr>
        <td class="cell" colspan="3" style="width:55%">
          <div class="head-cell">
            ${logoUrl ? `<img src="${logoUrl}" alt=""/>` : ''}
            <div>
              <div class="biz-name">${business?.business_name || ''}</div>
              ${business?.address ? `<div>${business.address}</div>` : ''}
              ${business?.mobile ? `<div>${business.mobile}</div>` : ''}
              ${business?.gst_number ? `<div>GSTIN/UIN: ${business.gst_number}</div>` : ''}
              ${business?.gst_number ? `<div>State Name : ${stateFromGST(business.gst_number)}</div>` : ''}
              ${business?.email ? `<div>E-Mail : ${business.email}</div>` : ''}
            </div>
          </div>
        </td>
        <td class="cell" colspan="4">
          <table class="meta-tbl"><tbody>
            <tr><td class="b-b b-r" style="width:50%"><div class="lbl">${isQuotation ? 'Quotation No.' : 'Invoice No.'}</div><div class="v">${docNumber}</div></td>
                <td class="b-b"><div class="lbl">Dated</div><div class="v">${fmtDate(docDate, true)}</div></td></tr>
            <tr><td class="b-b b-r"><div class="lbl">Delivery Note</div><div>&nbsp;</div></td>
                <td class="b-b"><div class="lbl">Mode/Terms of Payment</div><div>&nbsp;</div></td></tr>
            <tr><td class="b-b b-r"><div class="lbl">Reference No. & Date.</div><div>&nbsp;</div></td>
                <td class="b-b"><div class="lbl">Other References</div><div>&nbsp;</div></td></tr>
            <tr><td class="b-b b-r"><div class="lbl">Buyer's Order No.</div><div>&nbsp;</div></td>
                <td class="b-b"><div class="lbl">Dated</div><div>${docDue ? fmtDate(docDue, true) : ''}</div></td></tr>
            <tr><td class="b-r"><div class="lbl">Dispatch Doc No.</div><div>&nbsp;</div></td>
                <td><div class="lbl">Delivery Note Date</div><div>&nbsp;</div></td></tr>
          </tbody></table>
        </td>
      </tr>

      <tr>
        <td class="cell" colspan="3">
          <div class="row-label">Consignee (Ship to)</div>
          <div class="biz-name">${customer?.business_name || customer?.contact_person || doc.customer_name || ''}</div>
          ${customer?.business_name && customer?.contact_person ? `<div>${customer.contact_person}</div>` : ''}
          ${customer?.address ? `<div>${customer.address}</div>` : ''}
          ${customer?.gst_number ? `<div>GSTIN/UIN&nbsp;&nbsp;: ${customer.gst_number}</div>` : ''}
          ${customer?.gst_number ? `<div>State Name&nbsp;: ${stateFromGST(customer.gst_number)}</div>` : ''}
        </td>
        <td class="cell" colspan="4" rowspan="2">&nbsp;</td>
      </tr>
      <tr>
        <td class="cell" colspan="3">
          <div class="row-label">Buyer (Bill to)</div>
          <div class="biz-name">${customer?.business_name || customer?.contact_person || doc.customer_name || ''}</div>
          ${customer?.business_name && customer?.contact_person ? `<div>${customer.contact_person}</div>` : ''}
          ${customer?.address ? `<div>${customer.address}</div>` : ''}
          ${customer?.gst_number ? `<div>GSTIN/UIN&nbsp;&nbsp;: ${customer.gst_number}</div>` : ''}
          ${customer?.gst_number ? `<div>State Name&nbsp;: ${stateFromGST(customer.gst_number)}</div>` : ''}
        </td>
      </tr>

      <tr style="font-weight:700">
        <td class="cell" style="text-align:center;width:32px">Sl<br/>No.</td>
        <td class="cell">Description of Goods</td>
        <td class="cell" style="text-align:center;width:80px">HSN/SAC</td>
        <td class="cell" style="text-align:center;width:70px">Quantity</td>
        <td class="cell" style="text-align:right;width:90px">Rate</td>
        <td class="cell" style="text-align:center;width:40px">per</td>
        <td class="cell" style="text-align:right;width:90px">Amount</td>
      </tr>
      ${items}

      ${(doc.tax_amount || 0) > 0 ? `
      <tr>
        <td class="cell"></td><td class="cell" style="font-style:italic;font-weight:700">OUTPUT CGST</td>
        <td class="cell"></td><td class="cell"></td><td class="cell"></td><td class="cell"></td>
        <td class="cell" style="text-align:right">${fmt(halfTax)}</td>
      </tr>
      <tr>
        <td class="cell"></td><td class="cell" style="font-style:italic;font-weight:700">OUTPUT SGST</td>
        <td class="cell"></td><td class="cell"></td><td class="cell"></td><td class="cell"></td>
        <td class="cell" style="text-align:right">${fmt(halfTax)}</td>
      </tr>` : ''}

      <tr><td class="cell" colspan="7" style="height:50px"></td></tr>

      <tr style="font-weight:700">
        <td class="cell"></td>
        <td class="cell" style="text-align:right">Total</td>
        <td class="cell"></td>
        <td class="cell" style="text-align:center">${itemsCount} ${firstUnit}</td>
        <td class="cell"></td>
        <td class="cell"></td>
        <td class="cell" style="text-align:right">₹ ${fmt(doc.total || 0)}</td>
      </tr>

      <tr>
        <td class="cell" colspan="7">
          <div class="row-label">Amount Chargeable (in words)</div>
          <div style="font-weight:700">INR ${numberToWordsINR(doc.total || 0).replace('Rupees ', '').replace(' Only', ' Only')}</div>
          <div style="text-align:right;font-style:italic">E. & O.E</div>
        </td>
      </tr>

      <tr>
        <td class="cell" colspan="3" style="height:120px">
          ${settings?.bank_name ? `
            <div class="row-label">Company's Bank Details</div>
            <div>A/c Holder's Name &nbsp;: <strong>${business?.business_name || ''}</strong></div>
            <div>Bank Name &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: <strong>${settings.bank_name}</strong></div>
            ${settings.bank_account ? `<div>A/c No. &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: <strong>${settings.bank_account}</strong></div>` : ''}
            ${settings.bank_ifsc ? `<div>Branch & IFS Code : <strong>${settings.bank_branch ? settings.bank_branch + ' & ' : ''}${settings.bank_ifsc}</strong></div>` : ''}` : ''}
        </td>
        <td class="cell sig-block" colspan="4" style="height:120px">
          <div style="text-align:right;font-weight:700">for ${business?.business_name || ''}</div>
          <div style="display:flex;align-items:flex-end;justify-content:flex-end;gap:14px;height:60px;margin-top:14px">
            ${settings?.qr_code_image ? `<img src="${baseUrl}/assets/${assetDir}/${settings.qr_code_image}" alt="" style="height:56px;width:56px;object-fit:contain"/>` : ''}
            ${settings?.signature_image ? `<img src="${baseUrl}/assets/${assetDir}/${settings.signature_image}" alt=""/>` : ''}
          </div>
          <div style="text-align:right;color:#52525b">Authorised Signatory</div>
        </td>
      </tr>

      <tr>
        <td class="cell" colspan="3">
          ${business?.pan ? `<div>Company's PAN : <strong>${business.pan}</strong></div>` : ''}
          <div style="font-weight:700;text-decoration:underline;margin-top:4px">Declaration</div>
          <div>We declare that this ${isQuotation ? 'quotation reflects' : 'invoice shows'} the actual price of the goods described and that all particulars are true and correct.</div>
          ${settings?.terms_and_conditions ? `<div style="white-space:pre-wrap;margin-top:4px">${settings.terms_and_conditions}</div>` : ''}
        </td>
        <td class="cell" colspan="4"></td>
      </tr>
    </tbody></table>
    <div class="footer-note">${settings?.footer_text || `This is a Computer Generated ${isQuotation ? 'Quotation' : 'Invoice'}`}</div>
  </body></html>`;
}

// ============================================================
// PUBLIC: dispatch by template id
// ============================================================
export function buildDocumentHTML(opts: BuildHtmlOptions): string {
  const tmpl = opts.settings?.template || 'classic';
  switch (tmpl) {
    case 'modern_blue': return modernBlueTemplate(opts);
    case 'tally_tax': return tallyTaxTemplate(opts);
    case 'classic':
    default: return classicTemplate(opts);
  }
}

export const TEMPLATE_OPTIONS = [
  { id: 'classic', name: 'Classic', description: 'Default modern dark-header layout', accent: '#18181b' },
  { id: 'modern_blue', name: 'Modern Blue', description: 'Bold blue title with info badges', accent: '#2596d4' },
  { id: 'tally_tax', name: 'Tally Tax Invoice', description: 'Bordered Tally-style GST layout', accent: '#3f3f46' },
] as const;
