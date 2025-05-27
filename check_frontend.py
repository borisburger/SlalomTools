#!/usr/bin/env python3
import os
import sys
import json
from pathlib import Path

def check_frontend_build():
    """Check if the frontend build files exist and are accessible."""
    # Get script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Possible frontend build locations
    possible_locations = [
        os.path.join(script_dir, "frontend", "build"),
        os.path.join(script_dir, "backend", "frontend_build"),
        os.path.join(os.path.dirname(script_dir), "frontend", "build")
    ]
    
    results = {
        "frontend_found": False,
        "locations_checked": [],
        "errors": []
    }
    
    for location in possible_locations:
        location_info = {
            "path": location,
            "exists": os.path.exists(location),
            "is_directory": os.path.isdir(location) if os.path.exists(location) else False,
            "has_index": os.path.exists(os.path.join(location, "index.html")) if os.path.exists(location) else False,
            "has_static": os.path.exists(os.path.join(location, "static")) if os.path.exists(location) else False,
            "files": []
        }
        
        if location_info["exists"] and location_info["is_directory"]:
            # List top-level files
            try:
                location_info["files"] = os.listdir(location)[:10]  # Just first 10 files
                if location_info["has_index"] and location_info["has_static"]:
                    results["frontend_found"] = True
            except Exception as e:
                location_info["error"] = str(e)
                results["errors"].append(f"Error accessing {location}: {str(e)}")
        
        results["locations_checked"].append(location_info)
    
    # Provide recommendations
    if not results["frontend_found"]:
        results["recommendations"] = [
            "Run the build_frontend.sh (Linux/Mac) or build_frontend.ps1 (Windows) script",
            "Check that you have Node.js and npm installed",
            "Make sure the React build process is completing successfully",
            "Check folder permissions"
        ]
    
    return results

if __name__ == "__main__":
    results = check_frontend_build()
    print(json.dumps(results, indent=2))
    
    # Print a simple summary
    print("\n=== Frontend Build Check Summary ===")
    if results["frontend_found"]:
        print("✅ Frontend build files found!")
        for location in results["locations_checked"]:
            if location["has_index"] and location["has_static"]:
                print(f"   Location: {location['path']}")
    else:
        print("❌ Frontend build files NOT found!")
        print("\nRecommendations:")
        for i, rec in enumerate(results.get("recommendations", []), 1):
            print(f"{i}. {rec}")
        
        print("\nDetails of checked locations:")
        for location in results["locations_checked"]:
            status = "✅" if location["has_index"] and location["has_static"] else "❌"
            print(f"{status} {location['path']}")
            if location["exists"]:
                if not location["has_index"]:
                    print("   - Missing index.html")
                if not location["has_static"]:
                    print("   - Missing static directory")
                if len(location["files"]) > 0:
                    print(f"   - Contains: {', '.join(location['files'][:5])}" + 
                          (f" and {len(location['files'])-5} more..." if len(location["files"]) > 5 else ""))
            else:
                print("   - Directory doesn't exist")
    
    sys.exit(0 if results["frontend_found"] else 1) 