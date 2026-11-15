import { useState, useRef, useEffect } from 'react';
import { Send, ArrowUp } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
  }, [text]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-gradient-to-r from-primary-500/20 to-accent-500/20 rounded-2xl blur-lg opacity-60" />
      <div className="relative flex items-end gap-2 bg-surface-lighter border border-white/10 rounded-2xl p-2 focus-within:border-primary-500/40 transition-colors">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          placeholder="Message NUTTERX-AI..."
          className="flex-1 bg-transparent text-white placeholder-white/40 text-sm md:text-base resize-none outline-none px-3 py-2.5 max-h-40 scrollbar-thin disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || disabled}
          className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-transform glow-purple"
          aria-label="Send message"
        >
          <ArrowUp size={20} strokeWidth={2.5} />
        </button>
      </div>
      <p className="text-center text-xs text-white/30 mt-2">
        Press Enter to send, Shift + Enter for new line
      </p>
    </div>
  );
}
