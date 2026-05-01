#!/usr/bin/env python3
"""
Test script for transliteration functionality.
This script tests the transliterate_text function to ensure it properly
removes accents and special characters from skater names.
"""

import sys
import os

# Add the current directory to the path so we can import result_sheets
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from result_sheets import transliterate_text

def test_transliteration():
    """Test the transliteration function with various accented and special characters."""
    
    print("Testing transliteration functionality...")
    print("=" * 50)
    
    # Test cases with common accented names found in skating competitions
    test_cases = [
        # Basic accented characters
        ("José", "Jose"),
        ("François", "Francois"),
        ("Müller", "Muller"),
        ("Björk", "Bjork"),
        ("Åsa", "Asa"),
        
        # Slavic/Eastern European names
        ("Lukáš", "Lukas"),
        ("Václav", "Vaclav"),
        ("Žofie", "Zofie"),
        ("Šárka", "Sarka"),
        ("Čeněk", "Cenek"),
        ("Ružica", "Ruzica"),
        ("Łukasz", "Lukasz"),
        ("Władysław", "Wladyslaw"),
        
        # Names from the provided data
        ("Kruhliak Oleksandra", "Kruhliak Oleksandra"),  # Should remain unchanged
        ("Lisiecka Aleksandra", "Lisiecka Aleksandra"),  # Should remain unchanged
        
        # Mixed cases with accents
        ("María José", "Maria Jose"),
        ("Jean-François", "Jean-Francois"),
        ("Müller-Schmidt", "Muller-Schmidt"),
        
        # Special characters
        ("Björn Åström", "Bjorn Astrom"),
        ("Søren Østergård", "Soren Ostergard"),
        ("Ñoño", "Nono"),
        
        # German special characters
        ("Weiß", "Weiss"),
        ("Größe", "Grosse"),
        
        # Empty and None cases
        ("", ""),
        (None, ""),
        
        # Numbers and symbols (should be preserved)
        ("Test123", "Test123"),
        ("Name-Surname", "Name-Surname"),
        ("O'Connor", "O'Connor"),
    ]
    
    success_count = 0
    total_tests = len(test_cases)
    
    for i, (input_text, expected_output) in enumerate(test_cases, 1):
        try:
            result = transliterate_text(input_text)
            
            if result == expected_output:
                print(f"✅ Test {i:2d}: '{input_text}' → '{result}' (Expected: '{expected_output}')")
                success_count += 1
            else:
                print(f"❌ Test {i:2d}: '{input_text}' → '{result}' (Expected: '{expected_output}')")
                
        except Exception as e:
            print(f"❌ Test {i:2d}: '{input_text}' → ERROR: {str(e)}")
    
    print("\n" + "=" * 50)
    print(f"Test Results: {success_count}/{total_tests} tests passed")
    
    if success_count == total_tests:
        print("✅ All transliteration tests passed!")
        return True
    else:
        print("❌ Some transliteration tests failed!")
        return False

def test_real_world_names():
    """Test with real-world names that might appear in skating competitions."""
    
    print("\nTesting with real-world skating names...")
    print("=" * 40)
    
    # Names from various countries commonly seen in skating competitions
    real_names = [
        "François Dubois",      # French
        "María González",       # Spanish
        "Björn Andersson",      # Swedish
        "Müller Hans",          # German
        "Václav Novák",         # Czech
        "Łukasz Kowalski",      # Polish
        "Søren Nielsen",        # Danish
        "José da Silva",        # Portuguese
        "Ñoño Martínez",        # Spanish with ñ
        "Žiga Horvat",          # Slovenian
        "Čeněk Svoboda",        # Czech
        "Ružica Petrović",      # Serbian
        "Åse Larsen",           # Norwegian
        "Ömer Yılmaz",          # Turkish
    ]
    
    print("Real-world name transliterations:")
    for name in real_names:
        transliterated = transliterate_text(name)
        print(f"  '{name}' → '{transliterated}'")
    
    return True

if __name__ == "__main__":
    print("Transliteration Test Suite")
    print("=" * 50)
    
    # Test basic transliteration
    test1_success = test_transliteration()
    
    # Test real-world names
    test2_success = test_real_world_names()
    
    print("\n" + "=" * 50)
    print("Overall Test Results:")
    
    if test1_success and test2_success:
        print("✅ All tests passed! Transliteration is working correctly.")
        sys.exit(0)
    else:
        print("❌ Some tests failed!")
        sys.exit(1) 