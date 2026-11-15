
import { Plus, MessageSquare, Trash2, X, LogOut } from 'lucide-react';
import type { Chat } from '@/types';
import Logo from './Logo';
import { useAuth } from '@/context/AuthContext';

interface SidebarProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  open,
  onClose,
}: SidebarProps) {
  const { user, signOut } = useAuth();

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40
          w-72 bg-surface-light border-r border-white/10
          flex flex-col transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        {/* Sidebar header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <Logo size="sm" />

          <button
            type="button"
            onClick={onClose}
            className="md:hidden text-white/40 hover:text-white transition-colors p-2"
            aria-label="Close sidebar"
          >
            <X size={20} />
          </button>
        </div>

        {/* New chat button */}
        <div className="p-3">
          <button
            type="button"
            onClick={onNewChat}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gradient-to-r from-primary-500/20 to-accent-500/20 border border-primary-500/30 hover:border-primary-500/50 text-white font-medium text-sm transition-all hover:glow-purple"
          >
            <Plus size={18} className="text-primary-400" />
            New Chat
          </button>
        </div>

        {/* Chat history */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-3">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider px-2 mb-2 mt-2">
            Chat History
          </p>

          {chats.length === 0 ? (
            <p className="text-sm text-white/30 px-2 py-4 text-center">
              No chats yet. Start a new conversation!
            </p>
          ) : (
            <div className="space-y-1">
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`
                    group flex items-center gap-2.5 px-3 py-2.5 rounded-lg
                    cursor-pointer transition-all
                    ${
                      activeChatId === chat.id
                        ? 'bg-primary-500/15 border border-primary-500/30'
                        : 'hover:bg-white/5 border border-transparent'
                    }
                  `}
                  onClick={() => onSelectChat(chat.id)}
                >
                  <MessageSquare
                    size={16}
                    className={
                      activeChatId === chat.id
                        ? 'text-primary-400'
                        : 'text-white/40'
                    }
                  />

                  <span className="flex-1 text-sm text-white/80 truncate">
                    {chat.title}
                  </span>

                  {/* Delete button: always visible on mobile */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteChat(chat.id);
                    }}
                    className="shrink-0 p-2 rounded-md opacity-100 md:opacity-0 md:group-hover:opacity-100 text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
                    aria-label={`Delete ${chat.title}`}
                    title="Delete chat"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* User account section */}
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-sm font-semibold text-white">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>

            <span className="flex-1 text-sm text-white/70 truncate">
              {user?.email}
            </span>

            <button
              type="button"
              onClick={signOut}
              className="text-white/40 hover:text-red-400 transition-colors p-2"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
