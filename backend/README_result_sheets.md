# Result Sheets Processing with OneDrive Support

This document describes the enhanced `result_sheets.py` script that now supports processing Excel files directly from OneDrive folders, eliminating the need for manual CSV exports.

## Overview

The `result_sheets.py` script has been updated to support two modes of operation:

1. **OneDrive Folder Processing** (NEW): Automatically download and process Excel files from a OneDrive folder
2. **Local CSV Processing** (Original): Process locally stored CSV files

## Features

### OneDrive Integration
- **Automatic File Discovery**: Lists all Excel files in a OneDrive folder
- **Direct Excel Processing**: Reads the "Final Ranking" sheet from Excel files without requiring CSV export
- **Authentication**: Uses Microsoft Graph API with cached authentication tokens
- **Batch Processing**: Processes multiple Excel files in a single run

### Excel File Processing
- **Case-Insensitive Sheet Detection**: Automatically finds sheets named "Final Ranking", "Final ranking", "final ranking", "FINAL RANKING", "Final Results", etc.
- **Flexible Sheet Names**: Supports variations like "Final Results" in addition to "Final Ranking"
- **Fallback Logic**: If no matching sheet is found but only one sheet exists, uses that sheet
- **Discipline Detection**: Extracts discipline (Classic, Battle, Freejump) from file content or filename
- **Category Detection**: Extracts category information from the Excel sheet
- **Flexible Column Mapping**: Handles variations in column names and positions

### Name Transliteration (NEW)
- **Accent Removal**: Automatically removes accents and special characters from skater names
- **Unicode Normalization**: Uses Unicode NFD normalization to handle most accented Latin characters
- **Special Character Handling**: Handles characters that don't decompose properly (ß → ss, æ → ae, etc.)
- **Slavic/Eastern European Support**: Supports characters like č, š, ž, ň, ř, ł, etc.
- **Consistent Output**: Ensures CSV files contain only ASCII characters for better compatibility
- **Case-Insensitive Lookup**: Registration data lookup is case-insensitive, allowing Excel files with names in different cases (e.g., "WOJSŁAW BRUNO") to match registration data with proper case (e.g., "Wojsław Bruno")
- **Lookup Before Transliteration**: Name lookup happens before transliteration to preserve original accented characters for matching

#### Supported Character Transliterations
The system handles a wide range of accented and special characters:

**Basic Accented Characters:**
- á, à, â, ä, å → a
- é, è, ê, ë → e  
- í, ì, î, ï → i
- ó, ò, ô, ö, ø → o
- ú, ù, û, ü → u
- ý, ÿ → y

**Slavic/Eastern European:**
- č, ć, ċ → c
- š, ś, ŝ → s
- ž, ź, ż → z
- ň, ń, ñ → n
- ř, ŕ, ŗ → r
- ł, ŀ → l
- ď, đ, ð → d
- ť, ț, ŧ → t

**Special Characters:**
- ß → ss
- æ → ae
- œ → oe
- þ → th

**Examples:**
- "José María" → "Jose Maria"
- "François Müller" → "Francois Muller"
- "Łukasz Václav" → "Lukasz Vaclav"
- "Søren Østergård" → "Soren Ostergard"

## Prerequisites

### Required Python Packages
```bash
pip install pandas openpyxl msal requests
```

### Authentication Setup
1. Ensure `secrets.json` contains your Microsoft Graph application credentials:
```json
{
    "microsoft": {
        "client_id": "your-client-id-here"
    }
}
```

2. Authenticate with Microsoft Graph by running the main application first:
```bash
python main.py
```
Follow the device code authentication flow to grant permissions.

## Usage

### OneDrive Folder Processing

```bash
python result_sheets.py "https://1drv.ms/f/c/030ab5aec14c86ea/Ep-8le6L7dhFptBDLOxy5VwBB7jBgWoqjdGte49f1_6fWw?e=uGPKA7"
```

With custom output file:
```bash
python result_sheets.py "https://1drv.ms/f/c/030ab5aec14c86ea/Ep-8le6L7dhFptBDLOxy5VwBB7jBgWoqjdGte49f1_6fWw?e=uGPKA7" --output competition_results.csv
```

### Local CSV Processing (Original Functionality)

Single CSV file:
```bash
python result_sheets.py path/to/results.csv
```

Directory of CSV files:
```bash
python result_sheets.py path/to/csv/directory/
```

## OneDrive Folder Structure

The script expects the OneDrive folder to contain Excel files (.xlsx) with the following characteristics:

### File Naming
Files should be named to indicate the discipline and category, for example:
- `BattleJuniorWomen.xlsx`
- `ClassicSeniorMen.xlsx`
- `FreejumpJuniorMixed.xlsx`

### Excel Sheet Structure
Each Excel file should contain a results sheet with one of these names (case-insensitive):
- **"Final Ranking"** (most common)
- **"Final ranking"** (sentence case)
- **"final ranking"** (lowercase)
- **"FINAL RANKING"** (uppercase)
- **"Final Results"** (alternative name)
- **"Final results"** (alternative, sentence case)
- **"final results"** (alternative, lowercase)
- **"FINAL RESULTS"** (alternative, uppercase)

