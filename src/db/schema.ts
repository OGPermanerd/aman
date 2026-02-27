import {
  sqliteTable,
  text,
  integer,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core';

// ---------------------------------------------------------------------------
// funds - Tracked hedge fund filers
// ---------------------------------------------------------------------------
export const funds = sqliteTable('funds', {
  cik: text('cik').primaryKey(), // stored without leading zeros e.g. "1336528"
  name: text('name').notNull(),
  strategyGroup: text('strategy_group').notNull(),
  active: integer('active', { mode: 'boolean' }).default(true),
});

export type Fund = typeof funds.$inferSelect;
export type NewFund = typeof funds.$inferInsert;

// ---------------------------------------------------------------------------
// filings - SEC 13F-HR filing metadata
// ---------------------------------------------------------------------------
export const filings = sqliteTable(
  'filings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    fundCik: text('fund_cik').references(() => funds.cik),
    accessionNumber: text('accession_number').unique().notNull(),
    form: text('form').notNull(), // "13F-HR" or "13F-HR/A"
    filingDate: text('filing_date').notNull(), // ISO date
    reportDate: text('report_date').notNull(), // ISO date, quarter-end e.g. "2025-12-31"
    acceptanceDateTime: text('acceptance_datetime').notNull(), // ISO datetime
    isAmendment: integer('is_amendment', { mode: 'boolean' }).default(false),
    amendmentType: text('amendment_type'), // "RESTATEMENT" | "NEW HOLDINGS" | null
    tableEntryTotal: integer('table_entry_total'),
    tableValueTotal: integer('table_value_total'),
    valueFormat: text('value_format').notNull(), // "thousands" | "exact"
    ingestedAt: text('ingested_at').notNull(),
  },
  (table) => [
    index('idx_filings_fund_report').on(table.fundCik, table.reportDate),
  ],
);

export type Filing = typeof filings.$inferSelect;
export type NewFiling = typeof filings.$inferInsert;

// ---------------------------------------------------------------------------
// holdings - Individual position rows from 13F info tables
// ---------------------------------------------------------------------------
export const holdings = sqliteTable(
  'holdings',
  {
    fundCik: text('fund_cik')
      .references(() => funds.cik)
      .notNull(),
    reportQuarter: text('report_quarter').notNull(), // e.g. "2025Q4"
    cusip: text('cusip').notNull(),
    nameOfIssuer: text('name_of_issuer').notNull(),
    titleOfClass: text('title_of_class').notNull(),
    value: integer('value').notNull(), // normalized to exact dollars
    shares: integer('shares').notNull(),
    shareType: text('share_type').notNull(), // "SH" or "PRN"
    putCall: text('put_call').notNull().default(''), // empty string for equity
    investmentDiscretion: text('investment_discretion').notNull(),
    filingAccession: text('filing_accession').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.fundCik, table.reportQuarter, table.cusip, table.putCall],
    }),
    index('idx_holdings_cusip_quarter').on(table.cusip, table.reportQuarter),
    index('idx_holdings_fund_quarter').on(table.fundCik, table.reportQuarter),
  ],
);

export type Holding = typeof holdings.$inferSelect;
export type NewHolding = typeof holdings.$inferInsert;

// ---------------------------------------------------------------------------
// securities - CUSIP-to-ticker reference data
// ---------------------------------------------------------------------------
export const securities = sqliteTable('securities', {
  cusip: text('cusip').primaryKey(),
  ticker: text('ticker'),
  name: text('name'),
  securityType: text('security_type'),
  sic: text('sic'),
  sicDescription: text('sic_description'),
  sector: text('sector'),
  issuerCik: text('issuer_cik'),
  mappedAt: text('mapped_at'),
  mappingSource: text('mapping_source'), // "openfigi" | "sec_tickers" | "manual"
  unmapped: integer('unmapped', { mode: 'boolean' }).default(true),
  lastAttemptedAt: text('last_attempted_at'), // ISO datetime of last resolution attempt (for unmapped back-off)
});

export type Security = typeof securities.$inferSelect;
export type NewSecurity = typeof securities.$inferInsert;
