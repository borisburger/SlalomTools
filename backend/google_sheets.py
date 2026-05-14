import os
import json
import base64
import time
import re
from io import StringIO
import pandas as pd
from typing import List, Dict, Tuple, Optional, Any
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import requests

# Load configuration
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
with open(CONFIG_FILE) as f:
    config = json.load(f)

# Constants
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid'
]
_BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(_BACKEND_DIR, "cache")
os.makedirs(CACHE_DIR, exist_ok=True)

TOKEN_CACHE_FILE = os.path.join(CACHE_DIR, "google_token_cache.json")
METADATA_CACHE_FILE = os.path.join(CACHE_DIR, "sheet_metadata_cache.json")
REGISTRATION_DATA_CACHE_FILE = os.path.join(CACHE_DIR, "registration_data_cache.json")


def _migrate_legacy_cache_file(filename: str):
    """Move a cache file from `backend/<filename>` to `backend/cache/<filename>`.

    No-op if the legacy file is missing or the new file already exists.
    """
    legacy_path = os.path.join(_BACKEND_DIR, filename)
    new_path = os.path.join(CACHE_DIR, filename)
    if os.path.exists(legacy_path) and not os.path.exists(new_path):
        try:
            os.replace(legacy_path, new_path)
            print(f"Migrated cache file: {filename} -> cache/{filename}")
        except Exception as e:
            print(f"Failed to migrate {filename}: {e}")


for _f in ("google_token_cache.json", "sheet_metadata_cache.json", "registration_data_cache.json"):
    _migrate_legacy_cache_file(_f)

# Load secrets (create if doesn't exist)
SECRETS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "google_secrets.json")
if not os.path.exists(SECRETS_FILE):
    with open(SECRETS_FILE, 'w') as f:
        json.dump({
            "installed": {
                "client_id": "",
                "client_secret": "",
                "redirect_uris": ["http://localhost"],
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token"
            }
        }, f, indent=2)
    print(f"Created empty Google API secrets file at {SECRETS_FILE}. Please fill in your client_id and client_secret.")

# Authentication state
auth_state = {"credentials": None, "is_authenticated": False, "flow": None}

# Per-spreadsheet metadata cache. The Sheets `spreadsheets().get` round-trip is
# slow (~1-3.5 s) even with a `fields` mask, but the metadata we need from it
# (first sheet's title, document title) doesn't change often. Cache it keyed
# by spreadsheet_id so repeated loads of the same sheet skip the round-trip
# entirely. The cache is also persisted to disk so it survives server
# restarts; it self-heals on a stale-range error from `values().get`.
_sheet_metadata_cache: dict = {}


def _load_metadata_cache_from_disk():
    """Populate `_sheet_metadata_cache` from the JSON file on disk."""
    global _sheet_metadata_cache
    if not os.path.exists(METADATA_CACHE_FILE):
        return
    try:
        with open(METADATA_CACHE_FILE, 'r') as f:
            data = json.load(f)
        if isinstance(data, dict):
            _sheet_metadata_cache = data
            print(f"Loaded sheet metadata cache: {len(_sheet_metadata_cache)} entries")
    except Exception as e:
        print(f"Failed to load sheet metadata cache: {e}")


def _save_metadata_cache_to_disk():
    """Atomically persist `_sheet_metadata_cache` to disk."""
    try:
        tmp_file = METADATA_CACHE_FILE + ".tmp"
        with open(tmp_file, 'w') as f:
            json.dump(_sheet_metadata_cache, f, indent=2)
        os.replace(tmp_file, METADATA_CACHE_FILE)
    except Exception as e:
        print(f"Failed to save sheet metadata cache: {e}")


_load_metadata_cache_from_disk()


# Per-spreadsheet PARSED registration data cache. Stores the full skaters +
# disciplines payload so the registration page can render instantly from disk
# without going to Google. Stale-while-revalidate: the `/registration/check-stale`
# endpoint refetches and updates this cache in the background.
_registration_data_cache: dict = {}


