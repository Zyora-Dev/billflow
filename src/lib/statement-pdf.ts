import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Alert, Linking } from 'react-native';
import { BASE_URL } from '../api/client';

export interface StatementEntry {
  date: string;
  type: string;
  ref: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface BusinessInfo {
  business_name?: string | null;
  business_logo?: string | null;
  address?: string | null;
  mobile?: string | null;
  email?: string | null;
  gst_number?: string | null;
  pan?: string | null;
}

export interface PartyInfo {
  name: string;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
  gst_number?: string | null;
}

const fmt = (n: number) =>
  Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d: string) => {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return d;
  }
};

const esc = (s: any) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

export function generateStatementHTML(opts: {
  business: BusinessInfo | null;
  party: PartyInfo;
  entries: StatementEntry[];
  title?: string;
  party_label?: string;
}): string {
  const {
    business,
    party,
    entries,
    title = 'Customer Statement',
    party_label = 'Statement For',
  } = opts;

  const realEntries = entries.filter((e) => e.type !== 'Opening Balance' && e.date);
  const dates = realEntries
    .map((e) => new Date(e.date))
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  const fromDate = dates.length ? dates[0] : null;
  const toDate = dates.length ? dates[dates.length - 1] : null;

  const totalDebit = entries.reduce((s, e) => s + Number(e.debit || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + Number(e.credit || 0), 0);
  const lastBalance = entries.length ? Number(entries[entries.length - 1].balance || 0) : 0;

  const logoUrl = business?.business_logo
    ? business.business_logo.startsWith('http')
      ? business.business_logo
      : `${BASE_URL}/assets/logos/${business.business_logo}`
    : null;

  const businessMeta: string[] = [];
  if (business?.address) businessMeta.push(esc(business.address));
  const contact: string[] = [];
  if (business?.mobile) contact.push(`Tel: ${esc(business.mobile)}`);
  if (business?.email) contact.push(esc(business.email));
  if (contact.length) businessMeta.push(contact.join('  •  '));
  const ids: string[] = [];
  if (business?.gst_number) ids.push(`GSTIN: ${esc(business.gst_number)}`);
  if (business?.pan) ids.push(`PAN: ${esc(business.pan)}`);
  if (ids.length) businessMeta.push(ids.join('  •  '));

  const partyMeta: string[] = [];
  if (party.address) partyMeta.push(esc(party.address));
  const pcontact: string[] = [];
  if (party.mobile) pcontact.push(esc(party.mobile));
  if (party.email) pcontact.push(esc(party.email));
  if (pcontact.length) partyMeta.push(pcontact.join('  •  '));
  if (party.gst_number) partyMeta.push(`GSTIN: ${esc(party.gst_number)}`);

  const rows = entries
    .map((e, idx) => {
      const isOpening = e.type === 'Opening Balance';
      const dateCell = isOpening ? '—' : fmtDate(e.date);
      const balSign = e.balance < 0 ? 'Cr' : 'Dr';
      const bg = idx % 2 === 0 ? '#fafbfd' : '#ffffff';
      return `<tr style="background:${bg}">
        <td>${dateCell}</td>
        <td style="color:#6e7382">${esc(e.type)}</td>
        <td>${esc(e.ref || '—')}</td>
        <td class="num">${e.debit > 0 ? fmt(e.debit) : '<span class="dash">—</span>'}</td>
        <td class="num">${e.credit > 0 ? fmt(e.credit) : '<span class="dash">—</span>'}</td>
        <td class="num bold">${fmt(Math.abs(e.balance))} ${balSign}</td>
      </tr>`;
    })
    .join('');

  const closingLabel = lastBalance < 0 ? '(In Your Favour)' : '(Receivable)';
  const closingSign = lastBalance < 0 ? 'Cr' : 'Dr';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, Helvetica, Arial, sans-serif;
    margin: 0; padding: 24px;
    color: #161620;
    font-size: 12px;
    line-height: 1.4;
  }
  .header { display: flex; align-items: flex-start; gap: 14px; padding-bottom: 12px; border-bottom: 2px solid #1a1a40; }
  .logo { width: 64px; height: 64px; object-fit: contain; }
  .biz-name { font-size: 22px; font-weight: 800; color: #1a1a40; letter-spacing: -0.3px; margin: 0; }
  .biz-meta { color: #6e7382; font-size: 11px; margin-top: 4px; line-height: 1.5; }
  .title { text-align: center; font-size: 16px; font-weight: 800; color: #1a1a40; letter-spacing: 1px; margin: 18px 0 14px; }
  .row { display: flex; gap: 10px; margin-bottom: 14px; }
  .card { flex: 1; border: 1px solid #dcdee6; border-radius: 6px; padding: 10px 12px; background: #f5f6fa; }
  .card.meta { background: #ffffff; }
  .label { font-size: 9px; font-weight: 700; color: #6e7382; letter-spacing: 0.5px; text-transform: uppercase; }
  .party-name { font-size: 14px; font-weight: 800; color: #161620; margin-top: 4px; }
  .party-meta { font-size: 10px; color: #6e7382; margin-top: 4px; line-height: 1.5; }
  .meta-row { display: flex; justify-content: space-between; gap: 10px; margin-top: 8px; }
  .meta-row:first-of-type { margin-top: 4px; }
  .meta-cell { flex: 1; }
  .meta-cell.right { text-align: right; }
  .meta-val { font-size: 11px; color: #161620; margin-top: 2px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px; }
  thead th {
    background: #1a1a40; color: #ffffff; font-weight: 700;
    text-align: left; padding: 8px 8px; font-size: 10px; letter-spacing: 0.5px; text-transform: uppercase;
  }
  thead th.num { text-align: right; }
  tbody td { padding: 7px 8px; border-bottom: 1px solid #ececf2; vertical-align: top; }
  tbody td.num { text-align: right; }
  tbody td.bold { font-weight: 700; }
  .dash { color: #c4c7d0; }
  .totals tr { background: #1a1a40 !important; }
  .totals td { color: #ffffff !important; padding: 9px 8px; font-weight: 700; border: none; }
  .closing {
    margin-top: 18px;
    margin-left: auto;
    width: 280px;
    border: 1.5px solid #1a1a40;
    border-radius: 6px;
    background: #fffbeb;
    padding: 10px 12px;
  }
  .closing .topline { display: flex; justify-content: space-between; font-size: 9px; color: #6e7382; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; }
  .closing .amount { font-size: 20px; font-weight: 800; color: #1a1a40; margin-top: 4px; }
  .footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #dcdee6; color: #6e7382; font-size: 9px; font-style: italic; text-align: center; }
</style>
</head>
<body>
  <div class="header">
    ${logoUrl ? `<img class="logo" src="${esc(logoUrl)}" />` : ''}
    <div style="flex:1">
      <div class="biz-name">${esc(business?.business_name || 'Statement of Account')}</div>
      <div class="biz-meta">${businessMeta.join('<br/>')}</div>
    </div>
  </div>

  <div class="title">${esc(title.toUpperCase())}</div>

  <div class="row">
    <div class="card">
      <div class="label">${esc(party_label)}</div>
      <div class="party-name">${esc(party.name || '—')}</div>
      <div class="party-meta">${partyMeta.join('<br/>')}</div>
    </div>
    <div class="card meta" style="flex:0 0 38%">
      <div class="meta-row">
        <div class="meta-cell"><div class="label">Statement Date</div><div class="meta-val">${fmtDate(new Date().toISOString())}</div></div>
        <div class="meta-cell right"><div class="label">Entries</div><div class="meta-val">${entries.length}</div></div>
      </div>
      <div class="meta-row">
        <div class="meta-cell"><div class="label">Period From</div><div class="meta-val">${fromDate ? fmtDate(fromDate.toISOString()) : '—'}</div></div>
        <div class="meta-cell right"><div class="label">Period To</div><div class="meta-val">${toDate ? fmtDate(toDate.toISOString()) : '—'}</div></div>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Particulars</th>
        <th class="num">Debit</th>
        <th class="num">Credit</th>
        <th class="num">Balance</th>
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="6" style="text-align:center;padding:30px;color:#9ca0ad">No entries</td></tr>`}
    </tbody>
    <tfoot class="totals">
      <tr>
        <td colspan="3">TOTAL</td>
        <td class="num">${fmt(totalDebit)}</td>
        <td class="num">${fmt(totalCredit)}</td>
        <td class="num">${fmt(Math.abs(lastBalance))} ${closingSign}</td>
      </tr>
    </tfoot>
  </table>

  <div class="closing">
    <div class="topline">
      <span>Closing Balance</span>
      <span>${closingLabel}</span>
    </div>
    <div class="amount">₹ ${fmt(Math.abs(lastBalance))} ${closingSign}</div>
  </div>

  <div class="footer">
    This is a system-generated statement. For any discrepancies, please contact us within 7 days.
  </div>
</body>
</html>`;
}

export async function downloadStatementPDF(opts: Parameters<typeof generateStatementHTML>[0]) {
  try {
    const html = generateStatementHTML(opts);
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `${opts.party.name} — Statement`,
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('Saved', `PDF saved to: ${uri}`);
    }
    return uri;
  } catch (e: any) {
    Alert.alert('Error', e?.message || 'Failed to generate PDF');
    return null;
  }
}

export async function shareStatementWhatsApp(opts: {
  business: BusinessInfo | null;
  party: PartyInfo;
  entries: StatementEntry[];
}) {
  const { business, party, entries } = opts;
  const lastBalance = entries.length ? Number(entries[entries.length - 1].balance || 0) : 0;
  const sign = lastBalance < 0 ? 'Cr' : 'Dr';
  const text =
    `*Statement of Account*\n` +
    `${party.name}\n\n` +
    `Closing Balance: ₹${fmt(Math.abs(lastBalance))} ${sign}\n` +
    `Entries: ${entries.length}\n\n` +
    `From: ${business?.business_name || ''}`;

  // Try with the party's mobile first; fallback to whatsapp:// chooser
  const phone = (party.mobile || '').replace(/\D/g, '');
  const url = phone
    ? `whatsapp://send?phone=${phone}&text=${encodeURIComponent(text)}`
    : `whatsapp://send?text=${encodeURIComponent(text)}`;

  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert('Error', 'WhatsApp not installed');
  }
}
