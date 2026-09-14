import os
from dotenv import load_dotenv
from langchain_cohere import ChatCohere, CohereEmbeddings
load_dotenv()

def get_llm(provider: str = None, model: str = None):
    if provider is None:
        provider = os.getenv("DEFAULT_PROVIDER")
    if model is None:
        model = os.getenv("DEFAULT_MODEL")

    if provider == "cohere":
        return ChatCohere(model=model)
    elif provider == "groq":
        from langchain_groq import ChatGroq
        return ChatGroq(model=model)
    elif provider == "openai":
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model=model)
    elif provider == "gemini":
        from langchain_google_genai import ChatGoogleGenerativeAI
        return ChatGoogleGenerativeAI(model=model)
    else:
        raise ValueError(f"Unknown provider: {provider}")
    

def get_embeddings():
    from langchain_cohere import CohereEmbeddings
    return CohereEmbeddings(
        cohere_api_key=os.getenv("COHERE_API_KEY"),
        model="embed-english-v3.0"
    )
    