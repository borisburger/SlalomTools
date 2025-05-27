#!/bin/bash

echo "Building the frontend application..."

# Navigate to the frontend directory
cd frontend

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the React app
echo "Building React application..."
npm run build

# Ensure build directory exists
if [ ! -d "build" ]; then
    echo "ERROR: Build directory not found. Build process may have failed."
    exit 1
fi

# Create a copy of the build in the backend directory as a fallback
BACKEND_DIR="../backend"
FRONTEND_BUILD_DIR="$BACKEND_DIR/frontend_build"

# Remove old build if exists
if [ -d "$FRONTEND_BUILD_DIR" ]; then
    echo "Removing old frontend build from backend directory..."
    rm -rf "$FRONTEND_BUILD_DIR"
fi

# Create directory and copy build files
echo "Copying frontend build to backend directory for easy access..."
mkdir -p "$FRONTEND_BUILD_DIR"
cp -R build/* "$FRONTEND_BUILD_DIR/"

echo "Frontend build complete!"
echo "The backend will now serve the frontend from the build directory."
echo "Start the backend using 'uvicorn backend.main:app --reload'" 