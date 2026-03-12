from agents.supervisor import app
from langchain_core.messages import HumanMessage
import time

def run_test():
    print("[1] Initializing state...")
    from langchain_core.messages import AIMessage
    messages = [
        HumanMessage(content="hi"),
        AIMessage(content="Hello! I'm here to assist with the CSRD NG911 system.\n\nI can help you with:\n* Database Schema queries\n* QA & Error validation logic\n* Python Automation scripts\n* Arcade Attribute Rules\n\nHow can I support you today?"),
        HumanMessage(content="How many fields are there in the database")
    ]
    
    config = {"configurable": {"thread_id": "1234"}}
    
    start_time = time.time()
    try:
        print("[2] Triggering LangGraph...")
        last_time = time.time()
        for event in app.stream({"messages": messages}, config=config, stream_mode="messages"):
            msg = event[0]
            metadata = event[1]
            if msg.content:
                current_time = time.time()
                print(f"[+{current_time - last_time:.2f}s] Type: {type(msg).__name__} | Node: {metadata.get('langgraph_node')} | Text: {msg.content[:20]}...")
                last_time = current_time
                
        end_time = time.time()
        print(f"[3] Success! Took {end_time - start_time:.2f} seconds.")
    except Exception as e:
        print(f"[Error] Pipeline failed: {str(e)}")

if __name__ == "__main__":
    run_test()
