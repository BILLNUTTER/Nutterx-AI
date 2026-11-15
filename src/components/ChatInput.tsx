
import { useState, useRef, useEffect } from 'react';
import type { KeyboardEvent } from 'react';
import { ArrowUp } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) return;

    textarea.style.height = 'auto';

    const maxHeight = window.innerWidth < 640 ? 120 : 160;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [text]);

  const handleSend = () => {
    const trimmed = text.trim();

    if (!trimmed || disabled) return;

    onSend(trimmed);
    setText('');

    // Close the mobile keyboard after sending.
    textareaRef.current?.blur();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative w-full min-w-0">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary-500/20 to-accent-500/20 blur-lg opacity-60 pointer-events-none" />

      <div className="relative flex w-full min-w-0 items-end gap-2 rounded-2xl border border-white/10 bg-surface-lighter p-2 transition-colors focus-within:border-primary-500/40">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder="Message NUTTERX-AI..."
          aria-label="Type your message"
          className="min-w-0 min-h-11 max-h-[120px] sm:max-h-40 flex-1 overflow-y-auto touch-pan-y bg-transparent px-3 py-3 text-base text-white placeholder-white/40 outline-none resize-none scrollbar-thin disabled:opacity-50"
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 text-white transition-transform hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 glow-purple"
          aria-label="Send message"
        >
          <ArrowUp size={20} strokeWidth={2.5} />
        </button>
      </div>

      <p className="mt-2 hidden text-center text-xs text-white/30 sm:block">
        Press Enter to send, Shift + Enter for new line
      </p>
    </div>
  );
}
