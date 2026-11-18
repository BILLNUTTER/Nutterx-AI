import { useState } from 'react';
import { User, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import type { Components } from 'react-markdown';
import type { Message } from '@/types';

interface ChatMessageProps {
  message: Message;
}

interface CodeBlockProps {
  language?: string;
  code: string;
}

function CodeBlock({ language = 'text', code }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        const success = document.execCommand('copy');
        textarea.remove();

        if (!success) throw new Error('Copy failed');
      }

      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  return (
    <div className="my-4 w-full min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#0b0b14] shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.04] px-4 py-2.5">
        <span className="truncate text-[11px] font-semibold uppercase tracking-widest text-white/55">
          {language}
        </span>

        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Code copied' : 'Copy code'}
          className="flex flex-shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
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

      <pre className="max-w-full overflow-x-auto overscroll-x-contain p-4 text-[13px] leading-6 scrollbar-thin scrollbar-thumb-white/10">
        <code className="font-mono text-primary-100">
          {code}
        </code>
      </pre>
    </div>
  );
}

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="mb-4 mt-7 text-2xl font-bold leading-tight text-white first:mt-0">
      {children}
    </h1>
  ),

  h2: ({ children }) => (
    <h2 className="mb-3 mt-7 text-xl font-bold leading-tight text-white first:mt-0">
      {children}
    </h2>
  ),

  h3: ({ children }) => (
    <h3 className="mb-2 mt-6 text-lg font-semibold text-white first:mt-0">
      {children}
    </h3>
  ),

  h4: ({ children }) => (
    <h4 className="mb-2 mt-5 text-base font-semibold text-white">
      {children}
    </h4>
  ),

  p: ({ children }) => (
    <p className="mb-4 break-words leading-7 text-white/85 last:mb-0">
      {children}
    </p>
  ),

  strong: ({ children }) => (
    <strong className="font-bold text-white">{children}</strong>
  ),

  em: ({ children }) => (
    <em className="text-white/90">{children}</em>
  ),

  del: ({ children }) => (
    <del className="text-white/50">{children}</del>
  ),

  ul: ({ children }) => (
    <ul className="mb-4 ml-5 list-disc space-y-2 text-white/85 marker:text-primary-400">
      {children}
    </ul>
  ),

  ol: ({ children }) => (
    <ol className="mb-4 ml-5 list-decimal space-y-2 text-white/85 marker:font-semibold marker:text-primary-300">
      {children}
    </ol>
  ),

  li: ({ children }) => (
    <li className="break-words pl-1 leading-7">{children}</li>
  ),

  blockquote: ({ children }) => (
    <blockquote className="my-5 rounded-r-lg border-l-[3px] border-primary-400 bg-primary-500/[0.06] py-2 pl-4 pr-3 text-white/75">
      {children}
    </blockquote>
  ),

  hr: () => <hr className="my-6 border-white/10" />,

  a: ({ href, children }) => {
    const isExternal =
      href?.startsWith('https://') || href?.startsWith('http://');

    return (
      <a
        href={href}
        target={isExternal ? '_blank' : undefined}
        rel={isExternal ? 'noopener noreferrer' : undefined}
        className="break-words text-primary-300 underline decoration-primary-300/40 underline-offset-4 transition-colors hover:text-primary-200"
      >
        {children}
      </a>
    );
  },

  code: ({ className, children, ...props }) => {
    const languageMatch = /language-([\w-]+)/.exec(className || '');
    const code = String(children).replace(/\n$/, '');

    if (languageMatch || code.includes('\n')) {
      return (
        <CodeBlock
          language={languageMatch?.[1] || 'text'}
          code={code}
        />
      );
    }

    return (
      <code
        {...props}
        className="rounded-md border border-primary-400/10 bg-primary-500/10 px-1.5 py-0.5 font-mono text-[0.9em] text-primary-200"
      >
        {children}
      </code>
    );
  },

  pre: ({ children }) => <>{children}</>,

  table: ({ children }) => (
    <div className="my-5 w-full max-w-full overflow-x-auto overscroll-x-contain rounded-xl border border-white/10">
      <table className="w-full min-w-max border-collapse text-left text-sm">
        {children}
      </table>
    </div>
  ),

  thead: ({ children }) => (
    <thead className="bg-white/[0.07] text-white">
      {children}
    </thead>
  ),

  tbody: ({ children }) => (
    <tbody className="divide-y divide-white/[0.07]">
      {children}
    </tbody>
  ),

  tr: ({ children }) => (
    <tr className="transition-colors hover:bg-white/[0.025]">
      {children}
    </tr>
  ),

  th: ({ children }) => (
    <th className="whitespace-nowrap px-4 py-3 font-semibold text-white">
      {children}
    </th>
  ),

  td: ({ children }) => (
    <td className="min-w-[120px] px-4 py-3 align-top leading-6 text-white/75">
      {children}
    </td>
  ),

  img: ({ src, alt }) => {
    if (!src || !/^https?:\/\//i.test(src)) return null;

    return (
      <img
        src={src}
        alt={alt || 'Image'}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="my-4 max-h-[420px] max-w-full rounded-xl border border-white/10 object-contain"
      />
    );
  },
};

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-content min-w-0 max-w-full">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={markdownComponents}
        skipHtml
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex w-full animate-fade-in items-start justify-end gap-3">
        <div className="min-w-0 max-w-[85%] overflow-hidden rounded-2xl rounded-tr-sm bg-gradient-to-br from-primary-600 to-primary-500 px-4 py-3 text-white shadow-lg shadow-primary-900/10 md:max-w-[75%]">
          <p className="whitespace-pre-wrap break-words text-sm leading-7 md:text-base">
            {message.content}
          </p>
        </div>

        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-surface-lightest">
          <User size={18} className="text-white/75" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full animate-fade-in items-start gap-3">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white shadow-sm">
        <img
          src="/nutterx-brand-logo.png"
          alt="NUTTERX-AI"
          draggable={false}
          className="h-full w-full select-none object-contain p-0.5"
        />
      </div>

      <div className="min-w-0 max-w-[90%] overflow-hidden rounded-2xl rounded-tl-sm border border-white/10 bg-surface-lighter/80 px-4 py-3 md:max-w-[85%]">
        <div className="min-w-0 break-words text-sm leading-relaxed text-white/90 md:text-base">
          <MarkdownContent content={message.content} />
        </div>
      </div>
    </div>
  );
}