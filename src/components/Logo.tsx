
interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export default function Logo({
  size = 'md',
  showText = true,
}: LogoProps) {
  const sizes = {
    sm: {
      width: 34,
      height: 25,
      text: 'text-base',
    },
    md: {
      width: 46,
      height: 34,
      text: 'text-xl',
    },
    lg: {
      width: 62,
      height: 46,
      text: 'text-3xl',
    },
  };

  const currentSize = sizes[size];

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* NUTTERX Brand Emblem */}
      <div
        className="relative shrink-0 flex items-center justify-center"
        style={{
          width: currentSize.width,
          height: currentSize.height,
        }}
      >
        <img
          src="/nutterx-brand-logo.png"
          alt="NUTTERX Brand Logo"
          draggable={false}
          className="w-full h-full object-contain drop-shadow-[0_0_8px_rgba(255,140,0,0.3)]"
        />
      </div>

      {/* Brand Name */}
      {showText && (
        <span
          className={`font-display font-bold tracking-tight whitespace-nowrap ${currentSize.text}`}
        >
          <span className="text-white">NUTTER</span>
          <span className="text-orange-500">X</span>
          <span className="text-white/60 text-sm font-medium ml-1">
            AI
          </span>
        </span>
      )}
    </div>
  );
}
