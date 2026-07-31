-- UX-13 Phase B (Spreadsheet Intelligence): adds xlsx/csv/ods as readable
-- document file types. Each new value in its own statement, and nothing
-- in this migration reads/writes a row using them — Postgres forbids
-- using a freshly added enum value in the same transaction that added it.

alter type document_file_type add value if not exists 'xlsx';
alter type document_file_type add value if not exists 'csv';
alter type document_file_type add value if not exists 'ods';
