import csv
import unicodedata
from typing import Dict, List, Optional, Tuple
from datetime import datetime

class RegistrationData:
    def __init__(self, filepath: str) -> None:
        self.skaters_by_id: Dict[str, Dict] = {}
        self.skaters_by_name: Dict[Tuple[str, str], Dict] = {}  # (surname, first_name) -> data
        self.skaters_by_name_ascii: Dict[Tuple[str, str], Dict] = {}  # accent-stripped fallback
        self.validation_errors: List[str] = []
        self._load_data(filepath)

    @staticmethod
    def _to_ascii(text: str) -> str:
        """Lowercase, strip accents/diacritics, collapse whitespace."""
        nfkd = unicodedata.normalize('NFKD', text.strip().lower())
        return ''.join(c for c in nfkd if not unicodedata.combining(c))

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse date string in various formats to datetime object."""
        if not date_str:
            return None

        # Google Sheets CSV export uses M/D/YYYY (US locale), so try that
        # first.  DD/MM/YYYY and dot-separated D.M.YYYY are kept as
        # fallbacks for manually-entered data.
        formats = ['%m/%d/%Y', '%d/%m/%Y', '%d.%m.%Y']

        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        self.validation_errors.append(f"Could not parse date: {date_str}")
        return None

    def _validate_birth_year(self, skater_id: str, date_of_birth: Optional[datetime], 
                           surname: str, first_name: str) -> None:
        """Validate that the birth year in the ID matches the date of birth.
        
        Args:
            skater_id: The skater's ID
            date_of_birth: The skater's date of birth as datetime object
            surname: The skater's surname
            first_name: The skater's first name
        """
        if not date_of_birth or skater_id.upper() == 'NONE':
            return

        # Extract year from ID (digits 2-5)
        try:
            id_year = int(skater_id[1:5])
            dob_year = date_of_birth.year
            
            if id_year != dob_year:
                error_msg = (f"Birth year mismatch for {surname} {first_name}: "
                           f"ID indicates {id_year}, but date of birth is {dob_year}")
                self.validation_errors.append(error_msg)
        except (IndexError, ValueError):
            error_msg = f"Invalid ID format for {surname} {first_name}: {skater_id}"
            self.validation_errors.append(error_msg)

    def _load_data(self, filepath: str) -> None:
        with open(filepath, newline='', encoding='UTF-8') as csvfile:
            reader = csv.reader(csvfile)
            
            # Get header row and find column indices
            header = next(reader)
            header_lower = [col.lower() for col in header]
            
            # Find required columns
            name_idx = self._find_column_index(header_lower, ['name', 'jmeno', 'name (meno)'])
            surname_idx = self._find_column_index(header_lower, ['surname', 'prijmeni', 'surname (priezvisko)'])
            dob_idx = self._find_column_index(header_lower, ['date of birth', 'datum narozeni', 'day of birth', 'day of birth (dátum narodenia)'])
            id_idx = self._find_column_index(header_lower, ['wsk id', 'id', 'world skate id'])
            
            if any(idx is None for idx in [name_idx, surname_idx, dob_idx, id_idx]):
                raise ValueError("Required columns not found in CSV file")

            # Process each row
            for row in reader:
                if not row:  # Skip empty rows
                    continue
                    
                surname = row[surname_idx].strip()
                first_name = row[name_idx].strip()
                dob_str = row[dob_idx].strip()
                skater_id = row[id_idx].strip()
                
                dob = self._parse_date(dob_str)
                self._validate_birth_year(skater_id, dob, surname, first_name)
                    
                skater_data = {
                    'surname': surname,
                    'first_name': first_name,
                    'date_of_birth': dob,  # Store as datetime object
                    'date_of_birth_str': dob_str,  # Keep original string format
                    'id': skater_id,
                    'raw_data': dict(zip(header, row))  # Store all original data
                }
                
                # Store in both dictionaries for different lookup methods
                if skater_data['id'] and skater_data['id'].upper() != 'NONE':
                    self.skaters_by_id[skater_data['id']] = skater_data
                
                # Store with surname-first convention, NFC-normalized for consistent matching
                name_key = (
                    unicodedata.normalize('NFC', skater_data['surname'].lower()),
                    unicodedata.normalize('NFC', skater_data['first_name'].lower()),
                )
                self.skaters_by_name[name_key] = skater_data

                # Also store under accent-stripped key as fallback for
                # Excel ↔ CSV Unicode mismatches
                ascii_key = (
                    self._to_ascii(skater_data['surname']),
                    self._to_ascii(skater_data['first_name']),
                )
                self.skaters_by_name_ascii[ascii_key] = skater_data

    def get_validation_errors(self) -> List[str]:
        """Get list of validation errors found during data loading."""
        return self.validation_errors

    def has_validation_errors(self) -> bool:
        """Check if any validation errors were found during data loading."""
        return len(self.validation_errors) > 0

    def _find_column_index(self, header: List[str], search_terms: List[str]) -> Optional[int]:
        """Find the index of a column that contains any of the search terms."""
        for i, col in enumerate(header):
            if any(term in col for term in search_terms):
                return i
        return None

    def get_by_id(self, skater_id: str) -> Optional[Dict]:
        """Get skater data by their ID."""
        return self.skaters_by_id.get(skater_id.strip())

    def get_by_name(self, surname: str, first_name: str) -> Optional[Dict]:
        """Get skater data by their surname and first name (case insensitive).
        
        Args:
            surname: The skater's surname
            first_name: The skater's first name
            
        Returns:
            Dictionary containing skater data if found, None otherwise
        """
        name_key = (
            unicodedata.normalize('NFC', surname.strip().lower()),
            unicodedata.normalize('NFC', first_name.strip().lower()),
        )
        result = self.skaters_by_name.get(name_key)
        if result:
            return result

        # Fallback: match after stripping all accents/diacritics so that
        # different Unicode representations of the same character still match
        ascii_key = (self._to_ascii(surname), self._to_ascii(first_name))
        return self.skaters_by_name_ascii.get(ascii_key)

    def get_date_of_birth(self, skater_id: str, format: str = '%d/%m/%Y') -> Optional[str]:
        """Get skater's date of birth by their ID.
        
        Args:
            skater_id: The skater's ID
            format: The desired date format string (default: DD/MM/YYYY)
            
        Returns:
            Formatted date string if found, None otherwise
        """
        skater = self.get_by_id(skater_id)
        if skater and skater['date_of_birth']:
            return skater['date_of_birth'].strftime(format)
        return None

    def get_date_of_birth_by_name(self, surname: str, first_name: str, format: str = '%d/%m/%Y') -> Optional[str]:
        """Get skater's date of birth by their surname and first name.
        
        Args:
            surname: The skater's surname
            first_name: The skater's first name
            format: The desired date format string (default: DD/MM/YYYY)
            
        Returns:
            Formatted date string if found, None otherwise
        """
        skater = self.get_by_name(surname, first_name)
        if skater and skater['date_of_birth']:
            return skater['date_of_birth'].strftime(format)
        return None

    def get_all_data(self, skater_id: str) -> Optional[Dict]:
        """Get all available data for a skater by their ID."""
        return self.get_by_id(skater_id)

    def get_all_data_by_name(self, surname: str, first_name: str) -> Optional[Dict]:
        """Get all available data for a skater by their surname and first name."""
        return self.get_by_name(surname, first_name)

    def format_full_name(self, skater_data: Dict) -> str:
        """Format the skater's full name in World Skate convention (surname first)."""
        return f"{skater_data['surname']} {skater_data['first_name']}"

