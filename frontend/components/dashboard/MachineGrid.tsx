'use client';

import React from 'react';
import { Machine } from '@/hooks/useRealTimeData';
import { Circle, Thermometer, Clock, Zap } from 'lucide-react';

interface MachineGridProps {
  machines: Machine[];
}

export default function MachineGrid({ machines }: MachineGridProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-500/10 border-emerald-500/30 group-hover:border-emerald-500/50';
      case 'warning':
        return 'bg-yellow-500/10 border-yellow-500/30 group-hover:border-yellow-500/50';
      case 'error':
        return 'bg-rose-500/10 border-rose-500/30 group-hover:border-rose-500/50';
      case 'offline':
        return 'bg-slate-500/10 border-slate-500/30 group-hover:border-slate-500/50';
      default:
        return 'bg-cyan-500/10 border-cyan-500/30 group-hover:border-cyan-500/50';
    }
  };

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]';
      case 'warning':
        return 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)]';
      case 'error':
        return 'bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.8)] shadow-[0_0_8px_rgba(251,113,133,0.8)] animate-pulse';
      case 'offline':
        return 'bg-slate-400';
      default:
        return 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]';
    }
  };

  return (
    <div className="relative glass-lg p-6 overflow-hidden border border-white/5 bg-gradient-to-b from-background to-background/50">
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl" />
      
      <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
        <div className="p-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded">
           <Zap className="w-4 h-4 text-cyan-400" />
        </div>
        <h3 className="text-sm font-mono font-medium text-white tracking-widest uppercase">Node Matrix Status</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {machines.map((machine) => (
          <div
            key={machine.id}
            className={`relative p-4 rounded border transition-all duration-300 group overflow-hidden ${getStatusColor(machine.status)}`}
          >
            <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-white/20" />
            
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${getStatusDotColor(machine.status)}`} />
                <h4 className="font-mono text-[13px] font-bold text-white tracking-widest uppercase">{machine.name}</h4>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 border border-white/10 bg-black/40 text-slate-400 rounded-sm font-mono tracking-widest">
                {machine.id}
              </span>
            </div>

            {machine.status !== 'offline' && (
              <div className="grid grid-cols-3 gap-2 px-2 py-2 rounded bg-black/40 border border-white/5">
                <div className="flex flex-col items-center gap-1.5 group/stat">
                  <Thermometer className="w-3.5 h-3.5 text-orange-400 group-hover/stat:scale-110 transition-transform" />
                  <span className="text-[11px] font-mono text-slate-300">{Math.round(machine.temperature)}°C</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 group/stat border-x border-white/5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400 group-hover/stat:scale-110 transition-transform" />
                  <span className="text-[11px] font-mono text-slate-300">{machine.runtime}h</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 group/stat">
                  <Zap className="w-3.5 h-3.5 text-cyan-400 group-hover/stat:scale-110 transition-transform" />
                  <span className="text-[11px] font-mono text-slate-300">{machine.efficiency}%</span>
                </div>
              </div>
            )}
            {machine.status === 'offline' && (
              <div className="px-2 py-3 rounded bg-black/40 border border-white/5 flex items-center justify-center">
                 <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Connection Lost</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
