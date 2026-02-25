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
    },
    {
      label: 'Efficiency',
      value: metrics.efficiency,
      color: 'hsl(140, 100%, 50%)',
    },
  ];

  const renderGauge = (value: number, color: string) => {
    const data = [
      { name: 'used', value },
      { name: 'remaining', value: 100 - value },
    ];

    return (
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
            <Cell fill="rgba(255,255,255,0.1)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="glass-lg glow-primary p-6">
      <h3 className="text-lg font-light text-foreground mb-6">Performance Gauges</h3>
      <div className="space-y-6">
        {gauges.map((gauge, index) => (
          <div key={index}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground font-light">{gauge.label}</span>
              <span className="text-lg font-light text-foreground">{Math.round(gauge.value)}%</span>
            </div>
            {renderGauge(gauge.value, gauge.color)}
          </div>
        ))}
      </div>
    </div>
  );
}
