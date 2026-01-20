import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users for demo
const mockUsers: Record<UserRole, User> = {
  teacher: {
    id: '1',
    name: 'Dr. Priya Sharma',
    email: 'priya.sharma@university.edu',
    role: 'teacher',
    department: 'Computer Science',
    subjects: ['Data Structures', 'Algorithms', 'Database Systems'],
  },
  hod: {
    id: '2',
    name: 'Prof. Rajesh Kumar',
    email: 'rajesh.kumar@university.edu',
    role: 'hod',
    department: 'Computer Science',
  },
  exam_cell: {
    id: '3',
    name: 'Mr. Amit Verma',
    email: 'amit.verma@university.edu',
    role: 'exam_cell',
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const login = async (email: string, password: string, role: UserRole): Promise<boolean> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 800));
    
    // For demo, accept any credentials
    if (email && password) {
      setUser(mockUsers[role]);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
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
