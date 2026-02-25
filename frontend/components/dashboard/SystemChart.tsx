'use client';

import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ScadaMetrics } from '@/hooks/useRealTimeData';

interface SystemChartProps {
  metrics: ScadaMetrics;
}

export default function SystemChart({ metrics }: SystemChartProps) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    setData((prevData) => {
      const newData = [
        ...prevData,
        {
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          load: metrics.systemLoad,
          temp: Math.round(metrics.temperature),
          efficiency: Math.round(metrics.efficiency),
        },
      ];
      // Keep only last 12 data points
      return newData.slice(-12);
    });
  }, [metrics]);

  return (
    <div className="glass-lg glow-primary p-6">
      <h3 className="text-lg font-light text-foreground mb-6">System Performance</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis 
            dataKey="time" 
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
            stroke="rgba(255,255,255,0.1)"
          />
          <YAxis 
            tick={{ fill: 'rgba(255,255,255,0.6)', fontSize: 12 }}
            stroke="rgba(255,255,255,0.1)"
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'rgba(10, 14, 23, 0.9)', 
              border: '1px solid rgba(0, 212, 255, 0.3)',
              borderRadius: '8px',
            }}
            labelStyle={{ color: 'rgba(255,255,255,0.9)' }}
          />
          <Legend 
            wrapperStyle={{ paddingTop: '10px' }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="load"
            stroke="hsl(195, 100%, 50%)"
            dot={false}
            strokeWidth={2}
            name="System Load (%)"
          />
          <Line
            type="monotone"
            dataKey="temp"
            stroke="hsl(30, 100%, 50%)"
            dot={false}
            strokeWidth={2}
            name="Temperature (°C)"
          />
          <Line
            type="monotone"
            dataKey="efficiency"
            stroke="hsl(140, 100%, 50%)"
            dot={false}
            strokeWidth={2}
            name="Efficiency (%)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
