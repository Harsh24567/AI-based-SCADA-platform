'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Brush 
} from 'recharts';
import { ScadaMetrics } from '@/hooks/useRealTimeData';
import { Filter, Clock, CheckSquare, Square } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";

interface SystemChartProps {
  metrics: ScadaMetrics;
}

// Available parameters to plot
const PARAMETERS = [
  { key: 'load', label: 'System Load (%)', color: 'hsl(195, 100%, 50%)' },
  { key: 'temp', label: 'Temperature (°C)', color: 'hsl(30, 100%, 50%)' },
  { key: 'efficiency', label: 'Efficiency (%)', color: 'hsl(140, 100%, 50%)' },
  { key: 'pressure', label: 'Pressure (bar)', color: 'hsl(280, 100%, 70%)' },
  { key: 'vibration', label: 'Vibration (mm/s)', color: 'hsl(340, 100%, 60%)' },
];

// Time windows in points (assuming 2s interval)
const TIME_WINDOWS = [
  { label: 'Live (1 min)', points: 30 },
  { label: '15 Minutes', points: 450 },
  { label: '30 Minutes', points: 900 },
  { label: '60 Minutes', points: 1800 },
];

export default function SystemChart({ metrics }: SystemChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [selectedParams, setSelectedParams] = useState<string[]>(['load', 'temp', 'efficiency']);
  const [timeWindow, setTimeWindow] = useState<number>(30); // Default to Live

  useEffect(() => {
    setData((prevData) => {
      const now = new Date();
      const newData = [
        ...prevData,
        {
          timestamp: now.getTime(),
          time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          load: metrics.systemLoad,
          temp: Math.round(metrics.temperature),
          efficiency: Math.round(metrics.efficiency),
          pressure: Math.round(metrics.pressure),
          vibration: Number(metrics.vibration.toFixed(2)),
        },
      ];
      // Keep max 1800 points in memory to support up to 60 mins at 2s poll rate
      if (newData.length > 1800) {
        return newData.slice(-1800);
      }
      return newData;
    });
  }, [metrics]);

  const toggleParam = (key: string) => {
    setSelectedParams(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // Get only the data points matching the selected time window
  const displayData = useMemo(() => {
    return data.slice(-timeWindow);
  }, [data, timeWindow]);

  // Downsample data if there are too many points to render smoothly
  const chartData = useMemo(() => {
    if (displayData.length > 100) {
      const factor = Math.floor(displayData.length / 100);
      return displayData.filter((_, i) => i % factor === 0);
    }
    return displayData;
  }, [displayData]);

  return (
    <div className="relative glass-lg p-6 overflow-hidden border border-white/5 bg-gradient-to-b from-background to-background/50 flex flex-col">
      {/* Tech Background Pattern */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '16px 16px' }} />
      
      <div className="relative z-10 flex items-center justify-between mb-6 pb-4 border-b border-white/10">
        <div>
           <div className="flex items-center gap-2 mb-1">
             <span className="w-2 h-2 rounded-sm bg-cyan-400 animate-pulse" />
             <h3 className="text-lg font-mono font-medium text-white tracking-widest uppercase">Trajectory Analysis Stream</h3>
           </div>
           <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase pl-4">Real-time Telemetry Graph</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Window Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-3 py-1.5 text-[10px] font-mono font-bold tracking-widest uppercase text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 rounded shadow-[0_0_10px_rgba(6,182,212,0.1)] flex items-center gap-2 transition-colors">
                <Clock className="w-3 h-3" />
                <span>Range // {TIME_WINDOWS.find(t => t.points === timeWindow)?.label}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#0a0f16]/95 backdrop-blur border border-cyan-500/30 text-foreground min-w-[150px] shadow-[0_0_20px_rgba(6,182,212,0.1)] rounded-sm">
              <DropdownMenuLabel className="text-[10px] font-mono text-cyan-500 uppercase tracking-widest">Time Interval</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-cyan-500/20" />
              {TIME_WINDOWS.map(tw => (
                <DropdownMenuItem 
                  key={tw.points} 
                  onClick={() => setTimeWindow(tw.points)}
                  className={`cursor-pointer text-xs font-mono uppercase focus:bg-cyan-500/20 focus:text-cyan-400 ${timeWindow === tw.points ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-300'}`}
                >
                  {tw.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Parameter Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-3 py-1.5 text-[10px] font-mono font-bold tracking-widest uppercase text-purple-400 bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20 rounded shadow-[0_0_10px_rgba(168,85,247,0.1)] flex items-center gap-2 transition-colors">
                <Filter className="w-3 h-3" />
                <span>Filters</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-[#0a0f16]/95 backdrop-blur border border-purple-500/30 text-foreground min-w-[200px] shadow-[0_0_20px_rgba(168,85,247,0.1)] rounded-sm">
              <DropdownMenuLabel className="text-[10px] font-mono text-purple-500 uppercase tracking-widest">Toggle Vectors</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-purple-500/20" />
              {PARAMETERS.map(param => {
                const isSelected = selectedParams.includes(param.key);
                return (
                  <DropdownMenuItem 
                    key={param.key} 
                    onClick={(e) => { e.preventDefault(); toggleParam(param.key); }}
                    className={`cursor-pointer flex items-center gap-2 text-xs font-mono focus:bg-purple-500/10 ${isSelected ? '' : 'text-slate-500'}`}
                  >
                    {isSelected ? <CheckSquare className="w-3.5 h-3.5" style={{ color: param.color }} /> : <Square className="w-3.5 h-3.5 text-slate-600" />}
                    <span style={{ color: isSelected ? param.color : 'inherit' }}>{param.label}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="relative z-10 flex-1 w-full min-h-[300px] bg-black/40 border border-white/5 rounded p-2">
        <div className="absolute top-0 w-full h-[1px] left-0 bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
        {chartData.length === 0 ? (
          <div className="h-full w-full flex items-center justify-center text-cyan-500/50 text-xs font-mono tracking-widest uppercase">
            &gt; AWAITING TELEMETRY SYNC...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 15, right: 25, left: -10, bottom: -5 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="time" 
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'monospace' }}
                stroke="rgba(255,255,255,0.1)"
                tickMargin={10}
                minTickGap={30}
              />
              <YAxis 
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9, fontFamily: 'monospace' }}
                stroke="rgba(255,255,255,0.1)"
                tickMargin={10}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(10, 14, 23, 0.95)', 
                  border: '1px solid rgba(6,182,212,0.3)',
                  borderRadius: '4px',
                  boxShadow: '0 0 15px rgba(6,182,212,0.1)',
                  fontSize: '11px',
                  fontFamily: 'monospace'
                }}
                labelStyle={{ color: '#22d3ee', marginBottom: '6px', fontWeight: 'bold' }}
                itemStyle={{ padding: '2px 0' }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase' }}
                iconType="rect"
              />
              
              {PARAMETERS.map(param => {
                if (!selectedParams.includes(param.key)) return null;
                return (
                  <Line
                    key={param.key}
                    type="stepAfter"
                    dataKey={param.key}
                    stroke={param.color}
                    dot={false}
                    strokeWidth={1.5}
                    name={param.label}
                    isAnimationActive={false}
                  />
                );
              })}
              
              {/* Optional brush for SCADA-like zooming on large datasets */}
              {timeWindow > 100 && (
                 <Brush 
                   dataKey="time" 
                   height={20} 
                   stroke="rgba(6,182,212,0.2)" 
                   fill="rgba(0,0,0,0.4)" 
                   tickFormatter={() => ''}
                 />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
