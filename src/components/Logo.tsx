import { Bot } from 'lucide-react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export default function Logo({ size = 'md', showText = true }: LogoProps) {
  const sizes = {
    sm: { icon: 18, text: 'text-base' },
    md: { icon: 24, text: 'text-xl' },
    lg: { icon: 36, text: 'text-3xl' },
  };

  return (
    <div className="flex items-center gap-2.5 select-none">
      <div className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg blur-md opacity-50" />
        <div className="relative bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg p-1.5 glow-purple">
          <Bot size={sizes[size].icon} className="text-white" strokeWidth={2.5} />
        </div>
      </div>
      {showText && (
        <span className={`font-display font-bold tracking-tight ${sizes[size].text}`}>
          <span className="text-white">NUTTER</span>
          <span className="text-gradient">X</span>
          <span className="text-white/60 text-sm font-medium ml-1">AI</span>
        </span>
      )}
    </div>
  );
}
