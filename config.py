import os
from dotenv import load_dotenv
load_dotenv()


class LLMConfig:
    api_key: str = os.getenv("DEEPSEEK_API_KEY", "")
    api_url: str = os.getenv("DEEPSEEK_API_URL", "https://api.deepseek.com")
    model: str = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

    @classmethod
    def is_ready(cls) -> bool:
        return bool(cls.api_key) and cls.api_key != "sk-your-deepseek-api-key-here"
