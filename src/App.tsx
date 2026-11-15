
import { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, Sparkles, Zap, Brain, Shield } from 'lucide-react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { getAIResponse } from '@/lib/ai';
import type { Chat, Message } from '@/types';
import Logo from '@/components/Logo';
import Sidebar from '@/components/Sidebar';
import ChatMessage from '@/components/ChatMessage';
import ChatInput from '@/components/ChatInput';
import TypingIndicator from '@/components/TypingIndicator';
import AuthModal from '@/components/AuthModal';

const SUGGESTIONS = [
  { icon: Sparkles, text: 'Explain quantum computing in simple terms' },
  { icon: Brain, text: 'Help me write a creative story about space' },
  { icon: Zap, text: 'What are the best productivity tips?' },
  { icon: Shield, text: 'How do I stay safe online?' },
];

function ChatApp() {
  const { user, loading } = useAuth();

  const [authOpen, setAuthOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [deletingChatIds, setDeletingChatIds] = useState<string[]>([]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const appContainerRef = useRef<HTMLDivElement>(null);

  // Keep the application fitted to the visible mobile viewport.
  useEffect(() => {
    const app = appContainerRef.current;
    if (!app) return;

    const viewport = window.visualViewport;

    const updateViewport = () => {
      const height = viewport?.height ?? window.innerHeight;
      const top = viewport?.offsetTop ?? 0;

      app.style.height = `${height}px`;
      app.style.top = `${top}px`;
    };

    updateViewport();

    window.addEventListener('resize', updateViewport);
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
    };
  }, []);

  // Load conversation history without automatically opening a recent chat.
  useEffect(() => {
    if (!user) {
      setChats([]);
      setActiveChatId(null);
      setMessages([]);
      setDeletingChatIds([]);
      return;
    }

    let cancelled = false;

    setActiveChatId(null);
    setMessages([]);
    setChats([]);

    (async () => {
      try {
        const userChats = await api.listChats();

        if (cancelled) return;

        setChats(userChats);
      } catch (error) {
        if (!cancelled) {
          console.error('Could not load chats:', error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Load messages only when the user selects an existing chat.
  useEffect(() => {
    if (!activeChatId || !user) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    let cancelled = false;

    setLoadingMessages(true);

    (async () => {
      try {
        const msgs = await api.listMessages(activeChatId);

        if (!cancelled) {
          setMessages(msgs);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Could not load messages:', error);
          setMessages([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingMessages(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeChatId, user]);

  // Scroll the conversation container as messages arrive.
  useEffect(() => {
    const container = messagesContainerRef.current;

    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior: typing ? 'auto' : 'smooth',
    });
  }, [messages, typing]);

  // Start a new empty conversation.
  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setMessages([]);
    setSidebarOpen(false);
  }, []);

  // Open an existing conversation.
  const handleSelectChat = useCallback((chatId: string) => {
    setActiveChatId(chatId);
    setSidebarOpen(false);
  }, []);

  // Delete a chat and its messages.
  const handleDeleteChat = useCallback(async (chatId: string) => {
    if (deletingChatIds.includes(chatId)) return;

    const chat = chats.find((item) => item.id === chatId);

    const confirmed = window.confirm(
      `Are you sure you want to delete "${chat?.title ?? 'this chat'}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setDeletingChatIds((prev) => [...prev, chatId]);

    try {
      await api.deleteChat(chatId);

      setChats((prev) => prev.filter((item) => item.id !== chatId));

      if (activeChatId === chatId) {
        setActiveChatId(null);
        setMessages([]);
      }
    } catch (error) {
      console.error('Delete chat failed:', error);

      window.alert(
        error instanceof Error
          ? `Could not delete chat: ${error.message}`
          : 'Could not delete chat. Please try again.'
      );
    } finally {
      setDeletingChatIds((prev) =>
        prev.filter((id) => id !== chatId)
      );
    }
  }, [activeChatId, chats, deletingChatIds]);

  // Send a message and stream the AI response.
  const handleSend = useCallback(async (text: string) => {
    if (!user) {
      setAuthOpen(true);
      return;
    }

    let currentChatId = activeChatId;

    // Create a database chat only when the first message is sent.
    if (!currentChatId) {
      const title = text.length > 40
        ? text.slice(0, 40) + '...'
        : text;

      try {
        const newChat = await api.createChat(title);
        currentChatId = newChat.id;

        setChats((prev) => [newChat, ...prev]);
        setActiveChatId(currentChatId);
      } catch (error) {
        console.error('Could not create chat:', error);
        window.alert('Could not create a new chat. Please try again.');
        return;
      }
    }

    // Save the user's message.
    let userMessage: Message;

    try {
      userMessage = await api.createMessage(
        currentChatId,
        'user',
        text
      );

      setMessages((prev) => [...prev, userMessage]);
    } catch (error) {
      console.error('Could not save message:', error);
      window.alert('Your message could not be saved. Please try again.');
      return;
    }

    setTyping(true);

    // Add an empty assistant message immediately.
    const assistantMessageId = `ai-${Date.now()}`;

    const initialAssistantMessage: Message = {
      id: assistantMessageId,
      chat_id: currentChatId,
      role: 'assistant',
      content: '',
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, initialAssistantMessage]);

    let streamedReply = '';

    try {
      const allMessages = [...messages, userMessage];

      const { reply, error } = await getAIResponse(
        allMessages,
        (chunk) => {
          streamedReply += chunk;

          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? {
                    ...message,
                    content: streamedReply,
                  }
                : message
            )
          );
        }
      );

      if (error || !reply) {
        const errorContent =
          streamedReply.trim()
            ? `${streamedReply}\n\n[Response interrupted: ${error ?? 'Please try again.'}]`
            : `Sorry, I couldn't process that request. ${error ?? 'Please try again.'}`;

        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: errorContent,
                }
              : message
          )
        );

        return;
      }

      // Save the completed assistant response.
      try {
        const aiMsg = await api.createMessage(
          currentChatId,
          'assistant',
          reply
        );

        // Replace the temporary streaming message with the saved message.
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? aiMsg
              : message
          )
        );
      } catch (error) {
        console.error('Could not save AI response:', error);

        // Keep the streamed reply visible if saving fails.
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: reply,
                }
              : message
          )
        );
      }
    } catch (error) {
      console.error('AI response failed:', error);

      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                content: streamedReply.trim()
                  ? `${streamedReply}\n\n[Response interrupted. Please try again.]`
                  : 'Sorry, something went wrong while generating your response. Please try again.',
              }
            : message
        )
      );
    } finally {
      setTyping(false);
    }
  }, [user, activeChatId, messages]);

  if (loading) {
    return (
      <div className="fixed inset-0 h-[100dvh] bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 animate-pulse glow-purple" />
          <p className="text-white/50 text-sm">Loading NUTTERX-AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={appContainerRef}
      className="fixed left-0 right-0 top-0 flex w-full min-h-0 bg-surface overflow-hidden overscroll-none"
      style={{ height: '100dvh' }}
    >
      {user && (
        <Sidebar
          chats={chats}
          activeChatId={activeChatId}
          onSelectChat={handleSelectChat}
          onNewChat={handleNewChat}
          onDeleteChat={handleDeleteChat}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden relative bg-grid">

        {/* Fixed navigation header */}
        <header className="relative z-20 flex shrink-0 items-center gap-3 px-4 md:px-6 h-16 min-h-16 border-b border-white/10 bg-surface/95 backdrop-blur-md">
          {user && (
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden text-white/60 hover:text-white transition-colors"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
          )}

          <div className="flex-1 flex items-center gap-3">
            <Logo size={user ? 'sm' : 'md'} />
          </div>

          {user && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-white/60 font-medium">
                Online
              </span>
            </div>
          )}
        </header>

        {/* Only the conversation area scrolls */}
        <div
          ref={messagesContainerRef}
          className="flex-1 min-h-0 w-full overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-thin"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {!user ? (
            <WelcomeLanding onGetStarted={() => setAuthOpen(true)} />
          ) : messages.length === 0 && !typing && !loadingMessages ? (
            <WelcomeChat onSuggestion={handleSend} />
          ) : (
            <div className="max-w-3xl mx-auto w-full px-4 md:px-6 py-6 space-y-6">
              {loadingMessages && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
                </div>
              )}

              {messages.map((msg) => (
                <ChatMessage key={msg.id} message={msg} />
              ))}

              {typing && <TypingIndicator />}
            </div>
          )}
        </div>

        {/* Fixed message input area */}
        {user && (
          <div
            className="relative z-30 shrink-0 w-full border-t border-white/10 bg-surface/95 backdrop-blur-md px-3 sm:px-4 md:px-6 pt-3 sm:pt-4"
            style={{
              paddingBottom: 'max(12px, env(safe-area-inset-bottom))',
            }}
          >
            <div className="max-w-3xl mx-auto w-full min-w-0">
              <ChatInput
                onSend={handleSend}
                disabled={typing}
              />
            </div>
          </div>
        )}
      </main>

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
      />
    </div>
  );
}

