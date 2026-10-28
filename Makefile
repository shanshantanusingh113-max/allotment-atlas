.PHONY: help install test api web export data parity

help:            ## Show this help
	@grep -E '^[a-z]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

install:         ## Install backend dependencies
	cd backend && pip install -r requirements-dev.txt

test: parity     ## Run backend tests and the browser-engine parity test
	cd backend && python -m pytest

parity:          ## Check the browser engine matches the Python optimiser
	node frontend/tests/engine.test.mjs

api:             ## Run the API on :8000
	cd backend && uvicorn app.main:app --reload --port 8000

web:             ## Serve the frontend on :5173
	cd frontend && python3 -m http.server 5173

export:          ## Re-run the pipeline and refresh frontend/data/atlas.json
	cd backend && python -m scripts.export_frontend

data:            ## Write the synthetic history to backend/data/*.csv
	cd backend && python -m scripts.generate_data
