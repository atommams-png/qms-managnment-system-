import { ReactNode } from 'react';

interface HeaderProps {
  title?: string;
  leftChildren?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const Header = ({ title, leftChildren, children, className }: HeaderProps) => {
  const isCompact = className?.includes('compact');
  return (
    <>
      <header className={`fixed top-0 left-0 right-0 z-50 border-b bg-card shadow ${className || ''}`}>
        <div className={`container flex items-center justify-between px-4 ${isCompact ? 'h-14 md:h-16' : 'h-16 md:h-20'}`}>
          <div className="flex items-center gap-3 min-w-0">
            <img
              src="/atom shaale logo.png"
              alt="Atom Shaale Logo"
              className={`${isCompact ? 'h-10 md:h-12' : 'h-12 md:h-16'} w-auto object-contain`}
            />
            <div className="min-w-0 hidden sm:block">
              {leftChildren && <div className="hidden sm:flex">{leftChildren}</div>}
              {title && <h1 className={`${isCompact ? 'text-sm md:text-base' : 'text-base md:text-xl'} font-bold truncate max-w-xs`}>{title}</h1>}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 text-sm md:text-base">
            {children}
          </div>
        </div>
      </header>
      <div className={`${isCompact ? 'h-14 md:h-16' : 'h-16 md:h-20'}`} />
    </>
  );
};

export default Header;