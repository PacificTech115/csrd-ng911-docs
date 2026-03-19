import sys
from agent import agent
from langchain_core.messages import HumanMessage

res = []
for e, m in agent.stream(
    {"messages": [HumanMessage(content='hi')]}, 
    config={'configurable': {'thread_id':'123'}}, 
    stream_mode='messages'
):
    t = getattr(e, "type", "none")
    c = getattr(e, "content", None)
    lc = len(c) if isinstance(c, (str, list)) else 0
    cr = repr(c)
    res.append(f"type: {t}, len: {lc}, content: {cr}")

with open('test_stream.txt', 'w') as f:
    f.write('\n'.join(res))
print("Done")
