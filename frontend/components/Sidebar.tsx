'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Menu, X, Activity, AlertTriangle, BarChart3, Settings, LogOut, TrendingUp, BrainCircuit } from 'lucide-react';

import ClientOnly from '@/components/ClientOnly';

export default function Sidebar() {
  const [isOpen, setIsOpen] = useState(true);
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const menuItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Activity },
    { href: '/machines', label: 'Machines', icon: BarChart3 },
    { href: '/alarms', label: 'Alarms', icon: AlertTriangle },
    { href: '/history', label: 'History', icon: TrendingUp },
    { href: '/ai-assistant', label: 'AI Assistant', icon: BrainCircuit },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <ClientOnly>
      <aside
        className={`glass-lg backdrop-blur-2xl bg-white/[0.06] border-r border-white/[0.1] transition-all duration-300 flex flex-col ${isOpen ? 'w-64' : 'w-20'
          }`}
      >
        {/* Logo/Brand */}
        <div className="p-6 border-b border-white/[0.1] flex items-center justify-between">
          <div className={`flex items-center gap-3 ${!isOpen && 'hidden'}`}>
            <Activity className="w-5 h-5 text-accent glow-accent" />
            <span className="text-base font-light tracking-wide text-sidebar-foreground">SCADA</span>
          </div>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-2 hover:bg-white/[0.1] rounded-lg transition-colors duration-200"
          >
            {isOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-light ${active
                    ? 'glass-sm glow-accent bg-white/[0.12]'
                    : 'text-sidebar-foreground hover:bg-white/[0.08]'
                  }`}
                title={!isOpen ? item.label : undefined}
              >
                <Icon size={18} className="flex-shrink-0" />
                {isOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-white/[0.1]">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-light rounded-lg text-sidebar-foreground hover:bg-destructive/20 transition-colors duration-200"
            title={!isOpen ? 'Logout' : undefined}
          >
            <LogOut size={18} className="flex-shrink-0" />
            {isOpen && <span>Logout</span>}
          </button>
        </div>
      </aside>
    </ClientOnly>
  );
}
