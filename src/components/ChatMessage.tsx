import { useState } from 'react';
import { User, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
    <div className="my-4 overflow-hidden rounded-xl border border-white/10 bg-[#0d0d18]">
      <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-2">
        <span className="text-xs font-medium uppercase tracking-wider text-white/50">
          {language || 'code'}
        </span>

        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code"
          className="flex items-center gap-1.5 text-xs text-white/50 transition-colors hover:text-white"
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

      <pre className="overflow-x-auto p-4 text-sm leading-relaxed scrollbar-thin">
        <code className="font-mono text-primary-200">{code}</code>
      </pre>
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="mb-4 mt-6 text-xl font-bold text-white first:mt-0">
            {children}
          </h1>
        ),

        h2: ({ children }) => (
          <h2 className="mb-3 mt-6 text-lg font-bold text-white first:mt-0">
            {children}
          </h2>
        ),

        h3: ({ children }) => (
          <h3 className="mb-2 mt-5 text-base font-semibold text-white first:mt-0">
            {children}
          </h3>
        ),

        h4: ({ children }) => (
          <h4 className="mb-2 mt-4 font-semibold text-white">
            {children}
          </h4>
        ),

        p: ({ children }) => (
          <p className="mb-3 leading-7 text-white/90 last:mb-0">
            {children}
          </p>
        ),

        strong: ({ children }) => (
          <strong className="font-semibold text-white">
            {children}
          </strong>
        ),

        em: ({ children }) => (
          <em className="text-white/90">{children}</em>
        ),

        ul: ({ children }) => (
          <ul className="mb-4 ml-5 list-disc space-y-2 text-white/90 marker:text-primary-400">
            {children}
          </ul>
        ),

        ol: ({ children }) => (
          <ol className="mb-4 ml-5 list-decimal space-y-2 text-white/90 marker:font-semibold marker:text-primary-300">
            {children}
          </ol>
        ),

        li: ({ children }) => (
          <li className="pl-1 leading-7">{children}</li>
        ),

        blockquote: ({ children }) => (
          <blockquote className="my-4 border-l-4 border-primary-400/70 pl-4 text-white/70">
            {children}
          </blockquote>
        ),

        hr: () => <hr className="my-5 border-white/10" />,

        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-300 underline decoration-primary-300/40 underline-offset-4 transition-colors hover:text-primary-200"
          >
            {children}
          </a>
        ),

        code: ({ className, children, ...props }) => {
          const languageMatch = /language-(\w+)/.exec(className || '');
          const code = String(children).replace(/\n$/, '');

          if (languageMatch) {
            return (
              <CodeBlock
                language={languageMatch[1]}
                code={code}
              />
            );
          }

          return (
            <code
              {...props}
              className="rounded-md bg-primary-500/15 px-1.5 py-0.5 font-mono text-sm text-primary-300"
            >
              {children}
            </code>
          );
        },

        pre: ({ children }) => <>{children}</>,

        table: ({ children }) => (
          <div className="my-4 w-full overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full border-collapse text-left text-sm">
              {children}
            </table>
          </div>
        ),

        thead: ({ children }) => (
          <thead className="bg-white/10 text-white">
            {children}
          </thead>
        ),

        tbody: ({ children }) => (
          <tbody className="divide-y divide-white/10">
            {children}
          </tbody>
        ),

        tr: ({ children }) => (
          <tr className="border-b border-white/10 last:border-b-0">
            {children}
          </tr>
        ),

        th: ({ children }) => (
          <th className="whitespace-nowrap px-4 py-3 font-semibold text-white">
            {children}
          </th>
        ),

        td: ({ children }) => (
          <td className="min-w-[120px] px-4 py-3 align-top leading-6 text-white/80">
            {children}
          </td>
        ),

        img: ({ src, alt }) => (
          <img
            src={src}
            alt={alt || 'Image'}
            loading="lazy"
            className="my-3 max-h-96 max-w-full rounded-xl object-contain"
          />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex animate-fade-in items-start justify-end gap-3">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-gradient-to-br from-primary-600 to-primary-500 px-4 py-3 text-white glow-purple md:max-w-[70%]">
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed md:text-base">
            {message.content}
          </p>
        </div>

        <div className="flex-shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-surface-lightest">
            <User size={18} className="text-white/70" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex animate-fade-in items-start gap-3">
      <div className="flex-shrink-0">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white">
          <img
            src="/nutterx-brand-logo.png"
            alt="NUTTERX-AI"
            draggable={false}
            className="h-full w-full object-contain p-0.5"
          />
        </div>
      </div>

      <div className="min-w-0 max-w-[85%] overflow-hidden rounded-2xl rounded-tl-sm border border-white/10 bg-surface-lighter/80 px-4 py-3 md:max-w-[75%]">
        <div className="break-words text-sm leading-relaxed text-white/90 md:text-base">
          <MarkdownContent content={message.content} />
        </div>
      </div>
    </div>
  );
}