-- New tree-add accounts are marked at creation; every pre-existing row keeps
-- the default and is never reclassified by this migration. There is no
-- 'verified' value: no mailbox-verification mechanism exists yet, so the
-- tree-add class is refused membership binding until a future decision
-- creates a real verification path.
ALTER TABLE auth_accounts ADD COLUMN provenance TEXT NOT NULL DEFAULT 'legacy_unknown';
