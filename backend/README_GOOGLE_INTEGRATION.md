# Google Sheets Integration - Registration Management

This document explains how to set up and use the Google Sheets integration for managing registration data in the Freestyle Scoring System.

## Setup Instructions

### 1. Create a Google Cloud Project and Enable the Sheets API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use an existing one)
3. Enable the Google Sheets API for your project:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Sheets API"
   - Click on it and press "Enable"

### 2. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Set the application type to "Desktop app"
4. Give it a name (e.g., "Freestyle Scoring System")
5. Click "Create"
6. You'll receive a client ID and client secret - you'll need these for the next step
7. In "OAuth consent screen" > "Audience" you need to add "Test users", who are the only users who will be able to access the application.

### 3. Configure the Application

1. Copy the file `google_secrets_template.json` to `google_secrets.json`
2. Edit `google_secrets.json` to replace the placeholders with your actual client ID and client secret
3. **Important**: Make sure the redirect URI in your Google Cloud Console matches exactly: `http://localhost:8000/reg`

### 4. Build the Frontend Application

1. After making any changes to the frontend code, you need to build it so that the backend can serve it:
   - On Linux/Mac: Run the `./build_frontend.sh` script
   - On Windows: Run the `.\build_frontend.ps1` script in PowerShell

2. **Important**: The React build must be located at `frontend/build/` for the backend to correctly serve it.

### 5. Start the Backend Server

1. Once the frontend is built, start the backend server:
   ```
   uvicorn backend.main:app --reload
   ```
2. The application will be available at `http://localhost:8000`

## Usage Instructions

### Authenticating with Google

1. Navigate to the Registration Management page (/reg) from the Operator Console
2. Click the "Authenticate with Google" button
3. A new browser window will open with Google's authentication flow
4. Sign in with your Google account and grant the necessary permissions
5. Once authentication is complete, you'll be redirected back to the Registration Management page
6. Note: Only users you've added as "Test users" in the Google Cloud Console will be able to authenticate

### Troubleshooting Authentication Issues

If you see redirect loops or "too many redirects" errors:

1. Make sure you've built the frontend with the provided build script
2. Verify the build files are in the `frontend/build/` directory
3. Check that the backend is correctly serving these files
4. Clear your browser cache and cookies for `localhost:8000`
5. Verify that the redirect URI in your Google Cloud Console exactly matches: `http://localhost:8000/reg`

### Loading Registration Data

1. After authenticating, enter the Google Sheets URL in the input field
2. The URL should be the sharing link of your Google Sheets document containing registration data
3. Make sure the Google Sheet is shared with appropriate permissions (at least view access)
4. Click "Load Data" to retrieve the registration information

### Using the Registration Management Features

- **Filter by Discipline**: Click on any discipline button to show only skaters registered for that specific discipline
- **Filter by Gender**: Use the gender filter buttons to show only male or female skaters
- **Display Presets**: Choose between different view presets to display the registration data in various formats

## Troubleshooting

- If authentication fails, make sure your OAuth credentials are correct in the `google_secrets.json` file
- If you get a "Not Found" error after authentication, make sure you've built the frontend and the backend is serving it correctly
- If you encounter redirect loops, clear your browser cookies and cache, then try again
- If you can't load a spreadsheet, check that you have the correct sharing URL and that the sheet is accessible
- The URL is saved in your browser's local storage, so you won't need to re-enter it on subsequent visits
- Check that the redirect URI in your Google Cloud Console matches `http://localhost:8000/reg`

## Data Column Mapping

The system automatically maps columns in your Google Sheet based on these naming patterns:

- **Name**: Columns containing "name" or "meno"
- **Surname**: Columns containing "surname" or "priezvisko"
- **World Skate ID**: Columns containing "world" and "id"
- **Date of Birth**: Columns containing "birth" or "naroden"
- **Sex/Gender**: Columns containing "sex" or "pohlavie"
- **Nationality**: Columns containing "nationality" or "národnosť"
- **Disciplines**: Columns containing "discip"
- **Phone**: Columns containing "phone" or "telef"
- **Club**: Columns containing "club" or "klub"
- **Email**: Columns containing "email"
- **Timestamp**: Columns containing "timestamp" 