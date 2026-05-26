from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel

from llm_service import translate_to_variable, explain_variable

app = FastAPI(title="Code Variable Translator")

app.mount("/static", StaticFiles(directory="static"), name="static")


class TranslateRequest(BaseModel):
    concept: str
    context: str = "variable"


class ExplainRequest(BaseModel):
    name: str


@app.post("/api/translate")
async def api_translate(req: TranslateRequest):
    result = await translate_to_variable(req.concept, req.context)
    return result


@app.post("/api/explain")
async def api_explain(req: ExplainRequest):
    result = await explain_variable(req.name)
    return result


@app.get("/")
async def index():
    return FileResponse("static/index.html")
