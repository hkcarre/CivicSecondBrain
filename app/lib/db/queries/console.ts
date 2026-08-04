/**
 * Cross-city queries for the Strata Operator Console (app/console/).
 *
 * Unlike every other query module in this app, these deliberately read
 * ACROSS city_id boundaries — that's the entire point of this console. Never
 * reuse these from any city-facing page; they exist only behind the
 * is_strata_admin gate in app/console/layout.tsx.
 *
 * Uses the service-role client (bypasses RLS) rather than a parallel set of
 * cross-city RLS policies — the access control happens once, at the
 * application layer, for a tool only a couple of trusted Strata staff will
 * ever reach. Aggregation happens in JS rather than SQL — data volumes at
 * this MVP scale (a handful of cities, dozens of users) don't warrant a
 * Postgres view/RPC yet.
 */

import { getServiceRoleClient } from "../supabase";
import { createServerSupabaseClient } from "../supabase-server";

export interface MunicipalitySummary {
  cityId: string;
  name: string;
  state: string;
  userCount: number;
  conversationCount: number;
  messageCount: number;
  factCount: number;
  lastActivity: string | null;
}

export interface UserSummary {
  userId: string;
  email: string;
  cityName: string;
  role: string;
  messageCount: number;
  lastActive: string | null;
  createdAt: string;
}

export interface UsagePoint {
  date: string; // YYYY-MM-DD
  cityName: string;
  messageCount: number;
}

/** Checks the CURRENT signed-in user's is_strata_admin flag. Returns false (never throws) for signed-out or misconfigured sessions — callers should treat "not admin" and "not signed in" identically: redirect away. */
export async function currentUserIsStrataAdmin(): Promise<boolean> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const service = getServiceRoleClient();
    const { data } = await service
      .from("app_users")
      .select("is_strata_admin")
      .eq("id", user.id)
      .maybeSingle();
    return data?.is_strata_admin === true;
  } catch {
    return false;
  }
}

export async function listMunicipalities(): Promise<MunicipalitySummary[]> {
  const client = getServiceRoleClient();

  const [{ data: cities }, { data: users }, { data: conversations }, { data: messages }, { data: facts }] =
    await Promise.all([
      client.from("cities").select("id, name, state"),
      client.from("app_users").select("id, city_id"),
      client.from("conversations").select("id, city_id"),
      client.from("messages").select("id, conversation_id, created_at, conversation:conversations(city_id)"),
      client.from("facts").select("id, city_id"),
    ]);

  return (cities ?? []).map((city) => {
    const cityUsers = (users ?? []).filter((u) => u.city_id === city.id);
    const cityConversationIds = new Set(
      (conversations ?? []).filter((c) => c.city_id === city.id).map((c) => c.id)
    );
    const cityMessages = (messages ?? []).filter((m) => cityConversationIds.has(m.conversation_id));
    const lastActivity = cityMessages
      .map((m) => m.created_at as string)
      .sort()
      .at(-1);

    return {
      cityId: city.id,
      name: city.name,
      state: city.state,
      userCount: cityUsers.length,
      conversationCount: cityConversationIds.size,
      messageCount: cityMessages.length,
      factCount: (facts ?? []).filter((f) => f.city_id === city.id).length,
      lastActivity: lastActivity ?? null,
    };
  });
}

export async function listUsers(): Promise<UserSummary[]> {
  const client = getServiceRoleClient();

  const [{ data: appUsers }, { data: cities }, { data: conversations }, { data: messages }, authUsersResult] =
    await Promise.all([
      client.from("app_users").select("id, city_id, role, created_at"),
      client.from("cities").select("id, name"),
      client.from("conversations").select("id, owner_id"),
      client.from("messages").select("id, conversation_id, created_at"),
      client.auth.admin.listUsers(),
    ]);

  const cityNameById = new Map((cities ?? []).map((c) => [c.id, c.name]));
  const emailById = new Map((authUsersResult.data?.users ?? []).map((u) => [u.id, u.email ?? "(no email)"]));
  const conversationsByOwner = new Map<string, string[]>();
  for (const c of conversations ?? []) {
    const list = conversationsByOwner.get(c.owner_id) ?? [];
    list.push(c.id);
    conversationsByOwner.set(c.owner_id, list);
  }
  const messagesByConversation = new Map<string, { created_at: string }[]>();
  for (const m of messages ?? []) {
    const list = messagesByConversation.get(m.conversation_id) ?? [];
    list.push({ created_at: m.created_at });
    messagesByConversation.set(m.conversation_id, list);
  }

  return (appUsers ?? []).map((u) => {
    const ownConversationIds = conversationsByOwner.get(u.id) ?? [];
    const ownMessages = ownConversationIds.flatMap((cid) => messagesByConversation.get(cid) ?? []);
    const lastActive = ownMessages
      .map((m) => m.created_at)
      .sort()
      .at(-1);

    return {
      userId: u.id,
      email: emailById.get(u.id) ?? "(unknown)",
      cityName: cityNameById.get(u.city_id) ?? "(unknown)",
      role: u.role,
      messageCount: ownMessages.length,
      lastActive: lastActive ?? null,
      createdAt: u.created_at,
    };
  });
}

/** Daily message counts per city over the last `days` days, for the usage chart. */
export async function getUsageByCity(days = 30): Promise<UsagePoint[]> {
  const client = getServiceRoleClient();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: cities }, { data: conversations }, { data: messages }] = await Promise.all([
    client.from("cities").select("id, name"),
    client.from("conversations").select("id, city_id"),
    client.from("messages").select("conversation_id, created_at").gte("created_at", since),
  ]);

  const cityIdByConversation = new Map((conversations ?? []).map((c) => [c.id, c.city_id]));
  const cityNameById = new Map((cities ?? []).map((c) => [c.id, c.name]));

  const counts = new Map<string, number>(); // key: `${date}::${cityName}`
  for (const m of messages ?? []) {
    const cityId = cityIdByConversation.get(m.conversation_id);
    const cityName = cityId ? cityNameById.get(cityId) : undefined;
    if (!cityName) continue;
    const date = (m.created_at as string).slice(0, 10);
    const key = `${date}::${cityName}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([key, messageCount]) => {
    const [date, cityName] = key.split("::");
    return { date, cityName, messageCount };
  });
}
