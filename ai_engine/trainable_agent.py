"""
AI SCADA Platform — Trainable AI Agent

This module implements a high-level AI agent that can be "trained" (given context/rules)
and then generate insights based on current SCADA machine states.
"""

import os
import json
import logging
import time
from typing import List, Dict, Any

# We'll support OpenAI or Google Gemini (since both are in requirements)
# Using OpenAI as default example
try:
    from openai import OpenAI
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

logger = logging.getLogger("ai_agent")

class TrainableAgent:
    def __init__(self):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY")) if HAS_OPENAI and os.getenv("OPENAI_API_KEY") else None
        
        # This will hold our "trained" context or rules
        self.context_rules: List[str] = [
            "You are an expert SCADA and Industrial IoT AI assistant.",
            "Analyze the provided machine data, anomalies, and health scores.",
            "Provide concise, actionable insights for the factory operator.",
            "If a machine's temperature is rising and vibration is high, suggest checking the bearings or cooling system.",
            "If pressure is dropping significantly, suggest checking for leaks."
        ]
        self.last_analysis_time = 0
        self.min_interval = 60 # Don't analyze more than once per minute

    def add_rule(self, rule: str):
        """Train the agent by adding a new operational rule/context."""
        self.context_rules.append(rule)
        logger.info(f"Added new rule to TrainableAgent: {rule}")

    def clear_rules(self):
        """Reset custom rules back to default."""
        self.context_rules = [
            "You are an expert SCADA and Industrial IoT AI assistant.",
            "Analyze the provided machine data, anomalies, and health scores.",
            "Provide concise, actionable insights for the factory operator."
        ]

    def _build_prompt(self, machine_data: Dict[str, Any], anomalies: List[Dict], health: Dict) -> str:
        prompt = "Current SCADA System State:\n\n"
        
        prompt += "1. System Health:\n"
        prompt += json.dumps(health, indent=2) + "\n\n"
        
        prompt += "2. Recent Anomalies:\n"
        prompt += json.dumps(anomalies[:5], indent=2) + "\n\n" # Limit to top 5
        
        prompt += "3. Machine Data Summary (Latest Buffer):\n"
        # Just summarize to avoid huge context
        for m_id, param_data in machine_data.items():
            prompt += f"  - Machine: {m_id}\n"
            for param, data_dict in param_data.items():
                if data_dict["values"]:
                    latest_val = data_dict["values"][-1]
                    avg_val = sum(data_dict["values"]) / len(data_dict["values"])
                    prompt += f"    - {param}: latest={latest_val:.2f}, avg={avg_val:.2f}\n"
        
        prompt += "\nInstructions: Based on the rules and current state, identify any immediate concerns and recommend maintenance actions. Keep it under 150 words."
        return prompt

    def generate_insights(self, machine_data: Dict[str, Any], anomalies: List[Dict], health: Dict) -> str:
        """
        Generate high-level insights based on the current system window.
        """
        if not self.client:
             return "AI Insights unavailable: OPENAI_API_KEY not configured or openai package missing."
             
        # Rate limit the API calls
        now = time.time()
        if now - self.last_analysis_time < self.min_interval:
            return None # Skip this cycle
            
        system = "\n".join(self.context_rules)
        user_prompt = self._build_prompt(machine_data, anomalies, health)
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini", # Fast & cheap
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=250,
                temperature=0.3
            )
            insight = response.choices[0].message.content.strip()
            self.last_analysis_time = time.time()
            return insight
            
        except Exception as e:
            logger.error(f"Error generating AI insight: {e}")
            return f"Error connecting to LLM service: {str(e)}"
