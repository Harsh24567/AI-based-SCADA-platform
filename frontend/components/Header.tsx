'use client';

import React, { useState, useEffect } from 'react';
import { Bell, User, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

import ClientOnly from '@/components/ClientOnly';

export default function Header() {
  const [time, setTime] = useState<string>('');
  const [isDark, setIsDark] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ClientOnly>
      <header className="glass-lg backdrop-blur-xl bg-white/[0.05] border-b border-white/[0.1] px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-light tracking-tight text-foreground">Control Center</h1>
          <div className="text-xs text-muted-foreground tracking-wide font-light">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })} • {time}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Notifications */}
          <button className="relative p-2.5 text-muted-foreground hover:text-foreground hover:bg-white/[0.08] rounded-lg transition-all duration-200">
            <Bell size={18} />
            <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full"></span>
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2.5 text-muted-foreground hover:text-foreground hover:bg-white/[0.08] rounded-lg transition-all duration-200"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          {/* User Profile */}
          <div className="flex items-center gap-3 pl-6 border-l border-white/[0.1]">
            <div className="w-8 h-8 rounded-lg glass-sm glow-accent flex items-center justify-center">
              <User size={16} className="text-accent" />
            </div>
            <div className="text-xs">
              <p className="font-light text-foreground tracking-tight">{user?.username || 'User'}</p>
              <p className="text-xs text-muted-foreground font-light">{user?.role || 'operator'}</p>
            </div>
          </div>
        </div>
      </header>
    </ClientOnly>
  );
}
