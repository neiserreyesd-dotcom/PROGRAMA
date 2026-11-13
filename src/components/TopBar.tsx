import {
  Clock3,
  Home,
  Layers,
  Library,
  Mic2,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import { ActiveView } from '../types/song';

interface TopBarProps {
  activeView: ActiveView;
  hasLoadedSong: boolean;
  onChangeView: (view: ActiveView) => void;
  onOpenAnalyzer: () => void;
}

const PRE_SONG_NAV_ITEMS: Array<{
  id: ActiveView;
  label: string;
  icon: typeof Mic2;
}> = [
  { id: 'home', label: 'Inicio', icon: Home },
  { id: 'library', label: 'Biblioteca', icon: Library },
  { id: 'settings', label: 'Ajustes', icon: SlidersHorizontal },
];

const STUDIO_NAV_ITEMS: Array<{
  id: ActiveView;
  label: string;
  icon: typeof Mic2;
}> = [
  { id: 'stage', label: 'Escenario', icon: Mic2 },
  { id: 'structure', label: 'Estructura', icon: Layers },
  { id: 'editor', label: 'Tiempos', icon: Clock3 },
  { id: 'library', label: 'Biblioteca', icon: Library },
  { id: 'settings', label: 'Ajustes', icon: SlidersHorizontal },
];

export function TopBar({
  activeView,
  hasLoadedSong,
  onChangeView,
  onOpenAnalyzer,
}: TopBarProps) {
  const navItems = hasLoadedSong ? STUDIO_NAV_ITEMS : PRE_SONG_NAV_ITEMS;
  const mobileGridClass = hasLoadedSong ? 'grid-cols-5' : 'grid-cols-3';

  return (
    <header className="pt-safe md:sticky md:top-0 z-30 border-b border-[var(--app-border)] bg-[var(--app-bg-glass)] backdrop-blur-xl">
      {/* Primary Top Row */}
      <div className="mx-auto flex max-w-[1360px] items-center justify-between gap-3 md:gap-8 px-3.5 py-2 md:py-3 sm:px-6">
        <button
          type="button"
          onClick={() => onChangeView('home')}
          className="group flex min-h-[40px] md:min-h-0 items-center gap-2 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--app-accent)]"
        >
          <span
            aria-hidden="true"
            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg border border-[var(--app-accent-border)] bg-[var(--app-accent-soft)] transition-transform group-hover:scale-105"
          >
            <svg
              viewBox="0 0 20 20"
              className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-[var(--app-accent)]"
              fill="currentColor"
            >
              <rect x="2.5" y="7" width="2.5" height="6" rx="1.25" />
              <rect x="7" y="3.5" width="2.5" height="13" rx="1.25" />
              <rect x="11.5" y="5.5" width="2.5" height="9" rx="1.25" />
              <rect x="16" y="8" width="2" height="4" rx="1" />
            </svg>
          </span>
          <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-[var(--app-text)]">
            Estrofa
          </span>
        </button>

        {/* Desktop Centered Navigation */}
        <nav
          aria-label="Navegación principal"
          className="hidden md:flex items-center gap-1 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)]/75 p-1"
        >
          {navItems.map((item) => {
            const isActive = activeView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeView(item.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[13px] font-medium transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--app-accent)] ${
                  isActive
                    ? 'bg-[var(--app-surface-elevated)] text-[var(--app-accent)] shadow-sm border border-[var(--app-border-strong)]'
                    : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)] border border-transparent'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="shrink-0">
          {activeView !== 'home' ? (
            <button
              type="button"
              onClick={onOpenAnalyzer}
              className="inline-flex min-h-[38px] sm:min-h-0 items-center gap-1.5 rounded-lg bg-[var(--app-accent)] px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-[13px] font-semibold text-[var(--app-accent-contrast)] shadow-sm transition-all hover:opacity-92 active:scale-[0.99] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-accent)]"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
              <span>Importar</span>
              <span className="hidden sm:inline">música</span>
            </button>
          ) : hasLoadedSong ? (
            <button
              type="button"
              onClick={() => onChangeView('stage')}
              className="inline-flex min-h-[38px] sm:min-h-0 items-center gap-1.5 rounded-lg border border-[var(--app-accent-border)] bg-[var(--app-accent-soft)] px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-[13px] font-semibold text-[var(--app-accent)] transition-colors hover:opacity-90 whitespace-nowrap shrink-0"
            >
              <Mic2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Herramientas</span>
            </button>
          ) : (
            <span className="text-[11px] font-medium text-[var(--app-text-muted)]">
              Estudio vocal
            </span>
          )}
        </div>
      </div>

      {/* Mobile Bottom-of-Header Tab Bar */}
      <nav
        aria-label="Navegación móvil"
        className={`grid ${mobileGridClass} border-t border-[var(--app-border)] md:hidden`}
      >
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeView(item.id)}
              className={`relative flex min-h-[46px] flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-[10px] font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'text-[var(--app-accent)] bg-[var(--app-accent-soft)]'
                  : 'text-[var(--app-text-muted)]'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate max-w-full">{item.label}</span>
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-[var(--app-accent)]"
                />
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
