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

# Constants
SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid'
]
TOKEN_CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "google_token_cache.json")

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
                'scopes': credentials.scopes
            }
            
            # Add user info if available
            if "user_info" in auth_state:
                token_data["user_info"] = auth_state["user_info"]
            
            with open(TOKEN_CACHE_FILE, 'w') as f:
                json.dump(token_data, f)
            print("Successfully saved Google token cache")
        except Exception as e:
            print(f"Failed to save Google token cache: {e}")

def get_credentials():
    """Get Google OAuth2 credentials."""
    global auth_state
    credentials = load_token_cache()

    if credentials and credentials.valid:
        auth_state["credentials"] = credentials
        auth_state["is_authenticated"] = True
        
        # Ensure we have user info
        if not auth_state.get("user_info") or auth_state.get("user_info", {}).get("email") == "Unknown":
            try:
                # Try to fetch user info
                service = build('oauth2', 'v2', credentials=credentials)
                user_info_response = service.userinfo().get().execute()
                user_info = {'email': 'Unknown', 'name': 'Unknown User'}
                
                if 'email' in user_info_response:
                    user_info['email'] = user_info_response['email']
                if 'name' in user_info_response:
                    user_info['name'] = user_info_response['name']
                
                auth_state["user_info"] = user_info
                save_token_cache(credentials)  # Update the cache with user info
            except Exception as e:
                print(f"Warning: Failed to fetch user info: {e}")
        
        return credentials
    
    if credentials and credentials.expired and credentials.refresh_token:
        try:
            credentials.refresh(Request())
            auth_state["credentials"] = credentials
            auth_state["is_authenticated"] = True
            
            # After refresh, try to update user info
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
                print(f"Warning: Failed to update user info after refresh: {e}")
            
            save_token_cache(credentials)
            return credentials
        except Exception as e:
            print(f"Failed to refresh token: {e}")
    
    # If no valid credentials, need to authenticate
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

def fetch_spreadsheet_data(url):
    """Fetch data from Google Sheets."""
    try:
        credentials = get_credentials()
        if not credentials:
            return {"error": "Not authenticated with Google"}
        
        spreadsheet_id = extract_spreadsheet_id_from_url(url)
        if not spreadsheet_id:
            return {"error": "Invalid Google Sheets URL"}
        
        service = build('sheets', 'v4', credentials=credentials)
        
        # Get spreadsheet metadata
        spreadsheet = service.spreadsheets().get(spreadsheetId=spreadsheet_id).execute()
        sheet_title = spreadsheet['sheets'][0]['properties']['title']
        document_title = spreadsheet.get('properties', {}).get('title', 'Google Sheet')
        
        # Get sheet data
        result = service.spreadsheets().values().get(
            spreadsheetId=spreadsheet_id,
            range=sheet_title
        ).execute()
        
        values = result.get('values', [])
        if not values:
            return {"error": "No data found in the spreadsheet"}
        
        # Convert to DataFrame
        df = pd.DataFrame(values[1:], columns=values[0])
        
        # Convert to CSV string
        csv_data = df.to_csv(index=False)
        
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
    try:
        df = pd.read_csv(StringIO(csv_data))
        
        # Identify columns
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
        
        # Get unique disciplines
        all_disciplines = []
        if disciplines_col:
            for disciplines in df[disciplines_col].dropna():
                all_disciplines.extend([d.strip() for d in str(disciplines).split(',')])
        unique_disciplines = sorted(list(set(all_disciplines)))
        
        # Process data
        skaters = []
        for _, row in df.iterrows():
            # Process World Skate ID
            ws_id = str(row.get(ws_id_col, "")) if ws_id_col else ""
            is_valid_ws_id = False
            if ws_id and ws_id != "nan" and ws_id != "NEW":
                # Check if it follows the World Skate ID pattern
                ws_id_pattern = r'^[12]\d{4}[A-Z]{3}\d+'
                is_valid_ws_id = bool(re.match(ws_id_pattern, ws_id))
            
            # Process disciplines
            disciplines = []
            if disciplines_col and row.get(disciplines_col):
                disciplines = [d.strip() for d in str(row.get(disciplines_col)).split(',')]
            
            # Process sex
            sex = row.get(sex_col, "") if sex_col else ""
            sex_code = "F" if sex and ("female" in sex.lower() or "žensk" in sex.lower()) else "M"
            
            skater = {
                "name": row.get(name_col, "") if name_col else "",
                "surname": row.get(surname_col, "") if surname_col else "",
                "full_name": f"{row.get(surname_col, '')} {row.get(name_col, '')}" if surname_col and name_col else "",
                "world_skate_id": ws_id if is_valid_ws_id else "",
                "dob": row.get(dob_col, "") if dob_col else "",
                "sex": sex_code,
                "nationality": row.get(nationality_col, "") if nationality_col else "",
                "disciplines": disciplines,
                "phone": row.get(phone_col, "") if phone_col else "",
                "club": row.get(club_col, "") if club_col else "",
                "email": row.get(email_col, "") if email_col else "",
                "timestamp": row.get(timestamp_col, "") if timestamp_col else ""
            }
            skaters.append(skater)
        
        return {
            "success": True,
            "skaters": skaters,
            "disciplines": unique_disciplines
        }
    except Exception as e:
        return {"error": f"Error parsing registration data: {str(e)}"} 