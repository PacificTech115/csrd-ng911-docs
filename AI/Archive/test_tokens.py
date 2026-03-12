from core.llm_config import get_llm
llm = get_llm()
res = llm.invoke("Hi")
print("USAGE METADATA:", res.usage_metadata)
print("RESPONSE METADATA:", res.response_metadata)
