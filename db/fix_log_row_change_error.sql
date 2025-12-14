-- The existing log_row_change function in your database has a syntax error:
-- "column 'key' does not exist"
-- This happens because it tries to "SELECT key" from jsonb_object_keys, which returns a set of text values, not a table with a 'key' column.

-- This script replaces the broken function with a minimal valid version to UNBLOCK your database operations.
-- WARNING: This will stop whatever audit logging this function was doing.
-- If you need the audit logs, you should find the original function code and change "SELECT key" to "SELECT *".

CREATE OR REPLACE FUNCTION log_row_change() RETURNS trigger AS $$
BEGIN
    -- Minimal implementation to allow INSERT/UPDATE to proceed without error
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
