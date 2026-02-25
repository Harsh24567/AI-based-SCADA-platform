'use client';

import React from 'react';
import MainLayout from '@/components/MainLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import MetricsGrid from '@/components/dashboard/MetricsGrid';
import SystemChart from '@/components/dashboard/SystemChart';
import MachineGrid from '@/components/dashboard/MachineGrid';
import AlarmPanel from '@/components/dashboard/AlarmPanel';
import GaugePanel from '@/components/dashboard/GaugePanel';
import HealthScore from '@/components/dashboard/HealthScore';
import AIInsightsPanel from '@/components/dashboard/AIInsightsPanel';
import { ChatPanel } from '@/components/dashboard/ChatPanel';
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
      <div className="p-8 space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-light tracking-tight text-foreground">System Overview</h2>
            <p className="text-muted-foreground mt-2 text-sm font-light">AI-powered industrial monitoring</p>
          </div>
          <div className="flex gap-3">
            <button className="glass-button px-4 py-2.5 text-sm font-light text-foreground glow-primary">
              Export Report
            </button>
            <button className="glass-button px-4 py-2.5 text-sm font-light text-foreground glow-accent">
              Refresh Data
            </button>
          </div>
        </div>

        {/* Metrics Grid */}
        <MetricsGrid metrics={metrics} />

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Charts */}
          <div className="lg:col-span-2 space-y-6">
            <SystemChart metrics={metrics} />
            <MachineGrid machines={machines} />
          </div>

          {/* Right Column - AI + Status Panels */}
          <div className="space-y-6">
            <HealthScore
              score={aiHealth?.system_score ?? 0}
              grade={aiHealth?.system_grade ?? 'F'}
              label="AI System Health"
            />
            <AIInsightsPanel
              anomalies={aiAnomalies}
              predictions={aiPredictions}
            />
            <GaugePanel metrics={metrics} />
            <AlarmPanel alarms={alarms} />
            <ChatPanel />
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
