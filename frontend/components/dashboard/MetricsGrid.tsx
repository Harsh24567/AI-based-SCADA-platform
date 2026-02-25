'use client';

import React from 'react';
import { ScadaMetrics } from '@/hooks/useRealTimeData';
import { Activity, Thermometer, Gauge, Droplets, Zap, AlertTriangle } from 'lucide-react';

interface MetricsGridProps {
  metrics: ScadaMetrics;
}

export default function MetricsGrid({ metrics }: MetricsGridProps) {
  const cards = [
    {
      title: 'System Load',
      value: `${Math.round(metrics.systemLoad)}%`,
      icon: Zap,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: 'Temperature',
      value: `${Math.round(metrics.temperature)}°C`,
      icon: Thermometer,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
    },
    {
      title: 'Pressure',
      value: `${Math.round(metrics.pressure)} bar`,
      icon: Gauge,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
    },
    {
      title: 'Flow Rate',
      value: `${Math.round(metrics.flowRate)} L/min`,
      icon: Droplets,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'Efficiency',
      value: `${Math.round(metrics.efficiency)}%`,
      icon: Activity,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Active Machines',
      value: `${metrics.activeMachines}/${metrics.totalMachines}`,
      icon: AlertTriangle,
      color: metrics.activeMachines === metrics.totalMachines ? 'text-green-400' : 'text-yellow-400',
      bgColor: metrics.activeMachines === metrics.totalMachines ? 'bg-green-500/10' : 'bg-yellow-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
      {cards.map((card, index) => {
        const Icon = card.icon;
        return (
          <div key={index} className="glass-sm glow-accent hover:bg-white/[0.12] p-4 transition-all duration-300 group">
            <div className="flex items-start justify-between mb-4">
              <span className="text-xs text-muted-foreground font-light tracking-wide uppercase">{card.title}</span>
              <div className="p-2 rounded-lg bg-white/[0.08] group-hover:bg-white/[0.12] transition-colors">
                <Icon className={`w-3.5 h-3.5 ${card.color}`} />
              </div>
            </div>
            <p className="text-xl font-light text-foreground">{card.value}</p>
          </div>
        );
      })}
    </div>
  );
}
