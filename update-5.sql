-- PadiHire update 5: profile photos, profile links, edited jobs, withdrawal receipts.
ALTER TABLE users ADD COLUMN photo_file INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN username TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX IF NOT EXISTS users_username ON users(username) WHERE username != '';
ALTER TABLE jobs ADD COLUMN edited_at INTEGER NOT NULL DEFAULT 0;
UPDATE ledger SET ref = 'withdraw:' || (SELECT MAX(w.id) FROM withdrawals w WHERE w.user_id = ledger.user_id AND w.amount = -ledger.amount AND w.created_at = ledger.created_at) WHERE kind = 'withdraw' AND ref IS NULL;
