#!/usr/bin/env python3
"""
Test script for OneDrive folder processing functionality.
This script tests the new OneDrive integration in result_sheets.py
"""

import sys
import os

# Add the current directory to the path so we can import result_sheets
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from result_sheets import process_onedrive_folder, list_onedrive_folder_contents

def test_onedrive_folder():
    """Test the OneDrive folder processing functionality."""
    
    # The OneDrive folder URL from the user
    test_url = "https://1drv.ms/f/c/030ab5aec14c86ea/Ep-8le6L7dhFptBDLOxy5VwBB7jBgWoqjdGte49f1_6fWw?e=uGPKA7"
    
    print("Testing OneDrive folder processing...")
    print(f"URL: {test_url}")
    print("-" * 50)
    
    try:
        # First, just list the folder contents
        print("1. Listing folder contents...")
        files = list_onedrive_folder_contents(test_url)
        
        print(f"Found {len(files)} files:")
        for file_info in files:
            print(f"  - {file_info['name']} ({file_info['size']} bytes)")
        
        # Filter for Excel files
        excel_files = [f for f in files if f["name"].lower().endswith(('.xlsx', '.xls'))]
        print(f"\nFound {len(excel_files)} Excel files:")
        for file_info in excel_files:
            print(f"  - {file_info['name']}")
        
        print("\n" + "-" * 50)
        
        # Now process the folder
        print("2. Processing Excel files...")
        results = process_onedrive_folder(test_url)
        
        print(f"\nProcessed {len(results)} files successfully:")
        for discipline, category, rows in results:
            print(f"  - {discipline} - {category}: {len(rows)} competitors")
        
        return True
        
    except Exception as e:
        print(f"Error: {str(e)}")
        print("\nMake sure you are authenticated with Microsoft Graph.")
        print("Run the main application first and complete the authentication process.")
        return False

if __name__ == "__main__":
    success = test_onedrive_folder()
    if success:
        print("\n✅ OneDrive folder processing test completed successfully!")
    else:
        print("\n❌ OneDrive folder processing test failed!")
        sys.exit(1) 