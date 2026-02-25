from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Dict, Optional
from chatbot_engine.orchestrator import SCADAAgent

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[Dict]] = []

class ChatResponse(BaseModel):
    response: str

# Singleton instance for the demo
agent = None

def get_agent():
    global agent
    if agent is None:
        try:
            agent = SCADAAgent()
        except ValueError:
            # Fallback for when API Key is missing during development
            return None
    return agent

@router.post("/ask", response_model=ChatResponse)
async def ask_chatbot(request: ChatRequest):
    agent_instance = get_agent()
    if agent_instance is None:
        return {"response": "The AI Agent is not configured. Please set the OPENAI_API_KEY in the backend environment."}
    
    response_text = agent_instance.ask(request.message, request.history)
    return {"response": response_text}