# Example usage:
if __name__ == "__main__":
    # Load the registration data
    reg_data = RegistrationData("registration_responses.csv")
    
    # Check for validation errors
    if reg_data.has_validation_errors():
        print("Validation errors found:")
        for error in reg_data.get_validation_errors():
            print(f"- {error}")
        print()
    
    # Example searches
    # By ID
    skater = reg_data.get_by_id("12014CZE0029064769")
    if skater:
        print(f"Found skater by ID: {reg_data.format_full_name(skater)}")
        print(f"Date of birth (DD/MM/YYYY): {reg_data.get_date_of_birth(skater['id'])}")
        print(f"Date of birth (YYYY-MM-DD): {reg_data.get_date_of_birth(skater['id'], '%Y-%m-%d')}")
    
    # By name (using surname-first convention)
    skater = reg_data.get_by_name("Fiala", "Simon")
    if skater:
        print(f"\nFound skater by name: {reg_data.format_full_name(skater)}")
        print(f"Date of birth (DD/MM/YYYY): {reg_data.get_date_of_birth_by_name('Fiala', 'Simon')}")
        print(f"Date of birth (YYYY-MM-DD): {reg_data.get_date_of_birth_by_name('Fiala', 'Simon', '%Y-%m-%d')}")
        print(f"ID: {skater['id']}") 