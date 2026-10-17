import type { ReactNode } from 'react';
import './Header.css';

const Header = ({ children }: { children?: ReactNode }) => {
  return (
    <header className="header">
      <div className="header-content">
        <h1 className="header-title">Discord Attestation</h1>
        {children}
      </div>
    </header>
  );
};

export default Header;
