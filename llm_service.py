import json
import httpx
from config import LLMConfig

TRANSLATE_PROMPT = """你是一个专业的代码变量命名助手。根据用户输入的中文概念和上下文类型，生成对应的英文变量名。

要求：
1. 返回纯 JSON，不要包含 markdown 代码块标记或其他文字说明
2. JSON 格式：{{"camelCase":"","snake_case":"","PascalCase":"","SCREAMING_CASE":"","abbreviation":""}}
3. 命名要语义清晰、简洁，使用常见的英文命名习惯
4. 根据上下文类型（variable/function/class/constant/boolean）调整命名风格：
   - variable: 普通变量，camelCase
   - function: 动词开头，camelCase
   - class: 名词，PascalCase
   - constant: 全大写
   - boolean: 以 is/has/can/should 开头
5. abbreviation 字段给出最简短的可用形式（3-8个字符）
6. 如果输入为空或无法处理，返回 {{"error": "无法处理该输入"}}"""

EXPLAIN_PROMPT = """你是一个代码变量名解析助手。根据用户输入的英文标识符，分析并解释其含义。

要求：
1. 返回纯 JSON，不要包含 markdown 代码块标记或其他文字说明
2. JSON 格式：{{"original":"","full_name":"","meaning_cn":"","possible_context":"","abbreviation_expansion":""}}
3. original: 原输入内容
4. full_name: 如果是缩写，给出完整拼写；如果不是缩写，原样返回
5. meaning_cn: 用中文解释这个变量名的含义
6. possible_context: 推测这个变量可能用在什么代码场景中
7. abbreviation_expansion: 逐词展开缩写，如 "usrLgnTmstmp" -> "user login timestamp"
8. 如果输入为空，返回 {{"error": "请输入变量名"}}"""


async def call_deepseek(messages: list, timeout: int = 30) -> dict:
    if not LLMConfig.is_ready():
        return {"error": "API Key 未配置，请检查 .env 文件中的 DEEPSEEK_API_KEY"}

    headers = {
        "Authorization": f"Bearer {LLMConfig.api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": LLMConfig.model,
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 500,
    }

    async with httpx.AsyncClient(timeout=timeout) as client:
        try:
            resp = await client.post(
                f"{LLMConfig.api_url}/v1/chat/completions",
                json=payload,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()
            if content.startswith("```"):
                lines = content.splitlines()
                content = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
            return json.loads(content)
        except httpx.TimeoutException:
            return {"error": "请求超时，请检查网络连接或 API 地址"}
        except httpx.HTTPStatusError as e:
            detail = ""
            try:
                detail = e.response.json().get("error", {}).get("message", "")
            except Exception:
                detail = e.response.text[:200]
            return {"error": f"API 返回错误 ({e.response.status_code}): {detail}"}
        except json.JSONDecodeError:
            return {"error": "AI 返回格式异常，请重试"}
        except Exception as e:
            return {"error": f"请求失败: {str(e)}"}


async def translate_to_variable(concept: str, context: str = "variable") -> dict:
    if not concept or not concept.strip():
        return {"error": "请输入中文概念"}

    messages = [
        {"role": "system", "content": TRANSLATE_PROMPT},
        {"role": "user", "content": f"概念: {concept.strip()}\n上下文类型: {context}"},
    ]
    return await call_deepseek(messages)


async def explain_variable(name: str) -> dict:
    if not name or not name.strip():
        return {"error": "请输入变量名"}

    messages = [
        {"role": "system", "content": EXPLAIN_PROMPT},
        {"role": "user", "content": f"变量名: {name.strip()}"},
    ]
    return await call_deepseek(messages)
