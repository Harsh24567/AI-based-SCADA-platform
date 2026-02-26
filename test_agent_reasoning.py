import os
import sys
from dotenv import load_dotenv

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from chatbot_engine.orchestrator import SCADAAgent

def test_agent():
    print("--- AI Agent Test ---")
    try:
        agent = SCADAAgent()
        print("Agent initialized successfully.")
        
        # Test 1: Simple Status Query
        print("\nQuerying Agent: 'What is the latest status of MOTOR_1?'")
        response = agent.ask("What is the latest status of MOTOR_1?")
        print(f"Agent Response: {response}")
        
        # Test 2: Alarm Query
        print("\nQuerying Agent: 'Are there any active alarms?'")
        response = agent.ask("Are there any active alarms?")
        print(f"Agent Response: {response}")
        
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    load_dotenv()
    test_agent()
