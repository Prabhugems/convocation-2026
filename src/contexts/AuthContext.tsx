'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface AuthContextType {
  isStaff: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  showLoginModal: boolean;
  setShowLoginModal: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Staff credentials - in production, use environment variables
const STAFF_CREDENTIALS = {
  username: 'amasi',
  password: 'conv2026',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  // Use lazy initialization to read from localStorage (avoids useEffect setState)
  const [isStaff, setIsStaff] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('amasi_staff_logged_in') === 'true';
    }
    return false;
  });
  const [showLoginModal, setShowLoginModal] = useState(false);

  const login = (username: string, password: string): boolean => {
    if (
      username.toLowerCase() === STAFF_CREDENTIALS.username.toLowerCase() &&
      password === STAFF_CREDENTIALS.password
    ) {
      setIsStaff(true);
      localStorage.setItem('amasi_staff_logged_in', 'true');
      setShowLoginModal(false);
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsStaff(false);
    localStorage.removeItem('amasi_staff_logged_in');
  };

  return (
    <AuthContext.Provider value={{ isStaff, login, logout, showLoginModal, setShowLoginModal }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
