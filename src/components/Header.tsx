import { ReactNode } from 'react';

interface HeaderProps {
  title?: string;
  leftChildren?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const Header = ({ title, leftChildren, children, className }: HeaderProps) => {
  return (
    <header className={`fixed top-0 left-0 right-0 z-50 border-b bg-card shadow ${className || ''}`}>
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <img
            src="/atom shaale logo.png"
            alt="Atom Shaale Logo"
            className="h-24 w-24 object-contain"
          />
          {leftChildren}
          {title && <h1 className="text-xl font-bold">{title}</h1>}
        </div>

        <div className="flex items-center gap-3">
          {children}
        </div>
      </div>
    </header>
  );
};

export default Header;