import { Moon, Sun, Monitor } from 'lucide-react';
import { useThemeStore } from '../store/themeStore';

export const ThemeToggle = () => {
  const { theme, setTheme } = useThemeStore();

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  return (
    <button
      onClick={cycleTheme}
      className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      title={`Current theme: ${theme}. Click to change.`}
    >
      {theme === 'light' && <Sun className="w-5 h-5" />}
      {theme === 'dark' && <Moon className="w-5 h-5" />}
      {theme === 'system' && <Monitor className="w-5 h-5" />}
    </button>
  );
};
