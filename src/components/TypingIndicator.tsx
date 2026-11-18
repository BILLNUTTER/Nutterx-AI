export default function TypingIndicator() {
  return (
    <div className="flex w-full items-start gap-3 animate-fade-in">
      {/* Official NUTTERX logo */}
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white shadow-sm">
        <img
          src="/nutterx-brand-logo.png"
          alt="NUTTERX-AI"
          draggable={false}
          className="h-full w-full select-none object-contain p-0.5"
        />
      </div>

      {/* Animated typing dots */}
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-white/10 bg-surface-lighter/80 px-4 py-3.5">
        <span
          className="h-2 w-2 rounded-full bg-primary-400 typing-dot"
          style={{ animationDelay: '0s' }}
        />

        <span
          className="h-2 w-2 rounded-full bg-primary-400 typing-dot"
          style={{ animationDelay: '0.2s' }}
        />

        <span
          className="h-2 w-2 rounded-full bg-accent-400 typing-dot"
          style={{ animationDelay: '0.4s' }}
        />
      </div>
    </div>
  );
}