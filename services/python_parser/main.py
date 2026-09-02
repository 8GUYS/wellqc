from fastapi import FastAPI

app = FastAPI(title="WellQC Python Parser Service")

@app.get("/health")
def health_check():
    return {"status": "ok"}