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
        <div className="glass-lg glow-primary p-6">
            <h3 className="text-lg font-light text-foreground mb-4">{label}</h3>
            <div className="flex items-center justify-center">
                <div className="relative">
                    <svg width="140" height="140" className="-rotate-90">
                        {/* Background circle */}
                        <circle
                            cx="70" cy="70" r={radius}
                            fill="none"
                            stroke="rgba(255,255,255,0.08)"
                            strokeWidth="10"
                        />
                        {/* Score arc */}
                        <circle
                            cx="70" cy="70" r={radius}
                            fill="none"
                            stroke={color}
                            strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            style={{ transition: 'stroke-dashoffset 1s ease-in-out, stroke 0.5s ease' }}
                        />
                    </svg>
                    {/* Center text */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-3xl font-light text-foreground">{Math.round(score)}</span>
                        <span
                            className="text-lg font-bold mt-1"
                            style={{ color }}
                        >
                            {grade}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
