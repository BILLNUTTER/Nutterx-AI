
import { useState } from 'react';
import { User, Copy, Check } from 'lucide-react';
import type { Message } from '@/types';

interface ChatMessageProps {
  message: Message;
}

interface CodeBlockProps {
  language: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-white/10 bg-[#0d0d18]">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/10">
        <span className="text-xs font-medium text-white/50 uppercase tracking-wider">
          {language || 'code'}
        </span>

        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <Check size={14} className="text-green-400" />
              <span className="text-green-400">Copied</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <pre className="p-4 overflow-x-auto scrollbar-thin text-sm leading-relaxed">
        <code className="font-mono text-primary-200">{code}</code>
      </pre>
    </div>
  );
}

function formatContent(content: string) {
  const segments: React.ReactNode[] = [];

  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index);

      segments.push(
        <TextSegment key={key++} text={textBefore} />
      );
    }

    segments.push(
      <CodeBlock
        key={key++}
        language={match[1]}
        code={match[2].replace(/\n$/, '')}
      />
    );

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    segments.push(
      <TextSegment
        key={key++}
        text={content.slice(lastIndex)}
      />
    );
  }

  return segments;
}

function TextSegment({ text }: { text: string }) {
  const parts = text.split(
  /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g
);

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-semibold text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }

        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 rounded bg-primary-500/15 text-primary-300 text-sm font-mono"
            >
              {part.slice(1, -1)}
            </code>
          );
        }

        if (
          part.startsWith('*') &&
          part.endsWith('*') &&
          part.length > 2
        ) {
          return (
            <em key={i} className="text-white/90">
              {part.slice(1, -1)}
            </em>
          );
        }

        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex items-start gap-3 justify-end animate-fade-in">
        <div className="bg-gradient-to-br from-primary-600 to-primary-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%] md:max-w-[70%] glow-purple">
          <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>

        <div className="flex-shrink-0">
          <div className="w-9 h-9 rounded-lg bg-surface-lightest border border-white/10 flex items-center justify-center">
            <User size={18} className="text-white/70" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <div className="flex-shrink-0">
        <div className="w-9 h-9 rounded-lg bg-white border border-white/10 flex items-center justify-center overflow-hidden">
          <img
            src="/nutterx-brand-logo.png"
            alt="NUTTERX-AI"
            draggable={false}
            className="w-full h-full object-contain p-0.5"
          />
        </div>
      </div>

      <div className="bg-surface-lighter/80 border border-white/10 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] md:max-w-[70%]">
        <div className="text-sm md:text-base leading-relaxed text-white/90">
          {formatContent(message.content)}
        </div>
      </div>
    </div>
  );
}
