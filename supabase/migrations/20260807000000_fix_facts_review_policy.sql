-- Fix: "read unflagged facts, admins see review queue" (see
-- 20260803010000_facts_review_gating.sql) required flagged = false for
-- every non-admin read. That meant a flagged fact could never become
-- visible again even after a human explicitly approved it via
-- review_status — nothing ever un-sets `flagged`, so the review_status
-- column the schema defines for exactly this purpose was write-only.
-- Matches the pattern already used for `recommendations`: visible once
-- EITHER the confidence threshold passed (flagged = false) OR a human
-- approved it (review_status = 'approved').

drop policy "read unflagged facts, admins see review queue" on facts;

create policy "read unflagged or approved facts, admins see review queue" on facts
  for select using (
    city_id = current_city_id()
    and (
      (flagged = false and review_status != 'rejected')
      or review_status = 'approved'
      or exists (select 1 from app_users where id = auth.uid() and role = 'admin')
    )
  );
