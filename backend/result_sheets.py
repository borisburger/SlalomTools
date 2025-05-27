import csv
import argparse
import os
import datetime
from registration_data import RegistrationData
from typing import List, Tuple, Optional, Set

gs_dateOfBirthFormat = "%d/%m/%Y"

reg_data = RegistrationData("CFWC2025-RegistrationList.csv")

# Placeholder birthdate function (replace with real implementation)
def wssid_to_birthdate(skater_id: str) -> datetime.date:
    return reg_data.get_date_of_birth(skater_id, gs_dateOfBirthFormat)

# Parsing skater name based on nationality
def parse_name(name_parts: List[str], ctry: str) -> Tuple[str, str]:
    spanish_speaking: Set[str] = {'ESP', 'ARG', 'MEX', 'COL', 'CHI', 'PER', 'VEN', 'URU', 'CUB'}
    east_asian: Set[str] = {'CHN', 'KOR'}

    if len(name_parts) == 2:
        family_name, first_name = name_parts
    elif ctry.upper() in spanish_speaking:
        first_name = name_parts[-1]
        family_name = ' '.join(name_parts[:-1])
    elif ctry.upper() in {'CHN', 'KOR'}:
        family_name = name_parts[0]
        first_name = ' '.join(name_parts[1:])
    else:
        family_name = name_parts[0]
        first_name = ' '.join(name_parts[1:])

    return family_name, first_name 

# Extracting gender from ID
def skater_gender_from_id(skater_id: str) -> str:
    return "man" if skater_id.startswith('1') else "woman" if skater_id.startswith('2') else ""

def process_csv(filepath: str) -> Tuple[str, str, List[List[str]]]:
    extracted_rows: List[List[str]] = []
    discipline: str = ""
    category: str = ""

    with open(filepath, newline='', encoding='cp1252') as csvfile:
        reader = csv.reader(csvfile)

        header_found: bool = False
        discipline_found: bool = False
        data_started: bool = False
        rank_idx: Optional[int] = None
        id_idx: Optional[int] = None
        name_idx: Optional[int] = None
        ctry_idx: Optional[int] = None

        for row in reader:
            if row and row[0] in {"Picture", "Results", "Detailed results"}:
                continue

            if not discipline_found and row:
                # Check both first and second columns for discipline
                discipline_keywords = ["Classic", "Battle", "Freejump"]
                for col in [0, 1]:
                    if col < len(row) and any(keyword in row[col] for keyword in discipline_keywords):
                        discipline = row[col].strip()
                        # Get category from the next row in the same column
                        next_row = next(reader, [])
                        category = next_row[col].strip() if col < len(next_row) else ""
                        discipline_found = True
                        break
                if discipline_found:
                    continue

            if not header_found and row:
                # Convert row to lowercase for case-insensitive comparison
                row_lower: List[str] = [col.lower() for col in row]
                
                # Find indices for each required column with flexible naming
                rank_idx = None
                id_idx = None
                name_idx = None
                ctry_idx = None
                
                for i, col in enumerate(row_lower):
                    if col in ['rank', 'ranking', 'place']:
                        rank_idx = i
                    elif 'id' in col:
                        id_idx = i
                    elif col == 'name':
                        name_idx = i
                    elif col in ['ctry', 'country', 'nationality']:
                        ctry_idx = i
                
                # Check if we found all required columns
                if all(idx is not None for idx in [rank_idx, id_idx, name_idx, ctry_idx]):
                    header_found = True
                    continue
                # If the ID is missing, we can still try to find it in the registration list using the name and surname
                if id_idx is None and name_idx is not None and ctry_idx is not None:
                    header_found = True
                    # Inform the user that the ID is missing and we will try to find it in the registration list
                    #print(f"Skater ID is missing, will try to find it in the registration list using the name")
                    continue

            if header_found:
                if len(row) <= rank_idx:
                    continue

                rank: str = row[rank_idx].strip()

                # If the rank is not a digit, we need to skip the row
                if not rank.isdigit():
                    if data_started:
                        # Data ended
                        break
                    else:
                        # Data not started yet
                        continue

                if rank == "1":
                    data_started = True
                full_name: str = row[name_idx].strip()
                ctry: str = row[ctry_idx].strip()
                family_name, first_name = parse_name(full_name.split(), ctry)

                if id_idx is not None:
                    skater_id: str = row[id_idx].strip()
                else:
                    # If the ID is missing, we need to find it in the registration list using the name and surname
                    skater_data = reg_data.get_all_data_by_name(family_name, first_name)
                    if skater_data:
                        skater_id = skater_data['id']
                    else:
                        skater_id = "N/A"
                        print(f"Skater {full_name} ({ctry}) not found in registration list")


                if len(skater_id) < 5:
                    print(f"Skater {full_name} does not have a proper World Skate ID, trying to find birthdate in the registration list")
                    # If the skater does not have a proper World Skate ID, we need to find their birthdate
                    # from the registration list using their name and surname
                    skater_data = reg_data.get_all_data_by_name(family_name, first_name)
                    if skater_data:
                        birthdate = skater_data['date_of_birth'].strftime(gs_dateOfBirthFormat)
                        skater_id = skater_data['id']
                    else:
                        # Could not find the skater in the registration list, this is an error
                        raise ValueError(f"Skater {full_name} not found in registration list")
                else:
                    #print(f"Skater ID: {skater_id} {full_name}")
                    skater_data = reg_data.get_by_id(skater_id)
                    if skater_data:
                        birthdateDt = skater_data['date_of_birth']
                        if birthdateDt is not None:
                            birthdate = birthdateDt.strftime(gs_dateOfBirthFormat)
                        else:
                            birthdate = "N/A"
                            print(f"Skater {skater_id} {full_name} does not have a birthdate in the registration list")
                    else:
                        # Could not find the skater in the registration list, this is an error
                        raise ValueError(f"Skater {full_name} not found in registration list")
                gender: str = skater_gender_from_id(skater_id)

                extracted_rows.append([
                    rank,
                    skater_id,
                    first_name,
                    family_name,
                    gender,
                    birthdate,
                    ctry
                ])

    return discipline, category, extracted_rows