def _load_registration_data_cache_from_disk():
    """Populate `_registration_data_cache` from the JSON file on disk."""
    global _registration_data_cache
    if not os.path.exists(REGISTRATION_DATA_CACHE_FILE):
        return
    try:
        with open(REGISTRATION_DATA_CACHE_FILE, 'r') as f:
            data = json.load(f)
        if isinstance(data, dict):
            _registration_data_cache = data
            print(f"Loaded registration data cache: {len(_registration_data_cache)} entries")
    except Exception as e:
        print(f"Failed to load registration data cache: {e}")


def _save_registration_data_cache_to_disk():
    """Atomically persist `_registration_data_cache` to disk."""
    try:
        tmp_file = REGISTRATION_DATA_CACHE_FILE + ".tmp"
        with open(tmp_file, 'w') as f:
            json.dump(_registration_data_cache, f, indent=2, default=str)
        os.replace(tmp_file, REGISTRATION_DATA_CACHE_FILE)
    except Exception as e:
        print(f"Failed to save registration data cache: {e}")


def get_cached_registration_data(spreadsheet_id: str):
    """Return cached registration payload for a spreadsheet, or None."""
    return _registration_data_cache.get(spreadsheet_id)


def set_cached_registration_data(spreadsheet_id: str, payload: dict):
    """Store the registration payload in cache and persist to disk."""
    _registration_data_cache[spreadsheet_id] = payload
    _save_registration_data_cache_to_disk()


_load_registration_data_cache_from_disk()


def load_token_cache():
    """Load the token cache from JSON file if it exists."""
    global auth_state
    print(f"Attempting to load Google token cache from: {TOKEN_CACHE_FILE}")
    if not os.path.exists(TOKEN_CACHE_FILE):
        print("Google token cache file does not exist")
        return None
    try:
        with open(TOKEN_CACHE_FILE, 'r') as f:
            token_data = json.load(f)
        
        # Extract user info if available
        if "user_info" in token_data:
            auth_state["user_info"] = token_data.pop("user_info", {})
        
        credentials = Credentials.from_authorized_user_info(token_data, SCOPES)
        print("Successfully loaded Google token cache")
        return credentials
    except Exception as e:
        print(f"Failed to load Google token cache: {e}")
        return None

def save_token_cache(credentials):
    """Save the credentials to a JSON file."""
    if credentials and not credentials.expired:
        try:
            token_data = {
                'token': credentials.token,
                'refresh_token': credentials.refresh_token,
                'token_uri': credentials.token_uri,
                'client_id': credentials.client_id,
                'client_secret': credentials.client_secret,
                'scopes': credentials.scopes,
            }

            # Persist expiry so the loaded credentials know when they're truly
            # expired. Without this, `credentials.valid` can return True for an
            # already-expired access token, forcing every Google API call to do
            # a silent refresh round-trip.
            if credentials.expiry is not None:
                token_data['expiry'] = credentials.expiry.strftime("%Y-%m-%dT%H:%M:%S.%fZ")

            if "user_info" in auth_state:
                token_data["user_info"] = auth_state["user_info"]

            with open(TOKEN_CACHE_FILE, 'w') as f:
                json.dump(token_data, f)
            print("Successfully saved Google token cache")
        except Exception as e:
            print(f"Failed to save Google token cache: {e}")

def _fetch_and_cache_user_info(credentials):
    """Fetch user info from Google and store it in auth_state."""
    try:
        service = build('oauth2', 'v2', credentials=credentials)
        user_info_response = service.userinfo().get().execute()
        user_info = {'email': 'Unknown', 'name': 'Unknown User'}

        if 'email' in user_info_response:
            user_info['email'] = user_info_response['email']
        if 'name' in user_info_response:
            user_info['name'] = user_info_response['name']

        auth_state["user_info"] = user_info
    except Exception as e:
        print(f"Warning: Failed to fetch user info: {e}")


