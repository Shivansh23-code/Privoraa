import React, { useContext, useState } from 'react';
import {
  Menu,
  Moon,
  Sun,
  PanelRight,
  LogOut,
  User as UserIcon,
  ChevronDown,
  Cloud,
  CloudOff,
} from 'lucide-react';
import ModelPicker from './ModelPicker';
import ModeSelector from './ModeSelector';
import { ThemeContext } from '../../context/ThemeContext';
import { useUserAuth } from '../../context/UserAuthContext';
import { useClickOutside } from './useClickOutside';

export default function ChatHeader({
  models,
  model,
  mode,
  onModelChange,
  onModeChange,
  onToggleSidebar,
  onTogglePanel,
  usingMock,
}) {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { user, logOut } = useUserAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useClickOutside(() => setMenuOpen(false), menuOpen);

  return (
    <header className="flex items-center gap-2 border-b border-line bg-bg/80 px-3 py-2.5 backdrop-blur">
      <button
        onClick={onToggleSidebar}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg lg:hidden"
        title="Menu"
      >
        <Menu size={18} />
      </button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <ModelPicker models={models} value={model} onChange={onModelChange} />
        <ModeSelector value={mode} onChange={onModeChange} />
      </div>

      {/* Backend status pill */}
      <span
        title={usingMock ? 'Backend offline — using local demo engine' : 'Connected to backend'}
        className={`hidden items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium sm:flex ${
          usingMock
            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
        }`}
      >
        {usingMock ? <CloudOff size={12} /> : <Cloud size={12} />}
        {usingMock ? 'Demo' : 'Live'}
      </span>

      <button
        onClick={toggleTheme}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg"
        title="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>

      <button
        onClick={onTogglePanel}
        className="hidden h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-fg xl:flex"
        title="Toggle insights panel"
      >
        <PanelRight size={18} />
      </button>

      {/* User menu */}
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm transition hover:bg-surface-2"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-[11px] font-bold text-white">
            {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
          </span>
          <ChevronDown size={14} className="text-muted" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 z-30 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-elevated p-1.5 shadow-xl">
            <div className="flex items-center gap-2 px-2.5 py-2">
              <UserIcon size={16} className="text-muted" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{user?.name || 'User'}</p>
                <p className="truncate text-xs text-muted">{user?.email}</p>
              </div>
            </div>
            <div className="my-1 h-px bg-line" />
            <button
              onClick={logOut}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-red-500 transition hover:bg-red-500/10"
            >
              <LogOut size={15} /> Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
