import React, { createContext, useContext, useState, useEffect } from 'react';

interface ThemeContextType {
  dataSaver: boolean;
  toggleDataSaver: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dataSaver, setDataSaver] = useState<boolean>(() => {
    const saved = localStorage.getItem('qelem_data_saver');
    if (saved !== null) return saved === 'true';

    // Auto-detect browser Network Information API save-data or 2G/3G hint
    const nav = navigator as any;
    if (nav.connection?.saveData || nav.connection?.effectiveType === '2g' || nav.connection?.effectiveType === '3g') {
      return true;
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('qelem_data_saver', String(dataSaver));
  }, [dataSaver]);

  const toggleDataSaver = () => setDataSaver(prev => !prev);

  return (
    <ThemeContext.Provider value={{ dataSaver, toggleDataSaver }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