def get_credentials(skip_user_info: bool = False):
    """Get Google OAuth2 credentials.

    Args:
        skip_user_info: If True, don't make a Google API call to fetch the
            user's email/name. The userinfo round-trip adds ~500-700 ms and is
            only needed by the auth-status endpoint, not by sheet fetching.
    """
    global auth_state
    credentials = load_token_cache()

    if credentials and credentials.valid:
        auth_state["credentials"] = credentials
        auth_state["is_authenticated"] = True

        # Only fetch user info on demand and only if we don't already have it.
        needs_user_info = (
            not auth_state.get("user_info")
            or auth_state.get("user_info", {}).get("email") == "Unknown"
        )
        if not skip_user_info and needs_user_info:
            _fetch_and_cache_user_info(credentials)
            save_token_cache(credentials)

        return credentials

    if credentials and credentials.expired and credentials.refresh_token:
        try:
            credentials.refresh(Request())
            auth_state["credentials"] = credentials
            auth_state["is_authenticated"] = True

            if not skip_user_info:
                _fetch_and_cache_user_info(credentials)

            save_token_cache(credentials)
            return credentials
        except Exception as e:
            print(f"Failed to refresh token: {e}")

    return None

def initiate_auth_flow():
    """Initiate the OAuth2 flow for Google API."""
    global auth_state
    try:
        with open(SECRETS_FILE, 'r') as f:
            client_config = json.load(f)
        
        # Use the frontend URL for redirection
        frontend_redirect_uri = "http://localhost:8000/reg"
        
        flow = InstalledAppFlow.from_client_config(
            client_config, SCOPES, redirect_uri=frontend_redirect_uri)
        
        auth_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent')
        
        # Save the flow state for the callback
        auth_state["flow"] = flow
        auth_state["is_authenticated"] = False
        
        return {
            "auth_url": auth_url,
            "message": "Please visit this URL to authorize access to Google Sheets:"
        }
    except Exception as e:
        error_msg = f"Failed to initiate Google authentication: {str(e)}"
        print(error_msg)
        return {"error": error_msg}

def complete_auth_flow(code):
    """Complete the OAuth2 flow for Google API."""
    global auth_state
    try:
        flow = auth_state.get("flow")
        if not flow:
            print("No authentication flow in progress, creating a new one")
            # Try to create a new flow from the saved configuration
            with open(SECRETS_FILE, 'r') as f:
                client_config = json.load(f)
            
            frontend_redirect_uri = "http://localhost:8000/reg"
            flow = InstalledAppFlow.from_client_config(
                client_config, SCOPES, redirect_uri=frontend_redirect_uri)
            
        try:
            # Exchange the authorization code for credentials with scope tolerance
            print(f"Fetching token with code: {code[:5]}... (truncated)")
            try:
                flow.fetch_token(code=code)
            except Exception as scope_error:
                # If there's a scope change error, try a workaround
                if "Scope has changed" in str(scope_error):
                    print(f"Handling scope change: {scope_error}")
                    # Directly get the token from the auth code using the redirect URI
                    token_url = "https://oauth2.googleapis.com/token"
                    data = {
                        'code': code,
                        'client_id': client_config['installed']['client_id'],
                        'client_secret': client_config['installed']['client_secret'],
                        'redirect_uri': frontend_redirect_uri,
                        'grant_type': 'authorization_code'
                    }
                    response = requests.post(token_url, data=data)
                    if response.status_code != 200:
                        raise Exception(f"Token request failed: {response.text}")
                    
                    token_data = response.json()
                    credentials = Credentials(
                        token=token_data['access_token'],
                        refresh_token=token_data.get('refresh_token'),
                        token_uri=client_config['installed']['token_uri'],
                        client_id=client_config['installed']['client_id'],
                        client_secret=client_config['installed']['client_secret'],
                        scopes=SCOPES
                    )
                else:
                    raise scope_error
            else:
                # If no error, get credentials from flow
                credentials = flow.credentials
            
            # Extract user information if available
            user_info = {'email': 'Unknown', 'name': 'Unknown User'}
            try:
                # Try to get email from id_token if available
                if hasattr(credentials, 'id_token') and credentials.id_token:
                    if isinstance(credentials.id_token, dict):
                        if 'email' in credentials.id_token:
                            user_info['email'] = credentials.id_token.get('email')
                        if 'name' in credentials.id_token:
                            user_info['name'] = credentials.id_token.get('name')
                
                # If we didn't get an email from id_token, try to fetch it from userinfo endpoint
                if user_info['email'] == 'Unknown':
                    # Use the credentials to call the userinfo endpoint
                    service = build('oauth2', 'v2', credentials=credentials)
                    user_info_response = service.userinfo().get().execute()
                    if 'email' in user_info_response:
                        user_info['email'] = user_info_response['email']
                    if 'name' in user_info_response:
                        user_info['name'] = user_info_response['name']
                
                print(f"User authenticated: {user_info['email']}")
            except Exception as info_err:
                print(f"Could not extract user info: {info_err}")
            
            auth_state["credentials"] = credentials
            auth_state["is_authenticated"] = True
            auth_state["flow"] = None
            auth_state["user_info"] = user_info
            
            save_token_cache(credentials)
            
            print("Authentication successful!")
            return {
                "success": True,
                "message": "Successfully authenticated with Google",
                "user_info": user_info
            }
        except Exception as e:
            print(f"Error fetching token: {e}")
            return {"error": f"Error fetching token: {str(e)}"}
            
    except Exception as e:
        error_msg = f"Failed to complete Google authentication: {str(e)}"
        print(error_msg)
        return {"error": error_msg}

