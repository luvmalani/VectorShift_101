# hubspot.py
import json
import secrets
import httpx
import asyncio
# base64 is not needed for HubSpot state as it's a simple string

from fastapi import Request, HTTPException
from starlette.responses import HTMLResponse # HTMLResponse is not used in this subtask but good to have for future
from datetime import datetime, timezone

from backend.lib.redis_client import add_key_value_redis, get_value_redis, delete_key_redis
from .integration_item import IntegrationItem

HUBSPOT_CLIENT_ID = "hubspot-client-id-placeholder"
HUBSPOT_CLIENT_SECRET = "hubspot-client-secret-placeholder"
HUBSPOT_REDIRECT_URI = "http://localhost:8000/integrations/hubspot/oauth2callback"
HUBSPOT_AUTHORIZATION_URL = "https://app.hubspot.com/oauth/authorize"
HUBSPOT_TOKEN_URL = "https://api.hubapi.com/oauth/v1/token"
HUBSPOT_SCOPES = "oauth crm.objects.contacts.read"


async def authorize_hubspot(user_id: str, org_id: str):
    state = secrets.token_urlsafe(32)
    state_data = {
        "state": state,
        "user_id": user_id,
        "org_id": org_id,
    }
    await add_key_value_redis(f"hubspot_oauth_state:{state}", json.dumps(state_data), expire_secs=600)

    params = {
        "client_id": HUBSPOT_CLIENT_ID,
        "redirect_uri": HUBSPOT_REDIRECT_URI,
        "scope": HUBSPOT_SCOPES,
        "state": state,
        "response_type": "code", # Explicitly adding, though often default
    }
    # Construct URL with query parameters
    # httpx.URL can handle this, or f-string with urllib.parse.urlencode
    # For simplicity and since httpx is already imported:
    auth_url = httpx.URL(HUBSPOT_AUTHORIZATION_URL, params=params)
    return str(auth_url)


async def oauth2callback_hubspot(request: Request):
    code = request.query_params.get('code')
    received_state = request.query_params.get('state')
    error = request.query_params.get('error')

    if error:
        raise HTTPException(status_code=400, detail=f"Error during HubSpot OAuth: {error}")

    if not received_state:
        raise HTTPException(status_code=400, detail="State parameter missing in HubSpot OAuth callback.")

    saved_state_json = await get_value_redis(f"hubspot_oauth_state:{received_state}")

    if not saved_state_json:
        raise HTTPException(status_code=400, detail="Invalid or expired state in HubSpot OAuth callback.")

    saved_state_data = json.loads(saved_state_json)
    original_user_id = saved_state_data.get('user_id')
    original_org_id = saved_state_data.get('org_id')
    original_state_token = saved_state_data.get('state')

    if not original_user_id or not original_org_id or not original_state_token:
        raise HTTPException(status_code=400, detail="Required information missing from saved state.")

    if received_state != original_state_token:
        raise HTTPException(status_code=400, detail="State mismatch in HubSpot OAuth callback.")

    await delete_key_redis(f"hubspot_oauth_state:{received_state}")

    # Exchange authorization code for tokens
    token_data = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": HUBSPOT_REDIRECT_URI,
        "client_id": HUBSPOT_CLIENT_ID,
        "client_secret": HUBSPOT_CLIENT_SECRET,
    }
    async with httpx.AsyncClient() as client:
        try:
            token_response = await client.post(HUBSPOT_TOKEN_URL, data=token_data)
            token_response.raise_for_status()  # Raises HTTPStatusError for 4xx/5xx responses
        except httpx.HTTPStatusError as e:
            # Attempt to get more details from response if possible
            error_details = e.response.text
            try:
                error_json = e.response.json()
                error_details = error_json.get("message", error_details)
            except ValueError: # If response is not JSON
                pass
            raise HTTPException(status_code=e.response.status_code,
                                detail=f"HubSpot token exchange failed: {error_details}")
        except httpx.RequestError as e:
            # For network errors or other request-related issues
            raise HTTPException(status_code=500, detail=f"HubSpot token exchange request failed: {str(e)}")

    token_json = token_response.json()
    access_token = token_json.get("access_token")
    refresh_token = token_json.get("refresh_token")
    expires_in = token_json.get("expires_in")

    if not access_token:
        raise HTTPException(status_code=500, detail="Access token not found in HubSpot response.")

    # Store credentials in Redis
    credentials_to_store = {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "expires_in": expires_in,
        # Optionally, calculate and store expiry_timestamp = time.time() + expires_in
    }
    await add_key_value_redis(
        f"hubspot_credentials:{original_org_id}:{original_user_id}",
        json.dumps(credentials_to_store),
        expire_secs=600  # Aligning with Airtable example, can be adjusted
    )

    # Return HTML to close the OAuth window
    html_content = """
    <html>
        <script>
            window.close();
        </script>
    </html>
    """
    return HTMLResponse(content=html_content)


