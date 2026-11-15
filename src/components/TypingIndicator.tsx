export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 animate-fade-in">
      <div className="flex-shrink-0">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center glow-purple">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="10" x="3" y="11" rx="2" />
            <circle cx="12" cy="16" r="1" fill="white" />
            <path d="M12 13V7a4 4 0 0 0-4-4 4 4 0 0 0-4 4v1" />
            <path d="M12 13V7a4 4 0 0 1 4-4 4 4 0 0 1 4 4v1" />
          </svg>
        </div>
      </div>
      <div className="bg-surface-lighter/80 border border-primary-500/20 rounded-2xl rounded-tl-sm px-4 py-3.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary-400 typing-dot" style={{ animationDelay: '0s' }} />
          <span className="w-2 h-2 rounded-full bg-primary-400 typing-dot" style={{ animationDelay: '0.2s' }} />
          <span className="w-2 h-2 rounded-full bg-accent-400 typing-dot" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    </div>
  );
}