The sheet should contain:
- **Discipline information**: Found in the first few rows (e.g., "Freestyle Slalom Battle")
- **Category information**: Found near the discipline information (e.g., "Junior Women - Final Ranking")
- **Results table** with columns:
  - Rank/Ranking/Place
  - World Skate ID (optional - can be looked up from registration data)
  - Name
  - Country/Ctry/Nationality

### Example Sheet Structure
```
Row 1: [empty] [empty] [empty] [empty]
Row 2: [empty] Freestyle Slalom Battle [empty] [empty]
Row 3: [empty] Junior Women - Final Ranking [empty] [empty]
Row 4: [empty] [empty] [empty] [empty]
Row 5: Ranking World Skate Id BIB Name Team Ctry
Row 6: 1 22009UKR2124851565 [empty] Kruhliak Oleksandra Rola-Kolo UKR
Row 7: 2 22009POL8802040428 [empty] Lisiecka Aleksandra Slalom Academy POL
...
```

### Sheet Detection Logic
The script uses the following logic to find the correct sheet:

1. **Exact Match**: First tries to find sheets with exact names from the supported list
2. **Case-Insensitive Search**: If no exact match, searches for sheets containing "final" and ("ranking" or "results")
3. **Single Sheet Fallback**: If no match found but only one sheet exists, uses that sheet
4. **Multiple Sheets**: If multiple sheets exist and none match the pattern, reports an error

## Output Format

The script generates a combined CSV file with the following structure:

```csv
DISCIPLINE,Classic
CATEGORY,Junior Men
RANK,WORLD SKATE SKATER ID,FIRST NAME,FAMILY NAME,GENDER,BIRTHDATE DD/MM/YYYY,NATIONALITY
1,12345678901234567,John,Doe,man,15/03/2005,USA
2,12345678901234568,Jane,Smith,woman,22/07/2004,CAN

DISCIPLINE,Battle
CATEGORY,Junior Women
RANK,WORLD SKATE SKATER ID,FIRST NAME,FAMILY NAME,GENDER,BIRTHDATE DD/MM/YYYY,NATIONALITY
1,22009UKR2124851565,Oleksandra,Kruhliak,woman,12/05/2006,UKR
2,22009POL8802040428,Aleksandra,Lisiecka,woman,28/02/2005,POL
```

## Error Handling

The script includes comprehensive error handling for:
- **Authentication failures**: Clear messages about authentication requirements
- **Missing sheets**: Warnings when no matching sheet is found, with list of available sheets
- **Invalid file formats**: Graceful handling of non-Excel files
- **Network issues**: Retry logic for OneDrive downloads
- **Missing registration data**: Fallback mechanisms for skater information

## Testing

### Test OneDrive Functionality
```bash
python test_onedrive_results.py
```

### Test Sheet Detection
```bash
python test_sheet_detection.py
```

### Run Examples
```bash
python example_usage.py
```

## Troubleshooting

### Authentication Issues
- **Error**: "Not authenticated. Please run the main application and authenticate first."
- **Solution**: Run `python main.py` and complete the Microsoft Graph authentication flow.

### Missing Sheets
- **Error**: "Warning: No 'Final Ranking' sheet found"
- **Solution**: Ensure Excel files contain a sheet with one of the supported names (case-insensitive):
  - "Final Ranking", "Final ranking", "final ranking", "FINAL RANKING"
  - "Final Results", "Final results", "final results", "FINAL RESULTS"

### No Results Found
- **Error**: "No results found in filename.xlsx"
- **Solution**: Check that the Excel sheet has the expected structure with ranking data

### Registration Data Issues
- **Error**: "Skater [Name] not found in registration list"
- **Solution**: Ensure `registration_responses.csv` is available and contains the skater data

## Integration with Main Application

The OneDrive functionality integrates seamlessly with the existing SlalomTools application:
- Uses the same authentication system as `main.py`
- Shares the same registration data processing
- Compatible with existing workflow and data formats

## Performance Considerations

- **File Size**: Large Excel files may take longer to download and process
- **Network Speed**: OneDrive download speed depends on internet connection
- **Batch Processing**: Processing multiple files sequentially may take time
- **Memory Usage**: Large Excel files are loaded into memory during processing

## Recent Improvements

### Case-Insensitive Sheet Detection (Latest)
- **Problem Solved**: Handles Excel files with different sheet name capitalizations
- **Supported Variations**: "Final Ranking", "Final ranking", "final ranking", "FINAL RANKING", etc.
- **Fallback Logic**: Uses single available sheet if no pattern match found
- **Better Error Messages**: Shows which sheet was found and used for processing

## Future Enhancements

Potential improvements for future versions:
- Parallel processing of multiple Excel files
- Progress indicators for long-running operations
- Support for additional sheet names and formats
- Integration with real-time competition management
- Automatic detection of new files in OneDrive folders 