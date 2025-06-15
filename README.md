# Integrations Technical Assessment - VectorShift

This repository contains the implementation of the HubSpot integration developed as part of the VectorShift technical assessment.

# Project Overview

The objective of this assessment is to build a working OAuth 2.0 integration with HubSpot that:

* Initiates the OAuth flow
* Stores and retrieves credentials using Redis
* Fetches contact data using the HubSpot API
* Returns standardized `IntegrationItem` objects compatible with the existing integration structure

# Features Implemented

# OAuth Integration

* Initiates OAuth authorization using `/authorize`
* Handles callback through `/oauth2callback`
* Exchanges the authorization code for access and refresh tokens
* Persists credentials in Redis using a composite key (`user_id` and `org_id`)

# Contact Fetching

* Retrieves credentials via `/credentials`
* Fetches contact records through HubSpot's `/crm/v3/objects/contacts` endpoint
* Transforms each contact into an `IntegrationItem` object
* Logs the list of integration items to the console for validation

# Technology Stack

* **Backend**: FastAPI, httpx, Redis
* **Frontend**: React, Material UI (MUI), Axios
* **OAuth Provider**: HubSpot Developer App

# Setup Instructions

# 1. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

Ensure Redis is running before launching the backend:

```bash
cd path/to/redis-folder
./redis-server.exe
```

# 2. Frontend Setup

```bash
cd frontend
npm install
npm start
```

# 3. Testing the Integration

* Enter a `user_id` and `org_id`, and select **HubSpot** from the integration type dropdown.
* Click **Connect to HubSpot** and complete the OAuth process.
* Upon completion, click **Load HubSpot Data (to Console)**.
* The results will be printed to the backend terminal.

# Project Structure

```
backend/
  integrations/
    hubspot.py
    integration_item.py
  main.py
  redis_client.py
frontend/
  hubspot.js
  data-form.js
  integration-form.js
```

# Implementation Notes

* Redis keys are structured as `hubspot_credentials:{user_id}:{org_id}`.
* Credentials are deleted after retrieval to simulate single-use access, consistent with the Airtable logic.

