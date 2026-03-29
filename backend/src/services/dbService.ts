import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ==========================================
// SQLite Database Service (개인용)
// ==========================================

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'screening.db');

let db: Database.Database | null = null;

function getDB(): Database.Database {
  if (db) return db;

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Create tables if not exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS screening_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      asset_type TEXT NOT NULL,
      session_date TEXT NOT NULL,
      session_number INTEGER NOT NULL,
      criteria_json TEXT NOT NULL,
      result_count INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      UNIQUE(asset_type, session_date, session_number)
    );

    CREATE TABLE IF NOT EXISTS screening_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES screening_sessions(id) ON DELETE CASCADE,
      result_json TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_results_session ON screening_results(session_id);
  `);

  return db;
}

// ==========================================
// Save
// ==========================================

export function saveScreeningSession(
  assetType: 'stock' | 'etf',
  criteria: object,
  results: unknown[],
): number {
  const database = getDB();

  // Today's date in local timezone
  const now = new Date();
  const sessionDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Calculate session number for today
  const row = database.prepare(
    'SELECT COALESCE(MAX(session_number), 0) as maxNum FROM screening_sessions WHERE asset_type = ? AND session_date = ?'
  ).get(assetType, sessionDate) as { maxNum: number };
  const sessionNumber = row.maxNum + 1;

  // Insert session
  const insertSession = database.prepare(
    'INSERT INTO screening_sessions (asset_type, session_date, session_number, criteria_json, result_count) VALUES (?, ?, ?, ?, ?)'
  );
  const info = insertSession.run(assetType, sessionDate, sessionNumber, JSON.stringify(criteria), results.length);
  const sessionId = info.lastInsertRowid as number;

  // Insert results (batch)
  const insertResult = database.prepare(
    'INSERT INTO screening_results (session_id, result_json) VALUES (?, ?)'
  );
  const insertMany = database.transaction((items: unknown[]) => {
    for (const item of items) {
      insertResult.run(sessionId, JSON.stringify(item));
    }
  });
  insertMany(results);

  return sessionId;
}

// ==========================================
// Query
// ==========================================

export interface SessionListItem {
  id: number;
  asset_type: string;
  session_date: string;
  session_number: number;
  result_count: number;
  created_at: string;
  label: string; // "2026-03-29 ETF 1회차"
}

export function getSessionList(): SessionListItem[] {
  const database = getDB();
  const rows = database.prepare(
    'SELECT id, asset_type, session_date, session_number, result_count, created_at FROM screening_sessions ORDER BY created_at DESC'
  ).all() as Omit<SessionListItem, 'label'>[];

  return rows.map(r => ({
    ...r,
    label: `${r.session_date} ${r.asset_type === 'etf' ? 'ETF' : '배당주'} ${r.session_number}회차 (${r.result_count}종목)`,
  }));
}

export interface SessionDetail {
  session: {
    id: number;
    asset_type: string;
    session_date: string;
    session_number: number;
    criteria: Record<string, unknown>;
    result_count: number;
    created_at: string;
  };
  results: unknown[];
}

export function getSessionDetail(sessionId: number): SessionDetail | null {
  const database = getDB();

  const session = database.prepare(
    'SELECT id, asset_type, session_date, session_number, criteria_json, result_count, created_at FROM screening_sessions WHERE id = ?'
  ).get(sessionId) as { id: number; asset_type: string; session_date: string; session_number: number; criteria_json: string; result_count: number; created_at: string } | undefined;

  if (!session) return null;

  const resultRows = database.prepare(
    'SELECT result_json FROM screening_results WHERE session_id = ? ORDER BY id'
  ).all(sessionId) as { result_json: string }[];

  return {
    session: {
      id: session.id,
      asset_type: session.asset_type,
      session_date: session.session_date,
      session_number: session.session_number,
      criteria: JSON.parse(session.criteria_json),
      result_count: session.result_count,
      created_at: session.created_at,
    },
    results: resultRows.map(r => JSON.parse(r.result_json)),
  };
}

// ==========================================
// Delete
// ==========================================

export function deleteSession(sessionId: number): boolean {
  const database = getDB();
  const info = database.prepare('DELETE FROM screening_sessions WHERE id = ?').run(sessionId);
  return info.changes > 0;
}

// ==========================================
// Init (call on server start)
// ==========================================

export function initDB(): void {
  getDB();
  console.log(`[DB] SQLite initialized at ${DB_PATH}`);
}
