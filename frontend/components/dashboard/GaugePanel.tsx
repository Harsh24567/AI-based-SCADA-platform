'use client';

import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { ScadaMetrics } from '@/hooks/useRealTimeData';

interface GaugePanelProps {
  metrics: ScadaMetrics;
}

export default function GaugePanel({ metrics }: GaugePanelProps) {
  const gauges = [
    {
      label: 'System Load',
      value: metrics.systemLoad,
      color: 'hsl(195, 100%, 50%)',
      glow: 'rgba(6,182,212,0.5)',
    },
    {
      label: 'Efficiency',
      value: metrics.efficiency,
      color: 'hsl(140, 100%, 50%)',
      glow: 'rgba(52,211,153,0.5)',
    },
  ];

  const renderGauge = (value: number, color: string, glow: string) => {
    const data = [
      { name: 'used', value },
      { name: 'remaining', value: 100 - value },
    ];

    return (
      <div className="relative">
        {/* Glow effect under the chart */}
        <div 
           className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-12 blur-xl opacity-30 rounded-t-full pointer-events-none"
           style={{ backgroundColor: color }}
        />
        <ResponsiveContainer width="100%" height={120}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={40}
              outerRadius={60}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={color} />
              <Cell fill="rgba(255,255,255,0.05)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center Readout */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex flex-col items-center">
            <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase mb-1">Current</span>
            <div className="px-2 py-0.5 border-t border-white/10" style={{ borderTopColor: color }}>
                <span className="text-xl font-mono font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{Math.round(value)}</span>
                <span className="text-xs text-slate-400 font-mono ml-0.5">%</span>
            </div>
        </div>
      </div>
    );
  };

  return (
    <div className="relative glass-lg p-6 overflow-hidden border border-white/5 bg-gradient-to-b from-background to-background/50">
      <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
         <span className="w-2 h-2 rounded bg-cyan-400 animate-pulse drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" />
         <h3 className="text-sm font-mono font-medium text-white tracking-widest uppercase">Performance Metrics</h3>
      </div>
      
      <div className="space-y-8">
        {gauges.map((gauge, index) => (
          <div key={index} className="relative p-4 bg-black/40 border border-white/5 rounded">
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] text-slate-400 font-mono tracking-widest uppercase">{gauge.label}</span>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: gauge.color, boxShadow: `0 0 5px ${gauge.glow}` }} />
            </div>
            {renderGauge(gauge.value, gauge.color, gauge.glow)}
          </div>
        ))}
      </div>
    </div>
  );
}
