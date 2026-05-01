#!/usr/bin/env python3
"""
Example usage of the updated result_sheets.py script with OneDrive support.

This script demonstrates how to use the new OneDrive folder processing functionality
to automatically download and process Excel files from a OneDrive folder.
"""

import subprocess
import sys
import os

def run_result_sheets_with_onedrive():
    """Example of running result_sheets.py with a OneDrive folder URL."""
    
    # The OneDrive folder URL from the user
    onedrive_url = "https://1drv.ms/f/c/030ab5aec14c86ea/Ep-8le6L7dhFptBDLOxy5VwBB7jBgWoqjdGte49f1_6fWw?e=uGPKA7"
    
    print("Example: Processing OneDrive folder with result_sheets.py")
    print("=" * 60)
    print(f"OneDrive URL: {onedrive_url}")
    print()
    
    # Command to run result_sheets.py with the OneDrive URL
    cmd = [
        sys.executable,  # Use the same Python interpreter
        "result_sheets.py",
        onedrive_url,
        "--output", "onedrive_results.csv"
    ]
    
    print("Running command:")
    print(" ".join(cmd))
    print()
    
    try:
        # Run the command
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=os.path.dirname(__file__))
        
        print("STDOUT:")
        print(result.stdout)
        
        if result.stderr:
            print("STDERR:")
            print(result.stderr)
        
        if result.returncode == 0:
            print("✅ Command completed successfully!")
            
            # Check if output file was created
            output_file = os.path.join(os.path.dirname(__file__), "onedrive_results.csv")
            if os.path.exists(output_file):
                print(f"✅ Output file created: {output_file}")
                
                # Show file size
                file_size = os.path.getsize(output_file)
                print(f"   File size: {file_size} bytes")
                
                # Show first few lines
                print("\nFirst few lines of the output file:")
                with open(output_file, 'r', encoding='utf-8') as f:
                    for i, line in enumerate(f):
                        if i >= 10:  # Show first 10 lines
                            break
                        print(f"   {line.rstrip()}")
            else:
                print("❌ Output file was not created")
        else:
            print(f"❌ Command failed with return code: {result.returncode}")
            
    except Exception as e:
        print(f"❌ Error running command: {str(e)}")

def run_result_sheets_with_csv():
    """Example of running result_sheets.py with local CSV files (original functionality)."""
    
    print("\nExample: Processing local CSV files with result_sheets.py")
    print("=" * 60)
    
    # Check if there are any CSV files in the current directory
    csv_files = [f for f in os.listdir(os.path.dirname(__file__)) if f.endswith('.csv')]
    
    if not csv_files:
        print("No CSV files found in the current directory.")
        print("Skipping CSV example.")
        return
    
    print(f"Found CSV files: {csv_files}")
    
    # Use the first CSV file as an example
    csv_file = csv_files[0]
    
    cmd = [
        sys.executable,
        "result_sheets.py", 
        csv_file,
        "--output", "csv_results.csv"
    ]
    
    print("Running command:")
    print(" ".join(cmd))
    print()
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=os.path.dirname(__file__))
        
        print("STDOUT:")
        print(result.stdout)
        
        if result.stderr:
            print("STDERR:")
            print(result.stderr)
        
        if result.returncode == 0:
            print("✅ CSV processing completed successfully!")
        else:
            print(f"❌ CSV processing failed with return code: {result.returncode}")
            
    except Exception as e:
        print(f"❌ Error running CSV command: {str(e)}")

if __name__ == "__main__":
    print("Result Sheets Processing Examples")
    print("=" * 60)
    print()
    print("This script demonstrates the new OneDrive folder processing capability")
    print("added to result_sheets.py, as well as the original CSV functionality.")
    print()
    
    # Run OneDrive example
    run_result_sheets_with_onedrive()
    
    # Run CSV example
    run_result_sheets_with_csv()
    
    print("\n" + "=" * 60)
    print("Examples completed!")
    print()
    print("Usage Summary:")
    print("1. OneDrive folder: python result_sheets.py <1drv.ms_url>")
    print("2. Local CSV files: python result_sheets.py <csv_file_or_directory>")
    print("3. Custom output:   python result_sheets.py <source> --output <filename.csv>") 