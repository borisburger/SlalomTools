# OneDrive Integration Implementation Summary

## What Has Been Implemented

The `result_sheets.py` script has been completely rewritten to support direct processing of Excel files from OneDrive folders, eliminating the need for manual CSV exports.

## Key Features Added

### 1. OneDrive Folder Processing
- **Automatic folder listing**: Lists all files in a OneDrive folder using Microsoft Graph API
- **Excel file filtering**: Automatically identifies and processes only Excel files (.xlsx, .xls)
- **Batch processing**: Processes multiple Excel files in a single operation

### 2. Direct Excel File Processing
- **Case-insensitive sheet detection**: Automatically finds sheets with various capitalizations of "Final Ranking" or "Final Results"
- **Flexible sheet names**: Supports "Final Ranking", "Final ranking", "final ranking", "FINAL RANKING", "Final Results", etc.
- **Fallback logic**: Uses single available sheet if no pattern match found
- **Content parsing**: Extracts discipline and category information from Excel content
- **Flexible column mapping**: Handles variations in column names and positions
- **Data extraction**: Reads competitor rankings, names, countries, and World Skate IDs

### 3. Microsoft Graph API Integration
- **Authentication**: Reuses the existing authentication system from `main.py`
- **Token management**: Handles token caching and refresh automatically
- **File download**: Downloads Excel files directly from OneDrive
- **Error handling**: Comprehensive error handling for network and authentication issues

### 4. Backward Compatibility
- **CSV support maintained**: Original CSV processing functionality is preserved
- **Same output format**: Generates the same CSV output format as before
- **Registration integration**: Continues to use the existing registration data system

### 5. Name Transliteration (NEW)
- **Accent removal**: Automatically removes accents and special characters from skater names
- **Unicode normalization**: Uses Unicode NFD normalization for most accented Latin characters
- **Special character handling**: Handles characters that don't decompose properly (ß → ss, æ → ae, etc.)
- **Slavic/Eastern European support**: Supports characters like č, š, ž, ň, ř, ł, etc.
- **Consistent output**: Ensures CSV files contain only ASCII characters for better compatibility
- **Frontend compatibility**: Uses the same transliteration logic as the frontend normalizeText function

## Files Created/Modified

### Modified Files
1. **`backend/result_sheets.py`** - Complete rewrite with OneDrive support
   - Added OneDrive authentication functions
   - Added folder listing and file download functions
   - Added Excel file processing functions with case-insensitive sheet detection
   - Maintained original CSV processing functions
   - Enhanced command-line interface

### New Files Created
1. **`backend/test_onedrive_results.py`** - Test script for OneDrive functionality
2. **`backend/test_sheet_detection.py`** - Test script for case-insensitive sheet detection
3. **`backend/test_transliteration.py`** - Test script for name transliteration functionality
4. **`backend/test_result_transliteration.py`** - Test script for transliteration in result processing
5. **`backend/example_usage.py`** - Example usage demonstrations
6. **`backend/README_result_sheets.md`** - Comprehensive documentation
7. **`backend/ONEDRIVE_INTEGRATION_SUMMARY.md`** - This summary document

## Technical Implementation Details

### OneDrive API Integration
```python
# Key functions added:
- resolve_drive_item_ids(share_url) -> Tuple[str, str]
- list_onedrive_folder_contents(share_url) -> List[Dict[str, Any]]
- download_excel_file(drive_id, item_id) -> bytes
- process_excel_final_ranking(file_bytes, filename) -> Tuple[str, str, List[List[str]]]
- transliterate_text(text) -> str  # NEW: Name transliteration
```

### Excel Processing Logic
- Loads Excel files using `openpyxl` library
- **Case-insensitive sheet detection** with multiple fallback strategies:
  1. Exact match with common variations
  2. Case-insensitive search for "final" + ("ranking" or "results")
  3. Single sheet fallback if only one sheet exists
- Extracts discipline from content or filename
- Finds header row with ranking data
- Processes competitor data row by row
- Handles missing World Skate IDs by looking up in registration data

### Sheet Detection Algorithm
```python
# Supported sheet name variations:
possible_sheet_names = [
    "Final Ranking", "Final ranking", "final ranking", "FINAL RANKING",
    "Final Results", "Final results", "final results", "FINAL RESULTS"
]

# Detection logic:
1. Try exact matches with predefined variations
2. If no match, search case-insensitively for "final" + ("ranking" or "results")
3. If still no match and only one sheet exists, use that sheet
4. If multiple sheets exist with no match, report error with available sheet names
```

