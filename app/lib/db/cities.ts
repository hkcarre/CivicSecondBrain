import { getServiceRoleClient } from "./supabase";
import { getCityName, getCityState } from "../env";
import { cityToSlug } from "../city-slug";

/**
 * Resolves this deployment's city_id from the NEXT_PUBLIC_CITY_NAME/STATE
 * env pair (same identity source used everywhere else in the app — see
 * app/lib/env.ts). Throws a clear, actionable error rather than a raw DB
 * error if the city hasn't been seeded yet.
 */
export async function getCurrentCityId(): Promise<string> {
  const slug = cityToSlug(getCityName(), getCityState());
  const client = getServiceRoleClient();
  const { data, error } = await client
    .from("cities")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to look up city "${slug}": ${error.message}`);
  }
  if (!data) {
    throw new Error(
      `No city row found for slug "${slug}". Seed it first: insert into cities (slug, name, state) values ('${slug}', '${getCityName()}', '${getCityState()}').`
    );
  }
  return data.id as string;
}
