Write-Host "Building the frontend application..."

# Navigate to the frontend directory
cd frontend

# Install dependencies
Write-Host "Installing dependencies..."
npm install

# Build the React app
Write-Host "Building React application..."
npm run build

# Ensure build directory exists
if (!(Test-Path -Path "build")) {
    Write-Host "ERROR: Build directory not found. Build process may have failed."
    exit 1
}

# Create a copy of the build in the backend directory as a fallback
$backendDir = Join-Path -Path ".." -ChildPath "backend" -Resolve
$frontendBuildDir = Join-Path -Path $backendDir -ChildPath "frontend_build"

# Remove old build if exists
if (Test-Path -Path $frontendBuildDir) {
    Write-Host "Removing old frontend build from backend directory..."
    Remove-Item -Path $frontendBuildDir -Recurse -Force
}

# Create directory and copy build files
Write-Host "Copying frontend build to backend directory for easy access..."
New-Item -ItemType Directory -Force -Path $frontendBuildDir | Out-Null
Copy-Item -Path "build\*" -Destination $frontendBuildDir -Recurse -Force

Write-Host "Frontend build complete!"
Write-Host "The backend will now serve the frontend from the build directory."
Write-Host "Start the backend using 'uvicorn backend.main:app --reload'" 