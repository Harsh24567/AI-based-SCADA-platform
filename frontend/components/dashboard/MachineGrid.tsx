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
        return 'bg-green-500/20 border-green-500/50 text-green-400';
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
      case 'error':
        return 'bg-red-500/20 border-red-500/50 text-red-400';
      case 'offline':
        return 'bg-gray-500/20 border-gray-500/50 text-gray-400';
      default:
        return 'bg-blue-500/20 border-blue-500/50 text-blue-400';
    }
  };

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-green-400';
      case 'warning':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
      case 'offline':
        return 'text-gray-400';
      default:
        return 'text-blue-400';
    }
  };

  return (
    <div className="glass-lg glow-primary p-6">
      <h3 className="text-lg font-light text-foreground mb-6">Machine Status</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
        {machines.map((machine) => (
          <div
            key={machine.id}
            className={`p-4 rounded-lg border transition-all duration-200 hover:border-accent ${getStatusColor(machine.status)}`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Circle className={`w-3 h-3 ${getStatusDotColor(machine.status)}`} fill="currentColor" />
                <h4 className="font-semibold text-sm">{machine.name}</h4>
              </div>
              <span className="text-xs px-2 py-1 bg-background/50 rounded font-mono">
                {machine.id}
              </span>
            </div>

            {machine.status !== 'offline' && (
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-orange-400" />
                  <span className="text-muted-foreground">{Math.round(machine.temperature)}°C</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-blue-400" />
                  <span className="text-muted-foreground">{machine.runtime}h</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-cyan-400" />
                  <span className="text-muted-foreground">{machine.efficiency}%</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
