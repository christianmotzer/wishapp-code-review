/*
  # Fix audit trail trigger for status changes

  ## Problem
  The `log_wish_status_change` trigger uses `NEW.closed_by` as the `changed_by`
  value when logging status changes. For operations like Publish (draft -> active)
  and Enable Voting (active -> voting), `closed_by` is NULL because no one is
  closing the wish. This violates the NOT NULL constraint on `changed_by` in
  `wish_status_history`, causing the entire UPDATE to roll back.

  ## Fix
  - Use `COALESCE(NEW.closed_by, auth.uid())` so the authenticated user is
    recorded when `closed_by` is not set
  - `closed_by` is still used when explicitly provided (accept, reject, retract, cancel)
*/

CREATE OR REPLACE FUNCTION log_wish_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO wish_status_history (wish_id, old_status, new_status, changed_by, reason)
    VALUES (NEW.id, OLD.status, NEW.status, COALESCE(NEW.closed_by, auth.uid()), NEW.closure_reason);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
