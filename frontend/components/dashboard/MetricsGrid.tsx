'use client';

import React, { useState, useMemo } from 'react';
import { ScadaMetrics } from '@/hooks/useRealTimeData';
import { 
  Activity, Thermometer, Gauge, Zap, AlertTriangle, 
  Settings, Clock, AlertOctagon, CheckCircle2, LayoutTemplate
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem
} from "@/components/ui/dropdown-menu";

interface MetricsGridProps {
  metrics: ScadaMetrics;
}

export default function MetricsGrid({ metrics }: MetricsGridProps) {
  const [layoutSize, setLayoutSize] = useState<number>(6); // Default 6 to match old look, but options will be 2, 4, 8, 10
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');

  // Define all possible 10 metric cards with an ID for selection tracking
  const allCardsList = [
    {
      id: "system_load",
      title: 'System Load',
      value: `${Math.round(metrics.systemLoad)}%`,
      icon: Zap,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
    },
    {
      id: "temperature",
      title: 'Temperature',
      value: `${Math.round(metrics.temperature)}°C`,
      icon: Thermometer,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
    },
    {
      id: "pressure",
      title: 'Pressure',
      value: `${Math.round(metrics.pressure)} bar`,
      icon: Gauge,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
    },
    {
      id: "vibration",
      title: 'Vibration',
      value: `${metrics.vibration.toFixed(2)} mm/s`,
      icon: Activity,
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
    },
    {
      id: "efficiency",
      title: 'Efficiency',
      value: `${Math.round(metrics.efficiency)}%`,
      icon: CheckCircle2,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
    {
      id: "active_machines",
      title: 'Active Machines',
      value: `${metrics.activeMachines}/${metrics.totalMachines}`,
      icon: LayoutTemplate,
      color: metrics.activeMachines === metrics.totalMachines ? 'text-green-400' : 'text-yellow-400',
      bgColor: metrics.activeMachines === metrics.totalMachines ? 'bg-green-500/10' : 'bg-yellow-500/10',
    },
    {
      id: "critical_alarms",
      title: 'Critical Alarms',
      value: `${metrics.alarmCount}`,
      icon: AlertOctagon,
      color: metrics.alarmCount === 0 ? 'text-gray-400' : 'text-red-500',
      bgColor: metrics.alarmCount === 0 ? 'bg-gray-500/10' : 'bg-red-500/10',
    },
    {
      id: "active_warnings",
      title: 'Active Warnings',
      value: `${metrics.warningCount}`,
      icon: AlertTriangle,
      color: metrics.warningCount === 0 ? 'text-gray-400' : 'text-yellow-500',
      bgColor: metrics.warningCount === 0 ? 'bg-gray-500/10' : 'bg-yellow-500/10',
    },
    {
      id: "total_machines",
      title: 'Total Machines',
      value: `${metrics.totalMachines}`,
      icon: LayoutTemplate,
      color: 'text-teal-400',
      bgColor: 'bg-teal-500/10',
    },
    {
      id: "uptime",
      title: 'Uptime',
      value: `${(metrics.uptimeSeconds / 3600).toFixed(1)} hrs`,
      icon: Clock,
      color: 'text-indigo-400',
      bgColor: 'bg-indigo-500/10',
    },
  ];

  // We keep a set of "selected" parameters. By default, pick the first 6 so it aligns with the initial layoutSize.
  const [selectedParamIds, setSelectedParamIds] = useState<string[]>(
      allCardsList.slice(0, 6).map(c => c.id)
  );

  const toggleParam = (id: string, checked: boolean) => {
      setSelectedParamIds(prev => {
          if (checked) {
              return [...prev, id];
          } else {
              return prev.filter(p => p !== id);
          }
      })
  }

  // Filter the cards. We display exactly the cards the user selected, up to layoutSize maximum.
  // Although layoutSize constraints them, they can select exactly what they want.
  const visibleCards = useMemo(() => {
      const selectedCards = allCardsList.filter(card => selectedParamIds.includes(card.id));
      // Truncate based on layout size constraint so we don't break the CSS grid rows if they select 9 but grid is 8
      return selectedCards.slice(0, layoutSize);
  }, [selectedParamIds, layoutSize, metrics]);

  // Determine grid CSS based on sizes and orientation
  // Horizontal: flex row wrapped or normal grid
  // Vertical: a single column or multi-row layout 
  let gridClasses = "grid gap-3 ";
  if (orientation === 'horizontal') {
    if (layoutSize === 2) gridClasses += "grid-cols-2";
    else if (layoutSize === 4) gridClasses += "grid-cols-2 md:grid-cols-4";
    else if (layoutSize === 6) gridClasses += "grid-cols-2 md:grid-cols-3 lg:grid-cols-6";
    else if (layoutSize === 8) gridClasses += "grid-cols-2 md:grid-cols-4 lg:grid-cols-8";
    else if (layoutSize === 10) gridClasses += "grid-cols-2 md:grid-cols-5 lg:grid-cols-10";
  } else {
    // vertical
    if (layoutSize === 2) gridClasses += "grid-cols-1 md:grid-cols-2 text-center";
    else if (layoutSize === 4) gridClasses += "grid-cols-1 md:grid-cols-2";
    else if (layoutSize === 6) gridClasses += "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
    else if (layoutSize === 8) gridClasses += "grid-cols-1 md:grid-cols-2 lg:grid-cols-4";
    else if (layoutSize === 10) gridClasses += "grid-cols-2 md:grid-cols-3 lg:grid-cols-5";
  }

  return (
    <div className="space-y-3 relative group/container">
      {/* Settings Dropdown - visible slightly when hovering over the metrics area */}
      <div className="absolute -top-11 right-0 opacity-0 group-hover/container:opacity-100 transition-opacity z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="glass-button p-2 text-muted-foreground hover:text-foreground rounded-md flex items-center gap-2 text-xs">
              <Settings className="w-4 h-4" />
              <span>Grid Layout</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[450px] bg-background border border-white/10 text-foreground p-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Left Column: Layout & Orientation */}
              <div className="space-y-4">
                <div>
                  <DropdownMenuLabel className="px-0 pt-0">Layout Capacity</DropdownMenuLabel>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    {[2, 4, 6, 8, 10].map(size => (
                      <DropdownMenuItem 
                        key={size} 
                        onClick={() => setLayoutSize(size)}
                        className={`cursor-pointer justify-center text-xs py-2 ${layoutSize === size ? 'bg-accent/20 font-medium' : 'bg-white/[0.04]'}`}
                      >
                        {size} Cards
                      </DropdownMenuItem>
                    ))}
                  </div>
                </div>
                
                <DropdownMenuSeparator className="bg-white/10" />
                
                <div>
                  <DropdownMenuLabel className="px-0 pt-0">Orientation</DropdownMenuLabel>
                  <div className="flex flex-col gap-1 mt-1">
                    <DropdownMenuItem 
                      onClick={() => setOrientation('horizontal')}
                      className={`cursor-pointer text-xs ${orientation === 'horizontal' ? 'bg-accent/20 font-medium' : 'bg-white/[0.04]'}`}
                    >
                      Horizontal Grid
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => setOrientation('vertical')}
                      className={`cursor-pointer text-xs ${orientation === 'vertical' ? 'bg-accent/20 font-medium' : 'bg-white/[0.04]'}`}
                    >
                      Vertical Stack
                    </DropdownMenuItem>
                  </div>
                </div>
              </div>

              {/* Right Column: Parameters */}
              <div className="border-l border-white/10 pl-6">
                <DropdownMenuLabel className="px-0 pt-0 flex justify-between items-center">
                  <span>Visible Parameters</span>
                  <span className="text-[10px] text-muted-foreground font-normal">{selectedParamIds.length} selected</span>
                </DropdownMenuLabel>
                <div className="mt-1 space-y-1">
                  {allCardsList.map(card => (
                       <DropdownMenuCheckboxItem
                          key={card.id}
                          checked={selectedParamIds.includes(card.id)}
                          onCheckedChange={(checked) => toggleParam(card.id, checked)}
                          onSelect={(e) => e.preventDefault()}
                          className="text-xs py-1.5 cursor-pointer"
                       >
                           {card.title}
                       </DropdownMenuCheckboxItem>
                  ))}
                </div>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={gridClasses}>
        {visibleCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={card.id} className={`relative bg-black/40 border border-white/5 rounded overflow-hidden group hover:border-[${card.color.split('-')[1]}/30] transition-all duration-300 p-4 ${orientation === 'vertical' ? 'flex flex-col items-center justify-center text-center py-6' : ''}`}>
              {/* Corner tech accents */}
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/20 group-hover:border-cyan-400/50 transition-colors" />
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/20 group-hover:border-cyan-400/50 transition-colors" />
              
              {/* Scanline effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/5 to-transparent -translate-y-[150%] group-hover:animate-scan opacity-0 group-hover:opacity-100 pointer-events-none" />

              <div className={`flex items-start justify-between mb-4 w-full relative z-10 ${orientation === 'vertical' ? 'justify-center gap-3 mb-2 flex-col items-center' : ''}`}>
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${card.bgColor.replace('/10', '')} animate-pulse`} />
                  <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">{card.title}</span>
                </div>
                <div className={`p-1.5 rounded bg-black/50 border border-white/5 group-hover:border-[${card.color.split('-')[1]}/30] transition-colors`}>
                  <Icon className={`w-3.5 h-3.5 ${card.color}`} />
                </div>
              </div>
              <p className={`text-xl font-mono tracking-wider font-bold text-white relative z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)] ${orientation === 'vertical' ? 'mt-2 text-2xl' : ''}`}>
                {card.value}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
