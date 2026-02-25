'use client';

import React from 'react';
import { Brain, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react';

interface AnomalyData {
    machine_id: string;
    parameter: string;
    value: number;
    anomaly_type: string;
    confidence: number;
    description: string;
}

interface PredictionData {
    machine_id: string;
    parameter: string;
    current_value: number;
    predicted_value: number;
    trend_direction: string;
    confidence: number;
    threshold_eta_seconds?: number;
    threshold_eta_minutes?: number;
    threshold_value?: number;
}

interface AIInsightsPanelProps {
    anomalies: AnomalyData[];
    predictions: PredictionData[];
}

export default function AIInsightsPanel({ anomalies, predictions }: AIInsightsPanelProps) {
    const getMethodBadge = (type: string) => {
        switch (type) {
            case 'zscore':
                return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-400 border border-purple-500/30">Z-Score</span>;
            case 'isolation_forest':
                return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">ML</span>;
            case 'rate_of_change':
                return <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-orange-500/20 text-orange-400 border border-orange-500/30">Spike</span>;
            default:
                return null;
        }
    };

    const getTrendIcon = (direction: string) => {
        switch (direction) {
            case 'rising': return <TrendingUp className="w-3.5 h-3.5 text-red-400" />;
            case 'falling': return <TrendingDown className="w-3.5 h-3.5 text-blue-400" />;
            default: return <Minus className="w-3.5 h-3.5 text-gray-400" />;
        }
    };

    // Predictions with threshold warnings
    const warnings = predictions.filter(p => p.threshold_eta_seconds != null);

    return (
        <div className="glass-lg glow-primary p-6">
            <div className="flex items-center gap-2 mb-6">
                <Brain className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-light text-foreground">AI Insights</h3>
                {anomalies.length > 0 && (
                    <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold bg-red-500/20 text-red-400 animate-pulse">
                        {anomalies.length} anomal{anomalies.length === 1 ? 'y' : 'ies'}
                    </span>
                )}
            </div>

            {/* Anomalies */}
            {anomalies.length > 0 ? (
                <div className="space-y-2 mb-6">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Detected Anomalies</p>
                    {anomalies.slice(0, 5).map((a, i) => (
                        <div key={i} className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 transition-all">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                                        <span className="text-xs font-semibold text-foreground truncate">{a.machine_id}</span>
                                        {getMethodBadge(a.anomaly_type)}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{a.description}</p>
                                </div>
                                <div className="flex-shrink-0 text-right">
                                    <div className="text-xs font-mono text-red-400">{Math.round(a.confidence * 100)}%</div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="mb-6 py-4 text-center">
                    <p className="text-sm text-green-400">✓ No anomalies detected</p>
                    <p className="text-xs text-muted-foreground mt-1">All sensors within normal patterns</p>
                </div>
            )}

            {/* Threshold Warnings */}
            {warnings.length > 0 && (
                <div className="space-y-2 mb-6">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Threshold Warnings</p>
                    {warnings.map((w, i) => (
                        <div key={i} className="p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                            <div className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 text-yellow-400" />
                                <span className="text-xs text-foreground">
                                    <span className="font-semibold">{w.machine_id}</span> {w.parameter} → {w.threshold_value}
                                </span>
                                <span className="ml-auto text-xs font-mono text-yellow-400">
                                    ~{w.threshold_eta_minutes?.toFixed(0)}min
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Trend Summary */}
            {predictions.length > 0 && (
                <div className="space-y-2">
                    <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Trends (5 min forecast)</p>
                    <div className="grid grid-cols-1 gap-1.5">
                        {predictions.slice(0, 6).map((p, i) => (
                            <div key={i} className="flex items-center gap-2 py-1.5 px-2 rounded bg-white/[0.04]">
                                {getTrendIcon(p.trend_direction)}
                                <span className="text-xs text-muted-foreground flex-1 truncate">
                                    {p.machine_id}.{p.parameter}
                                </span>
                                <span className="text-xs font-mono text-muted-foreground">
                                    {p.current_value.toFixed(1)}
                                </span>
                                <span className="text-xs text-muted-foreground">→</span>
                                <span className={`text-xs font-mono ${p.trend_direction === 'rising' ? 'text-red-400' :
                                        p.trend_direction === 'falling' ? 'text-blue-400' :
                                            'text-gray-400'
                                    }`}>
                                    {p.predicted_value.toFixed(1)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
