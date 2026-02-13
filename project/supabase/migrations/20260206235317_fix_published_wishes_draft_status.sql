/*
  # Fix published wishes stuck in draft status

  1. Data Fix
    - Updates all wishes where `is_published = true` but `status` is still `'draft'`
    - Sets their status to `'active'` so they display correctly and allow replies

  2. Why
    - A bug in the createWish function never set the status field when publishing
    - This caused all published wishes to remain in 'draft', hiding the
      "Submit Proposal" and "Create Sub-Wish" buttons

  3. Notes
    - Temporarily disables the status history trigger since there is no
      authenticated user context during migrations
    - This is a corrective data fix, not a user-initiated status change,
      so audit logging is not required
*/

ALTER TABLE wishes DISABLE TRIGGER log_wish_status_change_trigger;

UPDATE wishes
SET status = 'active'
WHERE is_published = true
  AND status = 'draft';

ALTER TABLE wishes ENABLE TRIGGER log_wish_status_change_trigger;