def main() -> None:
    parser: argparse.ArgumentParser = argparse.ArgumentParser(description="Process skating competition CSV files.")
    parser.add_argument("csv_files", nargs='+', help="Paths to CSV files.")
    args: argparse.Namespace = parser.parse_args()

    # If the csv_files is a directory, we need to get all the csv files in the directory
    if os.path.isdir(args.csv_files[0]):
        args.csv_files = [os.path.join(args.csv_files[0], f) for f in os.listdir(args.csv_files[0]) if f.endswith('.csv')]

    output_file: str = "combined_results.csv"
    
    with open(output_file, 'w', newline='', encoding='utf-8') as csv_out:
        writer: csv.writer = csv.writer(csv_out)
        
        # Process each file and write its contents
        for i, file in enumerate(args.csv_files):
            print(f"Processing {file}")
            discipline: str
            category: str
            rows: List[List[str]]
            discipline, category, rows = process_csv(file)

            # If no discipline was found, then we will use the file name to determine the discipline.
            # We need the file name without the extension.
            if not discipline:
                discipline = os.path.basename(file).split(".")[0]
                category = ""
            
            # Write discipline and category
            writer.writerow(["DISCIPLINE", discipline])
            writer.writerow(["CATEGORY", category])
            
            # Write column headers for this discipline
            writer.writerow(["RANK", "WORLD SKATE SKATER ID", "FIRST NAME", "FAMILY NAME", "GENDER", "BIRTHDATE DD/MM/YYYY", "NATIONALITY"])
            
            # Write the data rows
            writer.writerows(rows)
            
            # Add delimiter lines between disciplines (except after the last one)
            if i < len(args.csv_files) - 1:
                writer.writerow([])  # Empty line
                writer.writerow([])  # Empty line

    print(f"Combined results saved to '{output_file}'")

if __name__ == "__main__":
    main()
