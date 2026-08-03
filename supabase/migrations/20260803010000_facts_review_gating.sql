-- Fix: the original "read own city facts" policy let any city member read
-- every fact regardless of flagged/review_status, contradicting the
-- validation-layer guardrail ("low-confidence or flagged facts route to a
-- manual-review queue before reaching charts/forecasts"). This tightens it
-- to match the pattern already used for `recommendations`: non-admins see
-- only unflagged facts; admins see everything (needed for the review
-- queue UI).

drop policy "read own city facts" on facts;

create policy "read unflagged facts, admins see review queue" on facts
  for select using (
    city_id = current_city_id()
    and (
      flagged = false
      or exists (select 1 from app_users where id = auth.uid() and role = 'admin')
    )
  );
