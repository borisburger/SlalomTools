#!/usr/bin/env python3
"""
Test script to verify that transliteration is applied correctly in result processing.
This script creates a sample Excel file with accented names and tests the processing.
"""

import sys
import os
from openpyxl import Workbook
from io import BytesIO

# Add the current directory to the path so we can import result_sheets
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def create_test_excel_with_accented_names() -> bytes:
    """Create a test Excel file with accented skater names."""
    wb = Workbook()
    
    # Remove the default sheet and create our test sheet
    wb.remove(wb.active)
    sheet = wb.create_sheet(title="Final Ranking")
    
    # Add header information
    sheet['A1'] = ""
    sheet['B1'] = "Freestyle Slalom Battle"
    sheet['B2'] = "Junior Women - Final Ranking"
    sheet['A5'] = "Ranking"
    sheet['B5'] = "World Skate Id"
    sheet['C5'] = "BIB"
    sheet['D5'] = "Name"
    sheet['E5'] = "Team"
    sheet['F5'] = "Ctry"
    
    # Add competitor data with accented names
    test_skaters = [
        (1, "12345678901234567", "José María", "Test Team", "ESP"),
        (2, "22345678901234567", "François Müller", "Test Team", "FRA"),
        (3, "12345678901234568", "Łukasz Václav", "Test Team", "POL"),
        (4, "22345678901234568", "Åsa Björk", "Test Team", "SWE"),
        (5, "12345678901234569", "Søren Østergård", "Test Team", "DEN"),
    ]
    
    for i, (rank, ws_id, name, team, country) in enumerate(test_skaters, 6):
        sheet[f'A{i}'] = rank
        sheet[f'B{i}'] = ws_id
        sheet[f'D{i}'] = name
        sheet[f'E{i}'] = team
        sheet[f'F{i}'] = country
    
    # Save to bytes
    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()

def test_result_processing_with_transliteration():
    """Test that result processing applies transliteration correctly."""
    
    print("Testing result processing with transliteration...")
    print("=" * 50)
    
    try:
        # Import here to avoid issues if registration data is missing
        from result_sheets import process_excel_final_ranking
        
        # Create test Excel file with accented names
        file_bytes = create_test_excel_with_accented_names()
        
        # Process the Excel file
        discipline, category, rows = process_excel_final_ranking(file_bytes, "test_accented_names.xlsx")
        
        print(f"Discipline: {discipline}")
        print(f"Category: {category}")
        print(f"Number of competitors: {len(rows)}")
        print()
        
        # Expected transliterations
        expected_names = [
            ("Jose", "Maria"),      # José María
            ("Francois", "Muller"), # François Müller  
            ("Lukasz", "Vaclav"),   # Łukasz Václav
            ("Asa", "Bjork"),       # Åsa Björk
            ("Soren", "Ostergard"), # Søren Østergård
        ]
        
        success_count = 0
        
        print("Checking transliteration results:")
        for i, (rank, skater_id, first_name, family_name, gender, birthdate, ctry) in enumerate(rows):
            if i < len(expected_names):
                expected_first, expected_family = expected_names[i]
                
                if first_name == expected_first and family_name == expected_family:
                    print(f"✅ Rank {rank}: '{first_name} {family_name}' (correctly transliterated)")
                    success_count += 1
                else:
                    print(f"❌ Rank {rank}: '{first_name} {family_name}' (expected: '{expected_first} {expected_family}')")
            else:
                print(f"⚠️  Rank {rank}: '{first_name} {family_name}' (no expected result)")
        
        print(f"\nTransliteration Results: {success_count}/{min(len(rows), len(expected_names))} names correctly transliterated")
        
        return success_count == min(len(rows), len(expected_names))
        
    except ImportError as e:
        print(f"❌ Import error: {str(e)}")
        print("This test requires the registration_data module to be available.")
        return False
    except Exception as e:
        print(f"❌ Error during processing: {str(e)}")
        return False

if __name__ == "__main__":
    print("Result Processing Transliteration Test")
    print("=" * 50)
    
    # Test result processing with transliteration
    success = test_result_processing_with_transliteration()
    
    print("\n" + "=" * 50)
    print("Overall Test Results:")
    
    if success:
        print("✅ Transliteration is working correctly in result processing!")
        sys.exit(0)
    else:
        print("❌ Transliteration test failed!")
        sys.exit(1) 