
import { useCallback, useEffect, useState } from 'react';
import {
  Brain,
  BookOpen,
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  RefreshCw,
  Send,
  Lock,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import {
  api,
  type PersonalMemory,
  type SharedKnowledge,
} from '@/lib/api';

interface MemoryKnowledgePanelProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'memory' | 'knowledge' | 'moderation';

type ApprovedKnowledge = Awaited<
  ReturnType<typeof api.listApprovedKnowledge>
>[number];

export default function MemoryKnowledgePanel({
  open,
  onClose,
}: MemoryKnowledgePanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('memory');

  const [memories, setMemories] = useState<PersonalMemory[]>([]);
  const [myKnowledge, setMyKnowledge] = useState<SharedKnowledge[]>([]);
  const [approvedKnowledge, setApprovedKnowledge] = useState<
    ApprovedKnowledge[]
  >([]);
  const [pendingKnowledge, setPendingKnowledge] = useState<
    SharedKnowledge[]
  >([]);

  const [moderator, setModerator] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [memoryContent, setMemoryContent] = useState('');
  const [memoryCategory, setMemoryCategory] = useState('general');
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(
    null
  );

  const [knowledgeTitle, setKnowledgeTitle] = useState('');
  const [knowledgeContent, setKnowledgeContent] = useState('');
  const [confirmPublic, setConfirmPublic] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [memoryResult, myKnowledgeResult, approvedResult] =
        await Promise.all([
          api.listMemories(),
          api.listMyKnowledge(),
          api.listApprovedKnowledge(),
        ]);

      setMemories(memoryResult);
      setMyKnowledge(myKnowledgeResult);
      setApprovedKnowledge(approvedResult);

      // Ordinary users will receive a permission error here.
      // Only users with moderator permissions can see this tab.
      try {
        const pendingResult = await api.listPendingKnowledge();
        setPendingKnowledge(pendingResult);
        setModerator(true);
      } catch {
        setPendingKnowledge([]);
        setModerator(false);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not load your memory and knowledge.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      void loadData();
    }
  }, [open, loadData]);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  const clearMessages = () => {
    setError('');
    setNotice('');
  };

  const handleSaveMemory = async () => {
    const content = memoryContent.trim();
    const category = memoryCategory.trim() || 'general';

    if (!content) {
      setError('Please enter something to remember.');
      return;
    }

    if (content.length > 1000) {
      setError('A memory cannot exceed 1,000 characters.');
      return;
    }

    if (category.length > 40) {
      setError('The category cannot exceed 40 characters.');
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      if (editingMemoryId) {
        const updated = await api.updateMemory(editingMemoryId, {
          content,
          category,
        });

        setMemories((previous) =>
          previous.map((memory) =>
            memory.id === updated.id ? updated : memory
          )
        );

        setNotice('Memory updated successfully.');
      } else {
        const created = await api.createMemory({
          content,
          category,
        });

        setMemories((previous) => [created, ...previous]);
        setNotice('Memory saved successfully.');
      }

      setMemoryContent('');
      setMemoryCategory('general');
      setEditingMemoryId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save memory.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEditMemory = (memory: PersonalMemory) => {
    setEditingMemoryId(memory.id);
    setMemoryContent(memory.content);
    setMemoryCategory(memory.category);
    clearMessages();
  };

  const cancelMemoryEdit = () => {
    setEditingMemoryId(null);
    setMemoryContent('');
    setMemoryCategory('general');
    clearMessages();
  };

  const handleDeleteMemory = async (memoryId: string) => {
    if (!window.confirm('Delete this personal memory?')) return;

    clearMessages();

    try {
      await api.deleteMemory(memoryId);

      setMemories((previous) =>
        previous.filter((memory) => memory.id !== memoryId)
      );

      if (editingMemoryId === memoryId) {
        cancelMemoryEdit();
      }

      setNotice('Memory deleted.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not delete memory.'
      );
    }
  };

  const handleSubmitKnowledge = async () => {
    const title = knowledgeTitle.trim();
    const content = knowledgeContent.trim();

    if (!title || !content) {
      setError('Please provide both a title and knowledge content.');
      return;
    }

    if (title.length > 120) {
      setError('The title cannot exceed 120 characters.');
      return;
    }

    if (content.length > 3000) {
      setError('Knowledge content cannot exceed 3,000 characters.');
      return;
    }

    if (!confirmPublic) {
      setError('Please confirm that this contribution can be shared publicly.');
      return;
    }

    setSaving(true);
    clearMessages();

    try {
      const created = await api.submitKnowledge({
        title,
        content,
        confirmPublic: true,
      });

      setMyKnowledge((previous) => [created, ...previous]);
      setKnowledgeTitle('');
      setKnowledgeContent('');
      setConfirmPublic(false);

      setNotice(
        'Contribution submitted. It will be available to everyone after moderation.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not submit your contribution.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleModeration = async (
    knowledgeId: string,
    action: 'approve' | 'reject'
  ) => {
    clearMessages();
    setSaving(true);

    try {
      if (action === 'approve') {
        await api.approveKnowledge(knowledgeId);
        setNotice('Contribution approved.');
      } else {
        await api.rejectKnowledge(knowledgeId);
        setNotice('Contribution rejected.');
      }

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not update this contribution.'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const tabs: {
    id: Tab;
    label: string;
    icon: typeof Brain;
  }[] = [
    { id: 'memory', label: 'Personal Memory', icon: Brain },
    { id: 'knowledge', label: 'Shared Knowledge', icon: BookOpen },
    ...(moderator
      ? [{ id: 'moderation' as Tab, label: 'Moderation', icon: ShieldCheck }]
      : []),
  ];

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 backdrop-blur-sm p-2 sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-panel-title"
        className="flex flex-col w-full max-w-3xl max-h-[92dvh] min-h-0 overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary-500/15 flex items-center justify-center shrink-0">
              <Brain size={21} className="text-primary-400" />
            </div>

            <div className="min-w-0">
              <h2
                id="memory-panel-title"
                className="text-base sm:text-lg font-semibold text-white"
              >
                Memory & Knowledge
              </h2>
              <p className="text-xs text-white/40">
                Manage what NUTTERX-AI learns and remembers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 disabled:opacity-40"
              aria-label="Refresh data"
              title="Refresh"
            >
              <RefreshCw
                size={17}
                className={loading ? 'animate-spin' : ''}
              />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
              aria-label="Close panel"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <nav className="flex gap-1 px-3 sm:px-5 pt-3 border-b border-white/10 shrink-0 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = activeTab === tab.id;

            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  clearMessages();
                }}
                className={`flex items-center gap-2 px-3 py-3 text-xs sm:text-sm whitespace-nowrap border-b-2 transition-colors ${
                  selected
                    ? 'border-primary-400 text-white'
                    : 'border-transparent text-white/45 hover:text-white/80'
                }`}
              >
                <Icon size={16} />
                {tab.label}
                {tab.id === 'moderation' && pendingKnowledge.length > 0 && (
                  <span className="rounded-full bg-amber-500/15 text-amber-300 px-2 py-0.5 text-[10px]">
                    {pendingKnowledge.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"
            >
              <AlertCircle size={17} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-green-500/20 bg-green-500/10 p-3 text-sm text-green-300"
            >
              <CheckCircle2 size={17} className="shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw
                size={25}
                className="animate-spin text-primary-400"
              />
            </div>
          ) : (
            <>
              {activeTab === 'memory' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">
                      Personal Memory
                    </h3>
                    <p className="text-xs text-white/45 leading-relaxed">
                      Save useful details you want NUTTERX-AI to remember
                      when helping you in future conversations.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                    <label className="block text-xs text-white/60">
                      What should NUTTERX-AI remember?
                      <textarea
                        value={memoryContent}
                        onChange={(event) =>
                          setMemoryContent(event.target.value)
                        }
                        maxLength={1000}
                        rows={3}
                        placeholder="Example: I prefer explanations with practical examples."
                        className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-primary-500/50"
                      />
                    </label>

                    <div className="flex flex-col sm:flex-row gap-3">
                      <label className="flex-1 text-xs text-white/60">
                        Category
                        <input
                          value={memoryCategory}
                          onChange={(event) =>
                            setMemoryCategory(event.target.value)
                          }
                          maxLength={40}
                          placeholder="general"
                          className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white outline-none focus:border-primary-500/50"
                        />
                      </label>

                      <div className="flex items-end gap-2">
                        {editingMemoryId && (
                          <button
                            type="button"
                            onClick={cancelMemoryEdit}
                            className="px-3 py-3 rounded-lg border border-white/10 text-white/60 hover:text-white text-xs"
                          >
                            Cancel
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => void handleSaveMemory()}
                          disabled={saving || !memoryContent.trim()}
                          className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold disabled:opacity-40"
                        >
                          {editingMemoryId ? (
                            <Check size={15} />
                          ) : (
                            <Plus size={15} />
                          )}
                          {editingMemoryId ? 'Update' : 'Save memory'}
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-white/30 text-right">
                      {memoryContent.length}/1000 characters
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">
                        Your saved memories
                      </h3>
                      <span className="text-xs text-white/40">
                        {memories.length} saved
                      </span>
                    </div>

                    {memories.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/10 p-7 text-center">
                        <Brain
                          size={26}
                          className="mx-auto mb-2 text-white/25"
                        />
                        <p className="text-sm text-white/60">
                          No personal memories yet.
                        </p>
                        <p className="text-xs text-white/35 mt-1">
                          Add something above to get started.
                        </p>
                      </div>
                    ) : (
                      memories.map((memory) => (
                        <article
                          key={memory.id}
                          className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span className="inline-block mb-2 rounded-full bg-primary-500/10 border border-primary-500/20 px-2 py-1 text-[10px] text-primary-300">
                                {memory.category}
                              </span>
                              <p className="text-sm text-white/80 whitespace-pre-wrap break-words">
                                {memory.content}
                              </p>
                            </div>

                            <div className="flex gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleEditMemory(memory)}
                                className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10"
                                aria-label="Edit memory"
                              >
                                <Pencil size={15} />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void handleDeleteMemory(memory.id)
                                }
                                className="p-2 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10"
                                aria-label="Delete memory"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>
                        </article>
                      ))
                    )}
                  </div>

                  <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/10 p-3">
                    <Lock
                      size={15}
                      className="text-amber-300 shrink-0 mt-0.5"
                    />
                    <p className="text-[11px] text-white/45 leading-relaxed">
                      Personal memories are intended for your account. Do not
                      save passwords, API keys, financial secrets, or sensitive
                      personal information.
                    </p>
                  </div>
                </div>
              )}

              {activeTab === 'knowledge' && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">
                      Shared Knowledge
                    </h3>
                    <p className="text-xs text-white/45 leading-relaxed">
                      Contribute useful information that could help other
                      NUTTERX-AI users. Contributions are reviewed before
                      becoming public.
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                    <label className="block text-xs text-white/60">
                      Contribution title
                      <input
                        value={knowledgeTitle}
                        onChange={(event) =>
                          setKnowledgeTitle(event.target.value)
                        }
                        maxLength={120}
                        placeholder="Give your knowledge a clear title"
                        className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-primary-500/50"
                      />
                    </label>

                    <label className="block text-xs text-white/60">
                      Knowledge content
                      <textarea
                        value={knowledgeContent}
                        onChange={(event) =>
                          setKnowledgeContent(event.target.value)
                        }
                        maxLength={3000}
                        rows={5}
                        placeholder="Share helpful facts, explanations, tips, or instructions..."
                        className="mt-2 w-full resize-y rounded-lg border border-white/10 bg-black/20 p-3 text-sm text-white placeholder:text-white/25 outline-none focus:border-primary-500/50"
                      />
                    </label>

                    <p className="text-[11px] text-white/30 text-right">
                      {knowledgeContent.length}/3000 characters
                    </p>

                    <label className="flex items-start gap-2 text-xs text-white/60 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmPublic}
                        onChange={(event) =>
                          setConfirmPublic(event.target.checked)
                        }
                        className="mt-0.5 accent-primary-500"
                      />
                      <span>
                        I understand this contribution may become publicly
                        available to other NUTTERX-AI users if approved. I have
                        not included private information or secrets.
                      </span>
                    </label>

                    <button
                      type="button"
                      onClick={() => void handleSubmitKnowledge()}
                      disabled={
                        saving ||
                        !knowledgeTitle.trim() ||
                        !knowledgeContent.trim() ||
                        !confirmPublic
                      }
                      className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-3 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-xs font-semibold disabled:opacity-40"
                    >
                      <Send size={15} />
                      Submit for review
                    </button>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-white">
                      Your contributions
                    </h3>

                    {myKnowledge.length === 0 ? (
                      <p className="text-xs text-white/40 rounded-xl border border-dashed border-white/10 p-6 text-center">
                        You haven't submitted any contributions yet.
                      </p>
                    ) : (
                      myKnowledge.map((item) => (
                        <article
                          key={item.id}
                          className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <h4 className="text-sm font-medium text-white">
                              {item.title}
                            </h4>
                            <StatusBadge status={item.status} />
                          </div>
                          <p className="text-xs text-white/50 whitespace-pre-wrap break-words">
                            {item.content}
                          </p>
                        </article>
                      ))
                    )}
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-white">
                      Approved community knowledge
                    </h3>

                    {approvedKnowledge.length === 0 ? (
                      <p className="text-xs text-white/40 rounded-xl border border-dashed border-white/10 p-6 text-center">
                        No approved community contributions yet.
                      </p>
                    ) : (
                      approvedKnowledge.map((item) => (
                        <article
                          key={item.id}
                          className="rounded-xl border border-white/10 p-4"
                        >
                          <h4 className="text-sm font-medium text-white mb-2">
                            {item.title}
                          </h4>
                          <p className="text-xs text-white/50 whitespace-pre-wrap break-words">
                            {item.content}
                          </p>
                        </article>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'moderation' && moderator && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-1">
                      Community moderation
                    </h3>
                    <p className="text-xs text-white/45">
                      Review contributions before they become available to
                      everyone.
                    </p>
                  </div>

                  {pendingKnowledge.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-white/10 p-8 text-center">
                      <ShieldCheck
                        size={28}
                        className="mx-auto mb-2 text-green-400/60"
                      />
                      <p className="text-sm text-white/60">
                        No contributions waiting for review.
                      </p>
                    </div>
                  ) : (
                    pendingKnowledge.map((item) => (
                      <article
                        key={item.id}
                        className="rounded-xl border border-amber-500/15 bg-amber-500/[0.03] p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-white">
                              {item.title}
                            </h4>
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-white/35">
                              <Clock size={11} />
                              Submitted{' '}
                              {new Date(item.createdAt).toLocaleString()}
                            </div>
                          </div>
                          <StatusBadge status={item.status} />
                        </div>

                        <p className="text-xs text-white/65 whitespace-pre-wrap break-words">
                          {item.content}
                        </p>

                        <div className="flex flex-wrap gap-2 pt-1">
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void handleModeration(item.id, 'approve')
                            }
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/15 border border-green-500/20 text-green-300 hover:bg-green-500/25 text-xs disabled:opacity-40"
                          >
                            <Check size={14} />
                            Approve
                          </button>

                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              void handleModeration(item.id, 'reject')
                            }
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 text-xs disabled:opacity-40"
                          >
                            <X size={14} />
                            Reject
                          </button>
                        </div>
                      </article>
                    ))
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3 border-t border-white/10 shrink-0">
          <p className="text-[10px] text-white/30">
            NUTTERX-AI Memory System
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-xs"
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: SharedKnowledge['status'];
}) {
  const styles = {
    pending: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
    approved: 'bg-green-500/10 border-green-500/20 text-green-300',
    rejected: 'bg-red-500/10 border-red-500/20 text-red-300',
  };

  const labels = {
    pending: 'Pending review',
    approved: 'Approved',
    rejected: 'Rejected',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-1 text-[10px] ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
