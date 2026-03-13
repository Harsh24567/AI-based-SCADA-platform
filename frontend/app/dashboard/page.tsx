'use client';

import React from 'react';
import MainLayout from '@/components/MainLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import MetricsGrid from '@/components/dashboard/MetricsGrid';
import SystemChart from '@/components/dashboard/SystemChart';
import MachineGrid from '@/components/dashboard/MachineGrid';
import AlarmPanel from '@/components/dashboard/AlarmPanel';
import HealthScore from '@/components/dashboard/HealthScore';
import AIInsightsPanel from '@/components/dashboard/AIInsightsPanel';
import Link from 'next/link';
import { BrainCircuit } from 'lucide-react';
import { useRealTimeData } from '@/hooks/useRealTimeData';

function DashboardContent() {
  const { metrics, machines, alarms, aiAnomalies, aiPredictions, aiHealth, loading } = useRealTimeData();

  if (loading || !metrics) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-accent mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading system data...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="relative p-8 space-y-6 min-h-full">
        {/* Tech Grid Background overlay to match other pages */}
        <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none mix-blend-screen" 
             style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

        <div className="relative z-10 w-full max-w-[1600px] mx-auto">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
            <div>
              <div className="flex items-center gap-3">
                 <div className="w-2 h-8 bg-cyan-400 rounded-sm" />
                 <h2 className="text-2xl font-mono tracking-widest uppercase text-white font-bold drop-shadow-[0_0_10px_rgba(34,211,238,0.2)]">System Overview</h2>
              </div>
              <p className="text-cyan-500/60 mt-2 text-[11px] font-mono tracking-widest uppercase pl-5">&gt; SCADA_NEURAL_MONITOR_ACTIVE</p>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 text-[10px] font-mono font-bold tracking-widest uppercase text-slate-300 bg-black/40 border border-white/20 hover:bg-white/10 hover:text-white rounded transition-colors shadow-lg">
                [ Export ]
              </button>
              <button className="px-4 py-2 text-[10px] font-mono font-bold tracking-widest uppercase text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 rounded shadow-[0_0_15px_rgba(16,185,129,0.15)] transition-colors">
                [ Sync Data ]
              </button>
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="mb-6 relative">
             <div className="absolute -left-4 top-0 bottom-0 w-[1px] bg-gradient-to-b from-cyan-500/0 via-cyan-500/30 to-cyan-500/0" />
             <MetricsGrid metrics={metrics} />
          </div>

          {/* Main Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
            <div className="absolute -right-4 top-0 bottom-0 w-[1px] bg-gradient-to-b from-purple-500/0 via-purple-500/30 to-purple-500/0 hidden lg:block" />
            
            {/* Left Column - Charts and AI Analysis */}
            <div className="lg:col-span-2 space-y-6">
               <SystemChart metrics={metrics} />
               <AIInsightsPanel
                 anomalies={aiAnomalies}
                 predictions={aiPredictions}
                 insight={aiHealth?.latest_insight}
               />
               <MachineGrid machines={machines} />
            </div>

            {/* Right Column - Status Panels */}
            <div className="space-y-6">
               <HealthScore
                 score={aiHealth?.system_score ?? 0}
                 grade={aiHealth?.system_grade ?? 'F'}
                 label="Neural Core Health"
               />
               <AlarmPanel alarms={alarms} />
               {/* AI Assistant shortcut card */}
               <Link href="/ai-assistant" className="block relative group">
                 <div className="absolute inset-0 bg-cyan-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-xl" />
                 <div className="relative p-5 rounded border border-cyan-500/30 bg-[#0a0f16]/90 hover:bg-cyan-500/5 transition-all duration-300 shadow-[0_0_20px_rgba(6,182,212,0.1)] overflow-hidden">
                   <div className="absolute left-0 top-0 h-full w-1 bg-cyan-500" />
                   <div className="absolute top-0 right-0 w-8 h-8 bg-cyan-500/10 blur-xl rounded-full" />
                   
                   <div className="flex items-center gap-3 mb-3 pl-2">
                     <div className="p-1.5 rounded bg-cyan-500/20 border border-cyan-500/50">
                        <BrainCircuit className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                     </div>
                     <span className="text-[11px] font-mono font-bold tracking-widest text-cyan-400 uppercase">SCADA AI Assistant V_2.0</span>
                   </div>
                   <p className="text-[10px] text-slate-400 font-mono pl-2 leading-relaxed uppercase tracking-wider">
                     Engage AI diagnostics, trajectory forecasts, and system queries.
                   </p>
                   <div className="mt-4 pl-2 flex items-center gap-2">
                     <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                     <span className="text-[9px] text-cyan-500 font-mono uppercase tracking-[0.2em] group-hover:text-cyan-300">
                       &gt; Initialize Handshake
                     </span>
                   </div>
                 </div>
               </Link>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