async def get_hubspot_credentials(user_id: str, org_id: str):
    credentials_json = await get_value_redis(f"hubspot_credentials:{org_id}:{user_id}")
    if not credentials_json:
        raise HTTPException(status_code=404, detail="HubSpot credentials not found.")

    # As per prompt, delete after retrieval.
    # This pattern might be for short-lived credential fetching for a single operation.
    # If credentials are meant to be long-lived and re-used, deleting them here might be premature.
    # However, following the prompt for now.
    await delete_key_redis(f"hubspot_credentials:{org_id}:{user_id}")

    return json.loads(credentials_json)


def parse_hubspot_date(date_str: str | None) -> datetime | None:
    if not date_str:
        return None
    try:
        # HubSpot dates are typically UTC, e.g., "2019-10-30T03:30:17.883Z"
        if date_str.endswith('Z'):
            # Replace 'Z' with '+00:00' for full ISO 8601 compatibility if fromisoformat doesn't handle 'Z' directly
            # Python 3.11+ fromisoformat handles 'Z' directly. For older versions, this replacement is safer.
            date_str = date_str[:-1] + '+00:00'
        dt = datetime.fromisoformat(date_str)
        # Ensure it's offset-aware and normalized to UTC. If already UTC and offset-aware, this is fine.
        # If it was naive, this would assume it's UTC.
        if dt.tzinfo is None:
             return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except ValueError:
        # Log a warning here if proper logging is set up
        # print(f"Warning: Could not parse HubSpot date string: {date_str}")
        return None


async def create_integration_item_metadata_object(hubspot_item_json: dict, item_type: str) -> IntegrationItem:
    item_id = hubspot_item_json.get('id')
    properties = hubspot_item_json.get('properties', {})

    firstname = properties.get('firstname', '')
    lastname = properties.get('lastname', '')
    contact_name = f"{firstname} {lastname}".strip()
    name = contact_name if contact_name else properties.get('email', f"Contact {item_id}")

    # HubSpot API v3 uses 'archived' boolean field at the top level of the object
    archived = hubspot_item_json.get('archived', False)

    # URL construction can be tricky without portal ID.
    # Example for contacts: https://app.hubspot.com/contacts/{PORTAL_ID}/contact/{item_id}/
    # Since PORTAL_ID is not directly available in standard contact object, we'll omit URL for now.
    item_url = None

    return IntegrationItem(
        id=f"hubspot_{item_type.lower().replace(' ', '_')}_{item_id}", # e.g., hubspot_contact_12345
        name=name,
        type=item_type, # e.g., "HubSpot Contact"
        creation_time=parse_hubspot_date(properties.get('createdate')),
        last_modified_time=parse_hubspot_date(properties.get('lastmodifieddate')),
        url=item_url,
        visibility=not archived,
        # Other fields default to None or their default values in IntegrationItem
        parent_id=None,
        directory=None,
        children=None,
        mime_type=None,
        delta_token=None,
        drive_id=None,
    )

async def get_items_hubspot(credentials_json_str: str) -> list[IntegrationItem]:
    try:
        credentials = json.loads(credentials_json_str)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid credentials format.")

    access_token = credentials.get('access_token')
    if not access_token:
        raise HTTPException(status_code=401, detail="Access token missing from HubSpot credentials.")

    # Fetching contacts. Properties can be adjusted as needed.
    contacts_api_url_base = "https://api.hubapi.com/crm/v3/objects/contacts"
    # Specify properties to fetch, matching those used in create_integration_item_metadata_object
    properties_query = "properties=firstname,lastname,email,createdate,lastmodifieddate"

    all_items: list[IntegrationItem] = []
    current_url: str | None = f"{contacts_api_url_base}?{properties_query}"
    headers = {"Authorization": f"Bearer {access_token}"}

    async with httpx.AsyncClient() as client:
        while current_url:
            try:
                response = await client.get(current_url, headers=headers)
                response.raise_for_status()  # Raise an exception for HTTP errors (4xx or 5xx)
            except httpx.HTTPStatusError as e:
                error_detail = e.response.text
                try:
                    error_json = e.response.json()
                    if "message" in error_json:
                        error_detail = error_json["message"]
                except ValueError:
                    pass # Use raw text if not JSON
                raise HTTPException(status_code=e.response.status_code,
                                    detail=f"Failed to fetch data from HubSpot API: {error_detail}")
            except httpx.RequestError as e:
                raise HTTPException(status_code=500, detail=f"Request to HubSpot API failed: {str(e)}")

            response_data = response.json()
            results = response_data.get('results', [])

            for item_json in results:
                # The create_integration_item_metadata_object is now async
                integration_item = await create_integration_item_metadata_object(item_json, "HubSpot Contact")
                all_items.append(integration_item)

            # Handle pagination
            paging_info = response_data.get('paging')
            if paging_info and paging_info.get('next'):
                current_url = paging_info['next'].get('link')
            else:
                current_url = None

    print(f"Fetched {len(all_items)} HubSpot items: {all_items}") # As requested
    return all_items