def extract_spreadsheet_id_from_url(url):
    """Extract the spreadsheet ID from a Google Sheets URL."""
    match = re.search(r'/spreadsheets/d/([a-zA-Z0-9-_]+)', url)
    if match:
        return match.group(1)
    return None


def _fetch_and_cache_sheet_metadata(service, spreadsheet_id):
    """Fetch first-sheet title + document title from Google and update caches.

    Returns (sheet_title, document_title).
    """
    spreadsheet = service.spreadsheets().get(
        spreadsheetId=spreadsheet_id,
        fields="properties/title,sheets(properties/title)",
    ).execute()
    sheet_title = spreadsheet['sheets'][0]['properties']['title']
    document_title = spreadsheet.get('properties', {}).get('title', 'Google Sheet')
    _sheet_metadata_cache[spreadsheet_id] = {
        "sheet_title": sheet_title,
        "document_title": document_title,
    }
    _save_metadata_cache_to_disk()
    return sheet_title, document_title

def fetch_spreadsheet_data(url):
    """Fetch data from Google Sheets."""
    t_total_start = time.perf_counter()
    try:
        credentials = get_credentials(skip_user_info=True)
        if not credentials:
            return {"error": "Not authenticated with Google"}

        spreadsheet_id = extract_spreadsheet_id_from_url(url)
        if not spreadsheet_id:
            return {"error": "Invalid Google Sheets URL"}

        service = build('sheets', 'v4', credentials=credentials)

        cached_meta = _sheet_metadata_cache.get(spreadsheet_id)
        cache_was_used = cached_meta is not None
        if cache_was_used:
            sheet_title = cached_meta["sheet_title"]
            document_title = cached_meta["document_title"]
        else:
            sheet_title, document_title = _fetch_and_cache_sheet_metadata(service, spreadsheet_id)

        try:
            result = service.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id,
                range=sheet_title,
            ).execute()
        except HttpError as e:
            # Self-heal: if our cached `sheet_title` is stale (e.g. user
            # renamed the first tab), Google returns 400 "Unable to parse
            # range". Evict the cache entry, refetch metadata, and retry once.
            if cache_was_used and "Unable to parse range" in str(e):
                print(f"Stale sheet metadata cache for {spreadsheet_id}, refetching")
                _sheet_metadata_cache.pop(spreadsheet_id, None)
                _save_metadata_cache_to_disk()
                sheet_title, document_title = _fetch_and_cache_sheet_metadata(service, spreadsheet_id)
                result = service.spreadsheets().values().get(
                    spreadsheetId=spreadsheet_id,
                    range=sheet_title,
                ).execute()
            else:
                raise

        values = result.get('values', [])
        if not values:
            return {"error": "No data found in the spreadsheet"}

        df = pd.DataFrame(values[1:], columns=values[0])
        csv_data = df.to_csv(index=False)

        print(f"[timing fetch_spreadsheet_data] TOTAL: {(time.perf_counter() - t_total_start) * 1000:.1f} ms")
        return {
            "success": True,
            "csv_data": csv_data,
            "sheet_title": sheet_title,
            "document_title": document_title
        }
    except HttpError as error:
        return {"error": f"Google Sheets API error: {error}"}
    except Exception as e:
        return {"error": f"Error fetching spreadsheet data: {str(e)}"}