### Name Transliteration Implementation
```python
# Transliteration process:
1. Unicode NFD normalization to decompose accented characters
2. Remove combining characters (accents) using regex
3. Apply custom transliteration table for special characters
4. Handle both lowercase and uppercase variants
5. Preserve numbers, hyphens, apostrophes, and spaces

# Applied to:
- first_name = transliterate_text(first_name)
- family_name = transliterate_text(family_name)
```

### Authentication Flow
1. Attempts to use cached token from memory
2. Falls back to cached token from file
3. Requires user to authenticate via main application if no valid token

## Usage Examples

### OneDrive Folder Processing
```bash
python result_sheets.py "https://1drv.ms/f/c/030ab5aec14c86ea/Ep-8le6L7dhFptBDLOxy5VwBB7jBgWoqjdGte49f1_6fWw?e=uGPKA7"
```

### Local CSV Processing (Original)
```bash
python result_sheets.py path/to/csv/files/
```

### Custom Output File
```bash
python result_sheets.py "https://1drv.ms/..." --output competition_results.csv
```

## Expected Excel File Structure

The script expects Excel files with:
- A results sheet with one of the supported names (case-insensitive)
- Discipline information in the first few rows
- Category information near the discipline
- A data table with columns for Rank, Name, Country, and optionally World Skate ID

Example structure from the provided `BattleJuniorWomen.csv`:
```
Row 2: Freestyle Slalom Battle
Row 3: Junior Women - Final Ranking
Row 6: Ranking, World Skate Id, BIB, Name, Team, Ctry
Row 7: 1, 22009UKR2124851565, , Kruhliak Oleksandra, Rola-Kolo, UKR
```

## Error Handling

The implementation includes robust error handling for:
- Authentication failures with clear guidance
- Missing or invalid Excel sheets with detailed sheet name information
- Network connectivity issues
- File format problems
- Missing registration data

## Integration with Existing System

The OneDrive functionality integrates seamlessly with the existing SlalomTools application:
- Uses the same Microsoft Graph authentication as `main.py`
- Shares the same registration data processing logic
- Maintains the same output format for compatibility
- Preserves all existing CSV processing capabilities

## Testing and Validation

### Test Scripts Provided
1. **`test_onedrive_results.py`** - Tests OneDrive folder listing and processing
2. **`test_sheet_detection.py`** - Tests case-insensitive sheet detection with various name formats
3. **`test_transliteration.py`** - Tests name transliteration functionality
4. **`test_result_transliteration.py`** - Tests transliteration in result processing
5. **`example_usage.py`** - Demonstrates both OneDrive and CSV processing

### Manual Testing Steps
1. Authenticate with Microsoft Graph via main application
2. Run test script to verify OneDrive access
3. Run sheet detection test to verify case-insensitive functionality
4. Process the provided OneDrive folder URL
5. Verify output CSV contains expected data

## Benefits Achieved

1. **Eliminates Manual Steps**: No need to manually export CSV files from Excel
2. **Handles Sheet Name Variations**: Works with different capitalizations of sheet names
3. **Batch Processing**: Process multiple competition categories in one operation
4. **Real-time Access**: Always processes the latest version of files from OneDrive
5. **Error Reduction**: Reduces human error from manual export process
6. **Time Savings**: Significantly faster than manual CSV export workflow
7. **Robust Sheet Detection**: Handles inconsistent sheet naming conventions
8. **Name Standardization**: Automatically removes accents and special characters for consistent output
9. **International Support**: Handles names from various countries and languages correctly

## Recent Improvements

### Case-Insensitive Sheet Detection (Latest Update)
- **Problem Solved**: Excel files with "Final Ranking" vs "Final ranking" vs other variations
- **Implementation**: Multi-level detection algorithm with fallback strategies
- **Testing**: Comprehensive test suite covering all supported variations
- **Error Messages**: Enhanced error reporting showing which sheet was found and used

## Future Enhancements

Potential improvements that could be added:
- Parallel processing of multiple Excel files
- Progress indicators for long operations
- Support for additional Excel sheet formats
- Automatic detection of new files in OneDrive folders
- Integration with real-time competition updates

## Dependencies Added

The implementation requires these additional Python packages:
- `pandas` - For Excel file processing
- `openpyxl` - For reading Excel files
- `msal` - For Microsoft Graph authentication
- `requests` - For HTTP requests to Graph API

These are already included in the existing project dependencies. 