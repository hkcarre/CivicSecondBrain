"use client";

import { useEffect, useState, useCallback } from "react";
import { clsx } from "clsx";
import { Plus, FolderPlus, Folder, MessageSquare, ChevronDown, ChevronRight } from "lucide-react";

interface Project {
  id: string;
  name: string;
}

interface Conversation {
  id: string;
  projectId: string | null;
  title: string;
  updatedAt: string;
}

interface ConversationSidebarProps {
  activeConversationId: string | null;
  onSelectConversation: (id: string) => void;
  /** Bumped by the parent whenever it creates a conversation itself (e.g. lazily on first message), so the list refetches. */
  refreshKey: number;
}

export function ConversationSidebar({
  activeConversationId,
  onSelectConversation,
  refreshKey,
}: ConversationSidebarProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [newProjectName, setNewProjectName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    try {
      const [projectsRes, conversationsRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/conversations"),
      ]);
      if (projectsRes.ok) setProjects((await projectsRes.json()).projects);
      if (conversationsRes.ok) setConversations((await conversationsRes.json()).conversations);
    } catch {
      // Signed-out or Supabase not configured — sidebar just stays empty; the
      // chat page itself still works via its localStorage fallback.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount/refresh; refetch's setState calls happen after an await, not synchronously
    void refetch();
  }, [refetch, refreshKey]);

  async function handleNewChat() {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) return;
    const { conversation } = await res.json();
    setConversations((prev) => [conversation, ...prev]);
    onSelectConversation(conversation.id);
  }

  async function handleCreateProject(e: React.FormEvent) {
    e.preventDefault();
    const name = newProjectName?.trim();
    if (!name) return;
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNewProjectName(null);
    if (!res.ok) return;
    const { project } = await res.json();
    setProjects((prev) => [project, ...prev]);
    setExpandedProjects((prev) => new Set(prev).add(project.id));
  }

  function toggleProject(id: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700" />;
  }

  const unassigned = conversations.filter((c) => !c.projectId);

  return (
    <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col h-full">
      <div className="p-3 space-y-1.5 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm font-medium
                     text-white bg-city-maroon hover:opacity-90 transition-colors"
        >
          <Plus size={14} />
          New chat
        </button>
        {newProjectName === null ? (
          <button
            onClick={() => setNewProjectName("")}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm
                       text-gray-500 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors"
          >
            <FolderPlus size={14} />
            New project
          </button>
        ) : (
          <form onSubmit={handleCreateProject} className="px-0.5">
            <input
              autoFocus
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onBlur={() => !newProjectName && setNewProjectName(null)}
              placeholder="Project name"
              className="w-full px-2 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600
                         bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-city-navy"
            />
          </form>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-3">
        {projects.map((project) => {
          const projectConvos = conversations.filter((c) => c.projectId === project.id);
          const expanded = expandedProjects.has(project.id);
          return (
            <div key={project.id}>
              <button
                onClick={() => toggleProject(project.id)}
                className="w-full flex items-center gap-1.5 px-1.5 py-1 rounded-md text-xs font-semibold
                           text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-gray-800 transition-colors"
              >
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Folder size={12} className="text-city-maroon" />
                <span className="truncate">{project.name}</span>
              </button>
              {expanded && (
                <div className="ml-4 mt-0.5 space-y-0.5">
                  {projectConvos.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-gray-500 px-1.5 py-1">No chats yet</p>
                  ) : (
                    projectConvos.map((c) => (
                      <ConversationRow
                        key={c.id}
                        conversation={c}
                        active={c.id === activeConversationId}
                        onSelect={onSelectConversation}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}

        {unassigned.length > 0 && (
          <div>
            {projects.length > 0 && (
              <p className="px-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-0.5">
                Other chats
              </p>
            )}
            <div className="space-y-0.5">
              {unassigned.map((c) => (
                <ConversationRow
                  key={c.id}
                  conversation={c}
                  active={c.id === activeConversationId}
                  onSelect={onSelectConversation}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ConversationRow({
  conversation,
  active,
  onSelect,
}: {
  conversation: Conversation;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(conversation.id)}
      className={clsx(
        "w-full flex items-center gap-1.5 px-1.5 py-1.5 rounded-md text-sm text-left transition-colors truncate",
        active
          ? "bg-city-navy/10 dark:bg-city-maroon/20 text-city-navy dark:text-city-maroon font-medium"
          : "text-gray-600 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-gray-800"
      )}
    >
      <MessageSquare size={13} className="flex-shrink-0" />
      <span className="truncate">{conversation.title}</span>
    </button>
  );
}
