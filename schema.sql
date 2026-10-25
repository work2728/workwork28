-- PadiHire database (Cloudflare D1). Paste all of this into the D1 Console and run it once.
-- Money is stored in whole naira. A user's spendable balance can never go below zero (CHECK),
-- and every money movement writes a ledger row with a unique ref, so nothing can be paid twice.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'fre',            -- current mode: fre (freelancer) or cli (client)
  title TEXT NOT NULL DEFAULT '',              -- freelancer headline
  cat TEXT NOT NULL DEFAULT '',                -- freelancer category
  skills TEXT NOT NULL DEFAULT '[]',           -- JSON array
  about TEXT NOT NULL DEFAULT '',
  rate_from INTEGER NOT NULL DEFAULT 0,
  business TEXT NOT NULL DEFAULT '',           -- client business name
  avail INTEGER NOT NULL DEFAULT 0 CHECK (avail >= 0),
  verified INTEGER NOT NULL DEFAULT 0,         -- 1 after the first confirmed top-up
  rating_sum INTEGER NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  jobs_done INTEGER NOT NULL DEFAULT 0,
  bank_name TEXT NOT NULL DEFAULT '',
  bank_acct TEXT NOT NULL DEFAULT '',
  bank_holder TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',       -- active or suspended
  created_at INTEGER NOT NULL,
  cv_file INTEGER NOT NULL DEFAULT 0,
  cv_name TEXT NOT NULL DEFAULT '',
  email_verified INTEGER NOT NULL DEFAULT 0,
  email_alerts INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  cat TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'Intermediate',
  budget INTEGER NOT NULL,
  days INTEGER NOT NULL DEFAULT 3,
  city TEXT NOT NULL DEFAULT '',
  remote INTEGER NOT NULL DEFAULT 1,
  skills TEXT NOT NULL DEFAULT '[]',
  descr TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',         -- open, hired, closed, removed
  props INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status, created_at);
CREATE INDEX IF NOT EXISTS jobs_client ON jobs(client_id);

CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  fre_id INTEGER NOT NULL,
  price INTEGER NOT NULL,
  days INTEGER NOT NULL,
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',         -- sent, hired, lost
  created_at INTEGER NOT NULL,
  UNIQUE (job_id, fre_id)
);
CREATE INDEX IF NOT EXISTS proposals_fre ON proposals(fre_id, created_at);

CREATE TABLE IF NOT EXISTS threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  fre_id INTEGER NOT NULL,
  last_at INTEGER NOT NULL,
  last_text TEXT NOT NULL DEFAULT '',
  last_sender INTEGER NOT NULL DEFAULT 0,
  client_unread INTEGER NOT NULL DEFAULT 0,
  fre_unread INTEGER NOT NULL DEFAULT 0,
  UNIQUE (job_id, client_id, fre_id)
);
CREATE INDEX IF NOT EXISTS threads_client ON threads(client_id, last_at);
CREATE INDEX IF NOT EXISTS threads_fre ON threads(fre_id, last_at);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  thread_id INTEGER NOT NULL,
  sender_id INTEGER NOT NULL,                  -- 0 = PadiHire system message
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS messages_thread ON messages(thread_id, id);

CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL UNIQUE,              -- one hire per job
  client_id INTEGER NOT NULL,
  fre_id INTEGER NOT NULL,
  thread_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  amount INTEGER NOT NULL,                     -- freelancer's price, held in escrow
  client_fee INTEGER NOT NULL DEFAULT 0,       -- paid by the client at hire
  fre_fee INTEGER NOT NULL DEFAULT 0,          -- kept from the freelancer on release
  fre_fee_pct INTEGER NOT NULL DEFAULT 10,
  days INTEGER NOT NULL,
  due_at INTEGER NOT NULL,
  stage TEXT NOT NULL DEFAULT 'active',        -- active, delivered, disputed, paid, refunded
  delivered_at INTEGER,
  closed_at INTEGER,
  fee_refunded INTEGER NOT NULL DEFAULT 0,
  dispute_by INTEGER,
  dispute_reason TEXT NOT NULL DEFAULT '',
  rated INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS contracts_client ON contracts(client_id);
CREATE INDEX IF NOT EXISTS contracts_fre ON contracts(fre_id);
CREATE INDEX IF NOT EXISTS contracts_stage ON contracts(stage, delivered_at);

CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,                          -- topup, escrow, fee, release, earning, withdraw, withdraw_back, refund
  label TEXT NOT NULL,
  amount INTEGER NOT NULL,                     -- change to the spendable balance (0 for information-only rows)
  info INTEGER NOT NULL DEFAULT 0,             -- amount shown for information-only rows (escrow released)
  ref TEXT UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS ledger_user ON ledger(user_id, id);

CREATE TABLE IF NOT EXISTS topups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  ref TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',      -- pending, confirmed, rejected
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  decided_at INTEGER
);
CREATE INDEX IF NOT EXISTS topups_status ON topups(status, created_at);

CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  bank_name TEXT NOT NULL,
  bank_acct TEXT NOT NULL,
  bank_holder TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',      -- pending, paid, rejected
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  decided_at INTEGER
);
CREATE INDEX IF NOT EXISTS withdrawals_status ON withdrawals(status, created_at);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL UNIQUE,
  client_id INTEGER NOT NULL,
  fre_id INTEGER NOT NULL,
  stars INTEGER NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS reviews_fre ON reviews(fre_id, created_at);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',         -- open, closed
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS saved (
  user_id INTEGER NOT NULL,
  job_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, job_id)
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  size INTEGER NOT NULL,
  kind TEXT NOT NULL,                          -- cv, proposal, message
  scope TEXT NOT NULL DEFAULT 'pending',       -- pending, cv, proposal, message, old
  ref_id INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS files_ref ON files(scope, ref_id);
CREATE INDEX IF NOT EXISTS files_user ON files(user_id, created_at);

CREATE TABLE IF NOT EXISTS flags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  context TEXT NOT NULL,                       -- message, proposal, job, profile
  ref_id INTEGER NOT NULL DEFAULT 0,
  original TEXT NOT NULL,
  reasons TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',         -- open, reviewed
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS flags_status ON flags(status, id);

CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS tokens_user ON tokens(user_id, kind);

CREATE TABLE IF NOT EXISTS limits (
  k TEXT PRIMARY KEY,
  n INTEGER NOT NULL DEFAULT 0,
  reset_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  file_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  link TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS portfolio_user ON portfolio(user_id, id);

CREATE TABLE IF NOT EXISTS settings (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
INSERT OR IGNORE INTO settings (k, v) VALUES
  ('client_fee_pct', '5'),
  ('fre_fee_pct', '10'),
  ('monthly_proposals', '20'),
  ('auto_release_days', '5'),
  ('mask_after_hire', '1'),
  ('bank_name', ''),
  ('bank_acct', ''),
  ('bank_holder', ''),
  ('support_whatsapp', '');
