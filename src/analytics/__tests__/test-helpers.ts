import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../db/schema.js';
import { funds, filings, holdings, securities } from '../../db/schema.js';

export interface TestDb {
  db: BetterSQLite3Database<typeof schema>;
  sqlite: InstanceType<typeof Database>;
}

/**
 * Creates an in-memory SQLite database with all tables matching production schema.
 * Returns both the Drizzle ORM instance and the raw better-sqlite3 handle.
 */
export function createTestDb(): TestDb {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  // Create tables matching src/db/schema.ts exactly
  sqlite.exec(`
    CREATE TABLE funds (
      cik TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      strategy_group TEXT NOT NULL,
      active INTEGER DEFAULT 1
    );

    CREATE TABLE filings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fund_cik TEXT REFERENCES funds(cik),
      accession_number TEXT UNIQUE NOT NULL,
      form TEXT NOT NULL,
      filing_date TEXT NOT NULL,
      report_date TEXT NOT NULL,
      acceptance_datetime TEXT NOT NULL,
      is_amendment INTEGER DEFAULT 0,
      amendment_type TEXT,
      table_entry_total INTEGER,
      table_value_total INTEGER,
      value_format TEXT NOT NULL,
      ingested_at TEXT NOT NULL
    );
    CREATE INDEX idx_filings_fund_report ON filings(fund_cik, report_date);

    CREATE TABLE holdings (
      fund_cik TEXT NOT NULL REFERENCES funds(cik),
      report_quarter TEXT NOT NULL,
      cusip TEXT NOT NULL,
      name_of_issuer TEXT NOT NULL,
      title_of_class TEXT NOT NULL,
      value INTEGER NOT NULL,
      shares INTEGER NOT NULL,
      share_type TEXT NOT NULL,
      put_call TEXT NOT NULL DEFAULT '',
      investment_discretion TEXT NOT NULL,
      filing_accession TEXT NOT NULL,
      PRIMARY KEY (fund_cik, report_quarter, cusip, put_call)
    );
    CREATE INDEX idx_holdings_cusip_quarter ON holdings(cusip, report_quarter);
    CREATE INDEX idx_holdings_fund_quarter ON holdings(fund_cik, report_quarter);

    CREATE TABLE securities (
      cusip TEXT PRIMARY KEY,
      ticker TEXT,
      name TEXT,
      security_type TEXT,
      sic TEXT,
      sic_description TEXT,
      sector TEXT,
      issuer_cik TEXT,
      mapped_at TEXT,
      mapping_source TEXT,
      unmapped INTEGER DEFAULT 1
    );
  `);

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

// Test CUSIPs
export const AAPL_CUSIP = '037833100';
export const MSFT_CUSIP = '594918104';
export const GOOG_CUSIP = '02079K305';
export const NVDA_CUSIP = '67066G104';

/**
 * Seeds the test database with two quarters of data for integration testing.
 *
 * Fund A (FUND_A, Tiger Cubs):
 *   Q3 2025: AAPL ($1M, 100sh), MSFT ($2M, 200sh), GOOG ($500K, 50sh)
 *   Q4 2025: AAPL ($1.5M, 150sh), MSFT ($2M, 200sh), NVDA ($3M, 300sh), GOOG exited
 *            + AAPL Call option ($100K, 10sh) -- to test options exclusion
 *
 * Fund B (FUND_B, Tiger Cubs):
 *   Q4 2025: AAPL ($800K, 80sh), NVDA ($1.2M, 120sh) -- for group consensus tests
 *
 * Securities: AAPL, MSFT, GOOG, NVDA with tickers mapped
 */
export function seedTwoQuarters(db: BetterSQLite3Database<typeof schema>): void {
  // Insert funds
  db.insert(funds).values([
    { cik: 'FUND_A', name: 'Fund Alpha', strategyGroup: 'Tiger Cubs' },
    { cik: 'FUND_B', name: 'Fund Beta', strategyGroup: 'Tiger Cubs' },
  ]).run();

  // Insert securities (CUSIP -> ticker mappings)
  db.insert(securities).values([
    { cusip: AAPL_CUSIP, ticker: 'AAPL', name: 'Apple Inc', unmapped: false },
    { cusip: MSFT_CUSIP, ticker: 'MSFT', name: 'Microsoft Corp', unmapped: false },
    { cusip: GOOG_CUSIP, ticker: 'GOOG', name: 'Alphabet Inc', unmapped: false },
    { cusip: NVDA_CUSIP, ticker: 'NVDA', name: 'NVIDIA Corp', unmapped: false },
  ]).run();

  // Insert filings (needed for filing_accession references)
  db.insert(filings).values([
    {
      fundCik: 'FUND_A',
      accessionNumber: '0001-2025Q3',
      form: '13F-HR',
      filingDate: '2025-11-14',
      reportDate: '2025-09-30',
      acceptanceDateTime: '2025-11-14T10:00:00Z',
      valueFormat: 'thousands',
      ingestedAt: '2025-11-15T00:00:00Z',
    },
    {
      fundCik: 'FUND_A',
      accessionNumber: '0001-2025Q4',
      form: '13F-HR',
      filingDate: '2026-02-14',
      reportDate: '2025-12-31',
      acceptanceDateTime: '2026-02-14T10:00:00Z',
      valueFormat: 'thousands',
      ingestedAt: '2026-02-15T00:00:00Z',
    },
    {
      fundCik: 'FUND_B',
      accessionNumber: '0002-2025Q4',
      form: '13F-HR',
      filingDate: '2026-02-14',
      reportDate: '2025-12-31',
      acceptanceDateTime: '2026-02-14T10:00:00Z',
      valueFormat: 'thousands',
      ingestedAt: '2026-02-15T00:00:00Z',
    },
  ]).run();

  // Fund A Q3 2025: AAPL ($1M, 100sh), MSFT ($2M, 200sh), GOOG ($500K, 50sh)
  db.insert(holdings).values([
    {
      fundCik: 'FUND_A',
      reportQuarter: '2025Q3',
      cusip: AAPL_CUSIP,
      nameOfIssuer: 'APPLE INC',
      titleOfClass: 'COM',
      value: 1000000,
      shares: 100,
      shareType: 'SH',
      putCall: '',
      investmentDiscretion: 'SOLE',
      filingAccession: '0001-2025Q3',
    },
    {
      fundCik: 'FUND_A',
      reportQuarter: '2025Q3',
      cusip: MSFT_CUSIP,
      nameOfIssuer: 'MICROSOFT CORP',
      titleOfClass: 'COM',
      value: 2000000,
      shares: 200,
      shareType: 'SH',
      putCall: '',
      investmentDiscretion: 'SOLE',
      filingAccession: '0001-2025Q3',
    },
    {
      fundCik: 'FUND_A',
      reportQuarter: '2025Q3',
      cusip: GOOG_CUSIP,
      nameOfIssuer: 'ALPHABET INC',
      titleOfClass: 'CL C',
      value: 500000,
      shares: 50,
      shareType: 'SH',
      putCall: '',
      investmentDiscretion: 'SOLE',
      filingAccession: '0001-2025Q3',
    },
  ]).run();

  // Fund A Q4 2025: AAPL ($1.5M, 150sh), MSFT ($2M, 200sh), NVDA ($3M, 300sh)
  db.insert(holdings).values([
    {
      fundCik: 'FUND_A',
      reportQuarter: '2025Q4',
      cusip: AAPL_CUSIP,
      nameOfIssuer: 'APPLE INC',
      titleOfClass: 'COM',
      value: 1500000,
      shares: 150,
      shareType: 'SH',
      putCall: '',
      investmentDiscretion: 'SOLE',
      filingAccession: '0001-2025Q4',
    },
    {
      fundCik: 'FUND_A',
      reportQuarter: '2025Q4',
      cusip: MSFT_CUSIP,
      nameOfIssuer: 'MICROSOFT CORP',
      titleOfClass: 'COM',
      value: 2000000,
      shares: 200,
      shareType: 'SH',
      putCall: '',
      investmentDiscretion: 'SOLE',
      filingAccession: '0001-2025Q4',
    },
    {
      fundCik: 'FUND_A',
      reportQuarter: '2025Q4',
      cusip: NVDA_CUSIP,
      nameOfIssuer: 'NVIDIA CORP',
      titleOfClass: 'COM',
      value: 3000000,
      shares: 300,
      shareType: 'SH',
      putCall: '',
      investmentDiscretion: 'SOLE',
      filingAccession: '0001-2025Q4',
    },
  ]).run();

  // Fund A Q4 2025: AAPL Call option (to test options exclusion)
  db.insert(holdings).values({
    fundCik: 'FUND_A',
    reportQuarter: '2025Q4',
    cusip: AAPL_CUSIP,
    nameOfIssuer: 'APPLE INC',
    titleOfClass: 'CALL',
    value: 100000,
    shares: 10,
    shareType: 'SH',
    putCall: 'Call',
    investmentDiscretion: 'SOLE',
    filingAccession: '0001-2025Q4',
  }).run();

  // Fund B Q4 2025: AAPL ($800K, 80sh), NVDA ($1.2M, 120sh)
  db.insert(holdings).values([
    {
      fundCik: 'FUND_B',
      reportQuarter: '2025Q4',
      cusip: AAPL_CUSIP,
      nameOfIssuer: 'APPLE INC',
      titleOfClass: 'COM',
      value: 800000,
      shares: 80,
      shareType: 'SH',
      putCall: '',
      investmentDiscretion: 'SOLE',
      filingAccession: '0002-2025Q4',
    },
    {
      fundCik: 'FUND_B',
      reportQuarter: '2025Q4',
      cusip: NVDA_CUSIP,
      nameOfIssuer: 'NVIDIA CORP',
      titleOfClass: 'COM',
      value: 1200000,
      shares: 120,
      shareType: 'SH',
      putCall: '',
      investmentDiscretion: 'SOLE',
      filingAccession: '0002-2025Q4',
    },
  ]).run();
}
