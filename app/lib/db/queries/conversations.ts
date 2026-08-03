/**
 * Curated read/write layer for chat projects/conversations/messages.
 * Unlike metrics.ts (service-role, city-scoped), this always uses the
 * session-scoped server client — every function operates on "the current
 * signed-in user's own" rows, enforced by RLS (see the "manage own
 * projects/conversations/messages" policies in the schema migration), not
 * by an explicit owner_id filter here. There is no service-role variant:
 * conversations are inherently a single-user's private data.
 */

import { createServerSupabaseClient } from "../supabase-server";
import type { Citation } from "@/types";

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  projectId: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  pagesUsed: string[];
  createdAt: string;
}

async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

export async function listProjects(): Promise<Project[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("projects")
    .select("id, name, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`Failed to list projects: ${error.message}`);
  return (data ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  }));
}

export async function createProject(name: string): Promise<Project> {
  const { supabase, user } = await requireUser();
  const cityId = await getUserCityId(supabase, user.id);

  const { data, error } = await supabase
    .from("projects")
    .insert({ name, owner_id: user.id, city_id: cityId })
    .select("id, name, created_at, updated_at")
    .single();

  if (error) throw new Error(`Failed to create project: ${error.message}`);
  return { id: data.id, name: data.name, createdAt: data.created_at, updatedAt: data.updated_at };
}

export async function listConversations(projectId?: string | null): Promise<Conversation[]> {
  const { supabase } = await requireUser();
  let query = supabase
    .from("conversations")
    .select("id, project_id, title, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (projectId !== undefined) {
    query = projectId === null ? query.is("project_id", null) : query.eq("project_id", projectId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list conversations: ${error.message}`);
  return (data ?? []).map((c) => ({
    id: c.id,
    projectId: c.project_id,
    title: c.title,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));
}

export async function createConversation(
  title = "New conversation",
  projectId: string | null = null
): Promise<Conversation> {
  const { supabase, user } = await requireUser();
  const cityId = await getUserCityId(supabase, user.id);

  const { data, error } = await supabase
    .from("conversations")
    .insert({ title, project_id: projectId, owner_id: user.id, city_id: cityId })
    .select("id, project_id, title, created_at, updated_at")
    .single();

  if (error) throw new Error(`Failed to create conversation: ${error.message}`);
  return {
    id: data.id,
    projectId: data.project_id,
    title: data.title,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function getConversationMessages(conversationId: string): Promise<StoredMessage[]> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, citations, pages_used, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`Failed to load messages: ${error.message}`);
  return (data ?? []).map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    citations: (m.citations as Citation[]) ?? [],
    pagesUsed: (m.pages_used as string[]) ?? [],
    createdAt: m.created_at,
  }));
}

export async function appendMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  options?: { citations?: Citation[]; pagesUsed?: string[] }
): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    role,
    content,
    citations: options?.citations ?? [],
    pages_used: options?.pagesUsed ?? [],
  });
  if (error) throw new Error(`Failed to save message: ${error.message}`);

  // Bump the conversation's updated_at so listConversations sorts by
  // recent activity, not just creation time.
  await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
}

/**
 * Resolves the signed-in user's city_id from their app_users row (created
 * by the on_auth_user_created trigger at signup). Needed because
 * projects/conversations are city_id-scoped even though RLS enforcement
 * for them keys off owner_id — the column is still required on insert.
 */
async function getUserCityId(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string
): Promise<string> {
  const { data, error } = await supabase.from("app_users").select("city_id").eq("id", userId).single();
  if (error || !data) {
    throw new Error("No app_users row for the current session — sign-up provisioning may not have run yet.");
  }
  return data.city_id;
}
