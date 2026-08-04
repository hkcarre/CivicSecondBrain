-- Links each municipality to its own live deployment (or null if not yet
-- deployed) so the Strata Console can jump straight to a city's site
-- instead of just showing its stats in isolation.

alter table cities add column deployment_url text;

update cities set deployment_url = 'https://civicsecondbrain-production.up.railway.app' where slug = 'schertz-tx';
