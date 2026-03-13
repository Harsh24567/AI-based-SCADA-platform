'use client';

import React from 'react';

interface HealthScoreProps {
    score: number;   // 0–100
    grade: string;   // A / B / C / D / F
    label?: string;
}

export default function HealthScore({ score, grade, label = 'System Health' }: HealthScoreProps) {
    // Color based on grade
    const getColor = (g: string): string => {
        switch (g) {
            case 'A': return 'hsl(140, 80%, 55%)';
            case 'B': return 'hsl(90, 70%, 50%)';
            case 'C': return 'hsl(45, 90%, 55%)';
            case 'D': return 'hsl(25, 90%, 55%)';
            case 'F': return 'hsl(0, 85%, 55%)';
            default: return 'hsl(210, 50%, 50%)';
        }
    };

    const color = getColor(grade);
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    return (
        <div className="relative glass-lg p-6 overflow-hidden border border-white/5 bg-gradient-to-b from-background to-background/50">
            <div className="absolute top-0 right-0 p-2">
               <div className="flex gap-1">
                  <span className="w-1 h-1 bg-white/20 rounded-full" />
                  <span className="w-1 h-1 bg-white/20 rounded-full" />
                  <span className="w-1 h-1 bg-white/20 rounded-full" />
               </div>
            </div>
            
            <div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-4">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                <h3 className="text-sm font-mono font-medium text-white tracking-widest uppercase">{label}</h3>
            </div>
            
            <div className="flex items-center justify-center py-4">
                <div className="relative group">
                    {/* Outer glow */}
                    <div 
                        className="absolute inset-0 rounded-full blur-xl opacity-20 pointer-events-none transition-opacity group-hover:opacity-40"
                        style={{ backgroundColor: color }}
                    />
                    
                    <svg width="140" height="140" className="-rotate-90 relative z-10">
                        {/* Background circle */}
                        <circle
                            cx="70" cy="70" r={radius}
                            fill="none"
                            stroke="rgba(255,255,255,0.05)"
                            strokeWidth="8"
                        />
                        {/* Score arc */}
                        <circle
                            cx="70" cy="70" r={radius}
                            fill="none"
                            stroke={color}
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            style={{ transition: 'stroke-dashoffset 1s ease-in-out, stroke 0.5s ease', filter: `drop-shadow(0 0 6px ${color})` }}
                        />
                    </svg>
                    {/* Center text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                        <span className="text-3xl font-mono font-bold text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] tracking-wider">
                           {Math.round(score)}
                        </span>
                        <div className="flex items-center gap-1 mt-1 px-2 py-0.5 bg-black/40 border border-white/10 rounded-sm">
                            <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Class</span>
                            <span
                                className="text-xs font-mono font-bold"
                                style={{ color, textShadow: `0 0 8px ${color}` }}
                            >
                                {grade}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