function WelcomeLanding({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="min-h-full flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 mb-8">
          <Sparkles size={14} className="text-primary-400" />
          <span className="text-xs font-medium text-white/70">
            Powered by Advanced AI
          </span>
        </div>

        <h1 className="font-display text-4xl md:text-6xl font-bold mb-6 leading-tight">
          Your Intelligent
          <br />
          <span className="text-gradient">AI Companion</span>
        </h1>

        <p className="text-lg text-white/50 mb-10 max-w-xl mx-auto leading-relaxed">
          NUTTERX-AI helps you brainstorm, write, learn, and explore ideas with
          lightning-fast, intelligent responses.
        </p>

        <button
          type="button"
          onClick={onGetStarted}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-primary-500 to-accent-500 text-white font-medium hover:opacity-90 transition-opacity glow-purple"
        >
          Get Started Free
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16">
          {[
            { icon: Zap, title: 'Lightning Fast', desc: 'Instant responses' },
            { icon: Brain, title: 'Smart Answers', desc: 'Context-aware AI' },
            { icon: Shield, title: 'Secure Chats', desc: 'Your data is private' },
          ].map((feature) => (
            <div
              key={feature.title}
              className="p-5 rounded-xl bg-surface-lighter/50 border border-white/5 text-left"
            >
              <feature.icon size={22} className="text-primary-400 mb-3" />
              <h3 className="font-medium text-white text-sm mb-1">
                {feature.title}
              </h3>
              <p className="text-xs text-white/40">{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WelcomeChat({ onSuggestion }: { onSuggestion: (text: string) => void }) {
  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-12">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center mb-6 glow-purple">
        <img
          src="/nutterx-brand-logo.png"
          alt="NUTTERX-AI"
          draggable={false}
          className="w-12 h-12 object-contain"
        />
      </div>

      <h2 className="font-display text-2xl md:text-3xl font-bold mb-2">
        How can I help you today?
      </h2>

      <p className="text-white/40 text-sm mb-8 text-center max-w-md">
        Ask me anything, or try one of the suggestions below to get started.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
        {SUGGESTIONS.map((suggestion) => (
          <button
            type="button"
            key={suggestion.text}
            onClick={() => onSuggestion(suggestion.text)}
            className="flex items-center gap-3 p-4 rounded-xl bg-surface-lighter/50 border border-white/10 hover:border-primary-500/30 hover:bg-surface-lightest/50 text-left transition-all group"
          >
            <div className="w-9 h-9 rounded-lg bg-primary-500/15 flex items-center justify-center shrink-0 group-hover:bg-primary-500/25 transition-colors">
              <suggestion.icon size={18} className="text-primary-400" />
            </div>

            <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">
              {suggestion.text}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ChatApp />
    </AuthProvider>
  );
}