def parse_registration_data(csv_data):
    """Parse registration data from CSV."""
    t_total_start = time.perf_counter()
    try:
        df = pd.read_csv(StringIO(csv_data))

        default_nationality = config.get("registration", {}).get("default_nationality", "SVK")

        # Drop columns with blank headers (pandas reads them as NaN floats)
        df = df.loc[:, df.columns.map(lambda c: isinstance(c, str))]

        name_col = next((col for col in df.columns if "name" in col.lower() or "meno" in col.lower()), None)
        surname_col = next((col for col in df.columns if "surname" in col.lower() or "priezvisko" in col.lower()), None)
        ws_id_col = next((col for col in df.columns if "world" in col.lower() and "id" in col.lower()), None)
        dob_col = next((col for col in df.columns if "birth" in col.lower() or "naroden" in col.lower()), None)
        sex_col = next((col for col in df.columns if "sex" in col.lower() or "pohlavie" in col.lower()), None)
        nationality_col = next((col for col in df.columns if "nationality" in col.lower() or "národnosť" in col.lower()), None)
        disciplines_col = next((col for col in df.columns if "discip" in col.lower()), None)
        phone_col = next((col for col in df.columns if "phone" in col.lower() or "telef" in col.lower()), None)
        club_col = next((col for col in df.columns if "club" in col.lower() or "klub" in col.lower()), None)
        email_col = next((col for col in df.columns if "email" in col.lower()), None)
        timestamp_col = next((col for col in df.columns if "timestamp" in col.lower()), None)

        all_disciplines = []
        if disciplines_col:
            for disciplines in df[disciplines_col].dropna():
                all_disciplines.extend([d.strip() for d in str(disciplines).split(',')])
        unique_disciplines = sorted(list(set(all_disciplines)))

        def _cell(col, fallback=""):
            """Return a cell value as a string, converting pandas NaN to fallback."""
            if col is None:
                return fallback
            val = row.get(col, fallback)
            if pd.isna(val):
                return fallback
            return str(val)

        skaters = []
        for _, row in df.iterrows():
            # Process World Skate ID
            ws_id = _cell(ws_id_col)
            is_valid_ws_id = False
            if ws_id and ws_id != "NEW":
                ws_id_pattern = r'^[12]\d{4}[A-Z]{3}\d+'
                is_valid_ws_id = bool(re.match(ws_id_pattern, ws_id))
            
            # Process disciplines
            disciplines = []
            disc_val = _cell(disciplines_col)
            if disc_val:
                disciplines = [d.strip() for d in disc_val.split(',')]
            
            # Process sex
            sex = _cell(sex_col)
            sex_code = "F" if sex and ("female" in sex.lower() or sex.lower().startswith("žen") or sex.lower() == "f") else "M"
            
            name = _cell(name_col)
            surname = _cell(surname_col)
            skater = {
                "name": name,
                "surname": surname,
                "full_name": f"{surname} {name}" if surname_col and name_col else "",
                "world_skate_id": ws_id if is_valid_ws_id else "",
                "dob": _cell(dob_col),
                "sex": sex_code,
                "nationality": _cell(nationality_col, default_nationality),
                "disciplines": disciplines,
                "phone": _cell(phone_col),
                "club": _cell(club_col),
                "email": _cell(email_col),
                "timestamp": _cell(timestamp_col),
            }
            skaters.append(skater)

        print(f"[timing parse_registration_data] TOTAL: {(time.perf_counter() - t_total_start) * 1000:.1f} ms")
        return {
            "success": True,
            "skaters": skaters,
            "disciplines": unique_disciplines
        }
    except Exception as e:
        return {"error": f"Error parsing registration data: {str(e)}"} 