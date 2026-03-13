'use client';

import React from 'react';
import { Brain, AlertTriangle, TrendingUp, TrendingDown, Minus, Clock, Bot, Cpu, ActivitySquare } from 'lucide-react';

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
    insight?: string;
}

export default function AIInsightsPanel({ anomalies, predictions, insight }: AIInsightsPanelProps) {
    const getMethodBadge = (type: string) => {
        switch (type) {
            case 'zscore':
                return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/40 uppercase tracking-widest shadow-[0_0_8px_rgba(168,85,247,0.2)]">Z-Score</span>;
            case 'isolation_forest':
                return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/40 uppercase tracking-widest shadow-[0_0_8px_rgba(6,182,212,0.2)]">ISOFOREST</span>;
            case 'rate_of_change':
                return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-orange-500/10 text-orange-400 border border-orange-500/40 uppercase tracking-widest shadow-[0_0_8px_rgba(249,115,22,0.2)]">Spike</span>;
            default:
                return null;
        }
    };

    const getTrendIcon = (direction: string) => {
        switch (direction) {
            case 'rising': return <TrendingUp className="w-4 h-4 text-rose-500 drop-shadow-[0_0_5px_rgba(244,63,94,0.5)]" />;
            case 'falling': return <TrendingDown className="w-4 h-4 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]" />;
            default: return <Minus className="w-4 h-4 text-slate-500" />;
        }
    };

    const warnings = predictions.filter(p => p.threshold_eta_seconds != null);

    return (
        <div className="relative glass-lg p-6 overflow-hidden border border-white/5 bg-gradient-to-b from-background to-background/50">
            {/* Tech Background Pattern */}
            <div className="absolute inset-0 z-0 opacity-10 pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '16px 16px' }} />
            
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Brain className="w-6 h-6 text-cyan-400" />
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-medium text-white tracking-wide">SCADA AI INSIGHTS</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span className="text-[10px] text-emerald-500 font-mono tracking-widest uppercase">System Online</span>
                            </div>
                        </div>
                    </div>
                    {anomalies.length > 0 && (
                        <div className="px-3 py-1 flex items-center gap-2 rounded bg-rose-500/10 border border-rose-500/50 shadow-[0_0_15px_rgba(225,29,72,0.2)]">
                            <ActivitySquare className="w-4 h-4 text-rose-500" />
                            <span className="text-xs font-mono font-bold text-rose-500 tracking-widest uppercase">
                                {anomalies.length} ALERTS
                            </span>
                        </div>
                    )}
                </div>

                {/* Smart Agent Summary - Terminal Style */}
                {insight && (
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] text-cyan-500 font-mono font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                                <Bot className="w-3.5 h-3.5" />
                                LLM Contextual Analysis
                            </p>
                            <span className="text-[9px] text-slate-500 font-mono uppercase">Model: gpt-4o-mini</span>
                        </div>
                        <div className="relative p-4 rounded-md bg-[#0a0f16] border border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)g] overflow-hidden group">
                            {/* Scanning line effect */}
                            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-transparent via-cyan-500/5 to-transparent -translate-y-full group-hover:animate-[scan_2s_ease-in-out_infinite]" />
                            <div className="absolute left-0 top-0 h-full w-[2px] bg-gradient-to-b from-cyan-400/0 via-cyan-400 to-cyan-400/0" />
                            
                            <p className="text-sm text-cyan-50 font-mono leading-relaxed relative pl-2">
                                <span className="text-cyan-500 mr-2 opacity-70">{">"}</span>
                                {insight}
                                <span className="inline-block w-2 h-4 ml-1 align-middle bg-cyan-400 animate-pulse" />
                            </p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Left Column: Anomalies & Warnings */}
                    <div className="space-y-6">
                        {/* Anomalies */}
                        {anomalies.length > 0 ? (
                            <div className="space-y-3">
                                <p className="text-[10px] text-rose-500 font-mono font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    Active Anomalies
                                </p>
                                <div className="space-y-2">
                                    {anomalies.slice(0, 4).map((a, i) => (
                                        <div key={i} className="relative p-3 pl-4 rounded bg-gradient-to-r from-rose-500/10 to-transparent border border-rose-500/20 hover:border-rose-500/40 transition-colors">
                                            <div className="absolute left-0 top-0 h-full w-1 bg-rose-500 rounded-l" />
                                            <div className="flex items-center justify-between gap-2 mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-mono font-bold text-white tracking-wider">{a.machine_id}</span>
                                                    {getMethodBadge(a.anomaly_type)}
                                                </div>
                                                <div className="flex items-center gap-1.5 bg-background rounded px-1.5 py-0.5 border border-white/5">
                                                    <Cpu className="w-3 h-3 text-slate-400" />
                                                    <span className="text-xs font-mono text-rose-400">{Math.round(a.confidence * 100)}% CF</span>
                                                </div>
                                            </div>
                                            <p className="text-[11px] text-slate-300 font-mono leading-relaxed">{a.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="py-6 flex flex-col items-center justify-center border border-dashed border-emerald-500/30 rounded-lg bg-emerald-500/5">
                                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                </div>
                                <p className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-[0.2em]">0 Anomalies Detected</p>
                                <p className="text-[10px] font-mono text-slate-400 mt-1 uppercase">Parameters Nominal</p>
                            </div>
                        )}

                        {/* Threshold Warnings */}
                        {warnings.length > 0 && (
                            <div className="space-y-3">
                                <p className="text-[10px] text-amber-500 font-mono font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                                    <Clock className="w-3.5 h-3.5" />
                                    Impending Thresholds
                                </p>
                                <div className="space-y-2">
                                    {warnings.map((w, i) => (
                                        <div key={i} className="flex items-center justify-between p-2.5 rounded bg-amber-500/5 border border-amber-500/20 backdrop-blur-sm">
                                            <div>
                                                <div className="text-[11px] font-mono font-bold text-amber-100">{w.machine_id}</div>
                                                <div className="text-[10px] font-mono text-slate-400 mt-0.5">{w.parameter} hitting {w.threshold_value}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-[10px] text-amber-500/70 uppercase mb-0.5">ETA T-Minus</div>
                                                <div className="text-sm font-mono font-bold text-amber-400 drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">
                                                    {w.threshold_eta_minutes?.toFixed(1)}m
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column: Trend Predictions */}
                    {predictions.length > 0 && (
                        <div className="space-y-3">
                            <p className="text-[10px] text-indigo-400 font-mono font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                                <TrendingUp className="w-3.5 h-3.5" />
                                Trajectory Forecast (T+5m)
                            </p>
                            <div className="bg-black/20 rounded-lg border border-white/5 p-1">
                                <table className="w-full text-left">
                                    <thead>
                                        <tr className="border-b border-white/5">
                                            <th className="px-3 py-2 text-[10px] font-mono text-slate-500 font-medium uppercase tracking-wider">Target</th>
                                            <th className="px-3 py-2 text-[10px] font-mono text-slate-500 font-medium uppercase tracking-wider text-right">Cur</th>
                                            <th className="px-2 py-2 w-8"></th>
                                            <th className="px-3 py-2 text-[10px] font-mono text-slate-500 font-medium uppercase tracking-wider">Pred</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {predictions.slice(0, 8).map((p, i) => (
                                            <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="px-3 py-2">
                                                    <div className="text-[11px] font-mono text-white group-hover:text-cyan-300 transition-colors duration-300 truncate max-w-[120px]">
                                                        {p.machine_id}
                                                    </div>
                                                    <div className="text-[9px] font-mono text-slate-500 uppercase">{p.parameter}</div>
                                                </td>
                                                <td className="px-3 py-2 text-[11px] font-mono text-slate-400 text-right">
                                                    {p.current_value.toFixed(1)}
                                                </td>
                                                <td className="px-2 py-2 flex items-center justify-center">
                                                    {getTrendIcon(p.trend_direction)}
                                                </td>
                                                <td className={`px-3 py-2 text-[11px] font-mono font-bold ${
                                                    p.trend_direction === 'rising' ? 'text-rose-400 drop-shadow-[0_0_3px_rgba(244,63,94,0.4)]' :
                                                    p.trend_direction === 'falling' ? 'text-cyan-400 drop-shadow-[0_0_3px_rgba(34,211,238,0.4)]' :
                                                    'text-slate-400'
                                                }`}>
                                                    {p.predicted_value.toFixed(1)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Custom Scanline Animation Keyframes */}
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes scan {
                    0% { transform: translateY(-100%); }
                    100% { transform: translateY(100%); }
                }
            `}} />
        </div>
    );
}
