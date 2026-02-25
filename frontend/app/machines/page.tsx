'use client';

import React from 'react';
import MainLayout from '@/components/MainLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useRealTimeData } from '@/hooks/useRealTimeData';
import { Circle, Thermometer, Gauge, Waves } from 'lucide-react';

function MachinesContent() {
  const { machines, loading } = useRealTimeData();

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-accent"></div>
        </div>
      </MainLayout>
    );
  }

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
    <MainLayout>
      <div className="p-6 space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Machine Management</h2>
          <p className="text-muted-foreground mt-1">Monitor and manage all connected equipment</p>
        </div>

        {machines.length === 0 ? (
          <div className="bg-card border border-border rounded-lg p-12 text-center">
            <p className="text-muted-foreground">
              No machines reporting data. Ensure the Sensor Simulator and MQTT Ingestor are running.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {machines.map((machine) => (
              <div
                key={machine.id}
                className={`p-6 rounded-lg border transition-all duration-200 hover:border-accent ${getStatusColor(machine.status)}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{machine.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono mt-1">{machine.id}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <Circle className={`w-3 h-3 ${getStatusDotColor(machine.status)}`} fill="currentColor" />
                      <span className="text-xs font-semibold uppercase">{machine.status}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Thermometer size={14} />
                      Temperature
                    </span>
                    <span className="text-foreground font-mono">{machine.temperature}°C</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Waves size={14} />
                      Vibration
                    </span>
                    <span className="text-foreground font-mono">{machine.vibration} mm/s</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center gap-2">
                      <Gauge size={14} />
                      Pressure
                    </span>
                    <span className="text-foreground font-mono">{machine.pressure} bar</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

export default function MachinesPage() {
  return (
    <ProtectedRoute>
      <MachinesContent />
    </ProtectedRoute>
  );
}
