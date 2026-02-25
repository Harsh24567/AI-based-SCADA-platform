"""
AI SCADA Platform — AI Agent Orchestrator (Modern Gemini Edition)

Uses the new google-genai SDK to manage conversation and execute tool calls.
"""

import os
import json
from typing import List, Dict, Any, Optional
from google import genai
from .tools import query_latest_metrics, query_historical_stats, get_active_alarms

class SCADAAgent:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("GOOGLE_API_KEY")
        
        if not self.api_key:
            raise ValueError("Valid Google API Key not found. Please provide it in .env as GOOGLE_API_KEY.")
            
        self.client = genai.Client(api_key=self.api_key)
        # Use the string that was confirmed working in the standalone test
        self.model_id = "gemini-flash-latest" 
        
        # Define the tools for Gemini (using the simplified list format for the new SDK)
        self.tools = [query_latest_metrics, query_historical_stats, get_active_alarms]
        
    def ask(self, message: str, history: List[Dict] = None) -> str:
        """Process a user message using Gemini with automatic tool calling."""
        try:
            # The modern SDK handles tool calls automatically if config is set
            response = self.client.models.generate_content(
                model=self.model_id,
                contents=message,
                config={
                    "tools": self.tools,
                    "system_instruction": "You are the ELECSOL SCADA AI Assistant. You help monitor factory machines and alarms. Always use tools to verify data."
                }
            )
            
            return response.text
            
        except Exception as e:
            return f"I encountered an error while processing your request: {str(e)}"
