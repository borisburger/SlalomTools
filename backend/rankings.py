import requests
from bs4 import BeautifulSoup
import json, pandas as pd, logging, os
from urllib.parse import urljoin
import time
import csv
import sys
import platform
import re
import shutil
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

# Global variable for DataTables request counter
gi_drawNumber = 1

# Global variable for tracking download progress
download_progress = {
    "current_discipline": None,
    "total_disciplines": 0,
    "completed_disciplines": 0,
    "is_complete": False
}

# Add the global variable for tracking skater database download progress
skater_db_progress = {
    "total_skaters": 0,
    "downloaded_skaters": 0,
    "is_complete": False
}

def reset_download_progress():
    """Reset the download progress tracking"""
    global download_progress
    download_progress = {
        "current_discipline": None,
        "total_disciplines": 0,
        "completed_disciplines": 0,
        "is_complete": False
    }

def get_download_progress():
    """Get the current download progress"""
    global download_progress
    return download_progress

def reset_skater_db_progress():
    """Reset the skater database download progress tracking"""
    global skater_db_progress
    skater_db_progress = {
        "total_skaters": 0,
        "downloaded_skaters": 0,
        "is_complete": False
    }

def get_skater_db_progress():
    """Get the current skater database download progress"""
    global skater_db_progress
    return skater_db_progress

def build_datatables_params(num_cols=7):
    global gi_drawNumber
    """
    Build a dictionary of query parameters for a DataTables-powered
    server endpoint, assuming `num_cols` identical columns.
    """
    params = {
        "draw": str(gi_drawNumber),  # Must increase with each request
        "start": "0",
        "length": "2147483647",         # Large number to request all rows
        "search[value]": "",
        "search[regex]": "false",
        "order[0][column]": "0",
        "order[0][dir]": "asc",
    }
    
    # Create columns[i][...] entries
    for col_index in range(num_cols):
        prefix = f"columns[{col_index}]"
        params[f"{prefix}[data]"] = str(col_index)
        params[f"{prefix}[name]"] = ""
        params[f"{prefix}[searchable]"] = "true"
        params[f"{prefix}[orderable]"] = "false"
        params[f"{prefix}[search][value]"] = ""
        params[f"{prefix}[search][regex]"] = "false"
    
    # Add a dynamic cache-busting parameter:
    params["_"] = str(int(time.time() * 1000))
    gi_drawNumber += 1
    return params

def strip_html(html_str):
    """Helper function to strip HTML tags from a string"""
    if not html_str:
        return ""
    return BeautifulSoup(html_str, 'html.parser').get_text(strip=True)

def normalize_filename(discipline_name):
    """Transform discipline name to a standardized format for filenames"""
    # Remove the "World Ranking month year - " prefix if present
    name = re.sub(r'^World Ranking .+? - ', '', discipline_name)
    
    # Replace spaces with hyphens and convert to lowercase
    name = name.replace(' ', '-').lower()
    
    # Replace multiple consecutive hyphens with a single hyphen
    name = re.sub(r'-+', '-', name)
    
    return name

def extract_discipline_type(discipline_name):
    """Extract the core discipline type from the full title"""
    # Remove the "World Ranking month year - " prefix if present
    name = re.sub(r'^World Ranking .+? - ', '', discipline_name)
    
    # Split by hyphen or space and get the first part
    parts = re.split(r'[-\s]+', name.lower())
    
    # Set of known discipline types
    discipline_types = {'classic', 'battle', 'jump', 'speed', 'pair', 'slides'}
    
    # Return the first matching discipline type or the first part if no match
    for part in parts:
        if part in discipline_types:
            return part
    
    return parts[0] if parts else ''

def format_date_for_folder(date_string):
    """
    Convert a date string from "YYYY-MM-DD" to "YYYY-MM_Month" format
    
    Args:
        date_string: Date string in "YYYY-MM-DD" format
        
    Returns:
        str: Date in "YYYY-MM_Month" format
    """
    try:
        # Parse the date string
        date_obj = datetime.strptime(date_string, "%Y-%m-%d")
        # Format to "YYYY-MM_Month" for better sorting
        return date_obj.strftime("%Y-%m_%b")
    except ValueError:
        # If parsing fails, return the original string
        logging.warning(f"Could not parse date: {date_string}, using as is")
        return date_string

def get_latest_rankings_folder(main_dir="rankings"):
    """
    Find the latest rankings folder by scanning folder names
    
    Args:
        main_dir: The directory containing ranking folders
        
    Returns:
        str: Path to the latest rankings folder, or None if no folders exist
    """
    if not os.path.exists(main_dir):
        return None
        
    # Get all subdirectories in the rankings folder
    folders = [d for d in os.listdir(main_dir) 
              if os.path.isdir(os.path.join(main_dir, d))]
    
    if not folders:
        return None
    
    # Sort folders - with YYYY-MM_Month format, alphabetical sort = chronological sort
    folders.sort()
    
    # Return the path to the latest folder
    latest_folder = folders[-1]
    return os.path.join(main_dir, latest_folder)

def get_discipline_file_path(discipline_name, main_dir="rankings"):
    """
    Get the path to a specific discipline file in the latest rankings folder
    
    Args:
        discipline_name: Name of the discipline (normalized or not)
        main_dir: The directory containing ranking folders
        
    Returns:
        str: Path to the discipline CSV file, or None if not found
    """
    # Get the latest rankings folder
    latest_folder = get_latest_rankings_folder(main_dir)
    if not latest_folder:
        return None
    
    # Normalize the discipline name for filename matching
    normalized_name = normalize_filename(discipline_name)
    
    # Check if the file exists
    file_path = os.path.join(latest_folder, f"{normalized_name}.csv")
    if os.path.exists(file_path):
        return file_path
    
    # If not found with exact name, try to match with any available files
    for file in os.listdir(latest_folder):
        if file.endswith('.csv'):
            # Check if normalized filename is similar
            base_name = file[:-4]
            if base_name.lower() == normalized_name.lower():
                return os.path.join(latest_folder, file)
    
    # Discipline file not found
    return None

def fetch_rankings(base_url=None):
    """
    Fetch the latest World Skate rankings and save them as CSV files
    
    Args:
        base_url: The base URL of the World Skate rankings application
        
    Returns:
        tuple: (latest_date, output_dir) - The date of the rankings and the path to the folder
    """
    try:
        # Reset progress tracking at the start
        reset_download_progress()
        
        # If no base_url is provided, try to load from config
        if base_url is None:
            try:
                import json
                with open("config.json") as f:
                    config = json.load(f)
                base_url = config.get("worldSkateRankingsUrl", "https://app-69b8883b-99d4-4935-9b2b-704880862424.cleverapps.io")
            except Exception as e:
                logging.error(f"Failed to load URL from config, using default: {e}")
                base_url = "https://app-69b8883b-99d4-4935-9b2b-704880862424.cleverapps.io"
        
        # Create a session for better performance
        session = requests.Session()
                
        logging.info(f"Fetching rankings page: {base_url}")
        response = session.get(base_url, timeout=10)
        response.raise_for_status()  # Raise HTTPError for bad status codes
    except requests.RequestException as e:
        logging.error(f"Failed to fetch the rankings page: {e}")
        raise

    soup = BeautifulSoup(response.text, 'html.parser')
    logging.info("Rankings page fetched and parsed successfully")

    # Extract the latest ranking date from the first archive link
    archives_div = soup.find('div', class_='left-filters')
    latest_link = archives_div.find('a') if archives_div else None
    if not latest_link:
        logging.error("Latest archive link not found")
        raise ValueError("Latest archive link not found")
        
    latest_date = latest_link.get_text(strip=True)
    logging.info(f"Latest ranking date: {latest_date}")

    # Format the date for the folder name
    folder_date = format_date_for_folder(latest_date)
    logging.info(f"Using folder name format: {folder_date}")

    # Identify disciplines and their data URLs
    rankings_container = soup.find('div', class_='rankings-container')
    if not rankings_container:
        logging.error("Rankings container not found in page")
        raise ValueError("Rankings container not found in page")
        
    table_containers = rankings_container.find_all('div', class_='table-container')
    disciplines = []
    table_metadata = []
    
    # Counter for generating sequential table IDs
    table_counter = 0
    
    for container in table_containers:
        title_tag = container.find('caption')
        table_tag = container.find('table', attrs={'data-url': True})
        h2_tag = container.find('h2', attrs={'table-id': True})
        
        if not title_tag or not table_tag or not h2_tag:
            continue
            
        discipline_name = title_tag.get_text(strip=True)
        data_url = table_tag['data-url']
        full_data_url = urljoin(base_url, data_url)
        
        # Get the table ID from the h2 element and construct the proper wrapper ID
        table_id = f"DataTables_Table_{h2_tag['table-id']}_wrapper"
        
        # Extract sex and age from the title
        sex = None
        age = None
        
        # Split discipline name into words and convert to lowercase
        words = discipline_name.lower().split()
        
        # Check for exact matches of sex categories
        if "women" in words:
            sex = "women"
        elif "men" in words:
            sex = "men"
            
        # Check for exact matches of age categories
        if "senior" in words:
            age = "senior"
        elif "junior" in words:
            age = "junior"
            
        # Add to disciplines list
        disciplines.append((discipline_name, full_data_url))
        
        # Add to metadata
        table_metadata.append({
            "discipline": extract_discipline_type(discipline_name),
            "sex": sex,
            "age": age,
            "table_id": table_id,
            "data_url": full_data_url
        })
    
    # Update total disciplines count
    global download_progress
    download_progress["total_disciplines"] = len(disciplines)
    
    # Create output directory
    output_dir = os.path.join("rankings", folder_date)
    os.makedirs(output_dir, exist_ok=True)
    
    # Save metadata
    metadata_file = os.path.join(output_dir, "table_metadata.json")
    with open(metadata_file, 'w') as f:
        json.dump({
            "date": folder_date,
            "tables": table_metadata
        }, f, indent=2)
    
    # Process each discipline
    for i, (discipline_name, data_url) in enumerate(disciplines):
        try:
            # Update current discipline and progress
            download_progress["current_discipline"] = discipline_name
            download_progress["completed_disciplines"] = i  # Update completed count before processing
            
            logging.info(f"Downloading JSON data for {discipline_name}")
            response = session.get(data_url, params=build_datatables_params(), timeout=10)
            response.raise_for_status()
            
            data = response.json()
            if not data.get("data"):
                logging.warning(f"No data found for {discipline_name}")
                continue
                
            # Convert to DataFrame and save as CSV in one step
            filename = normalize_filename(discipline_name)
            csv_path = os.path.join(output_dir, f"{filename}.csv")
            
            # Create DataFrame from raw data
            df = pd.DataFrame(data["data"])
            
            # Clean the data by stripping HTML tags from all columns
            cleaned_data = {
                'Rank': df[0].apply(lambda x: strip_html(str(x))),  # Current world rank
                'Prev': df[1].apply(lambda x: strip_html(str(x))),  # Previous world rank
                'Best': df[2].apply(lambda x: strip_html(str(x))),  # Sum of 4 best scores
                'Name': df[3].apply(lambda x: strip_html(str(x))),  # Surname + First name
                'Nat.': df[4].apply(lambda x: strip_html(str(x))),  # 3-letter country code
                'ID': df[5].apply(lambda x: strip_html(str(x))),    # World Skate ID
                'Total': df[6].apply(lambda x: strip_html(str(x)))  # Total points in last year
            }
            
            # Create formatted DataFrame with cleaned data
            formatted_df = pd.DataFrame(cleaned_data)
            
            # Save to CSV with proper formatting
            formatted_df.to_csv(csv_path, index=False, quoting=csv.QUOTE_ALL)
            logging.info(f"Saved CSV for {discipline_name}: {csv_path}")
            
        except Exception as e:
            logging.error(f"Error processing {discipline_name}: {e}")
            continue
    
    # Mark download as complete and set final count
    download_progress["is_complete"] = True
    download_progress["current_discipline"] = None
    download_progress["completed_disciplines"] = len(disciplines)  # Set final count
    
    return folder_date, output_dir

def fetch_skater_database(base_url=None):
    """
    Fetch the World Skate skater database in chunks and save as JSON file
    
    Args:
        base_url: The base URL of the World Skate rankings application
        
    Returns:
        str: Path to the saved JSON file
    """
    try:
        # Reset progress tracking at the start
        reset_skater_db_progress()
        
        # If no base_url is provided, try to load from config
        if base_url is None:
            try:
                with open("config.json") as f:
                    config = json.load(f)
                base_url = config.get("worldSkateRankingsUrl", "https://app-69b8883b-99d4-4935-9b2b-704880862424.cleverapps.io")
            except Exception as e:
                logging.error(f"Failed to load URL from config, using default: {e}")
                base_url = "https://app-69b8883b-99d4-4935-9b2b-704880862424.cleverapps.io"
        
        # Create output directory if it doesn't exist
        os.makedirs("rankings", exist_ok=True)
        output_file = "rankings/skater-db.json"
        logging.info(f"Will save skater database to: {output_file}")
        
        # Create a session for better performance
        session = requests.Session()
        
        # First, make a request to get the total number of skaters
        logging.info(f"Fetching initial skater data to determine total count")
        initial_url = f"{base_url}/athletes.json"
        params = build_datatables_params(num_cols=7)
        params["length"] = "1"  # Just get one record to get the total count
        response = session.get(initial_url, params=params, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        total_skaters = data.get("recordsTotal", 0)
        logging.info(f"Total skaters in database: {total_skaters}")
        
        if total_skaters == 0:
            logging.error("No skaters found in database")
            raise ValueError("No skaters found in database")
        
        # Update total skaters count in progress
        global skater_db_progress
        skater_db_progress["total_skaters"] = total_skaters
        
        # Initialize the full skater list
        all_skaters = []
        
        # Download data in chunks of 500 skaters
        chunk_size = 500
        
        for start in range(0, total_skaters, chunk_size):
            end = min(start + chunk_size, total_skaters)
            logging.info(f"Downloading skaters {start+1}-{end} of {total_skaters}")
            
            # Prepare parameters for this chunk
            chunk_params = build_datatables_params(num_cols=7)
            chunk_params["start"] = str(start)
            chunk_params["length"] = str(chunk_size)
            
            # Make the request
            chunk_response = session.get(initial_url, params=chunk_params, timeout=15)
            chunk_response.raise_for_status()
            
            chunk_data = chunk_response.json()
            skaters_chunk = chunk_data.get("data", [])
            
            # Process skater data - clean HTML
            processed_skaters = []
            for skater in skaters_chunk:
                # Convert each skater from a list to a dictionary with meaningful property names
                processed_skater = {
                    "family_name": strip_html(str(skater[0])),
                    "first_name": strip_html(str(skater[1])),
                    "nationality": strip_html(str(skater[2])),
                    "world_skate_id": strip_html(str(skater[3])),
                    "birth_date": strip_html(str(skater[4])),
                    "previous_ids": skater[5] if len(skater) > 5 and skater[5] else [],
                    "edit_url": strip_html(str(skater[6])) if len(skater) > 6 else ""
                }
                processed_skaters.append(processed_skater)
            
            # Add processed skaters to full list
            all_skaters.extend(processed_skaters)
            
            # Update progress
            skater_db_progress["downloaded_skaters"] = len(all_skaters)
            
            # Add a small delay to avoid overwhelming the server
            time.sleep(0.5)
        
        # Create a formatted structure
        skater_database = {
            "timestamp": datetime.now().isoformat(),
            "total_skaters": total_skaters,
            "skaters": all_skaters,
            "fields": [
                "family_name", 
                "first_name", 
                "nationality", 
                "world_skate_id", 
                "birth_date", 
                "previous_ids",
                "edit_url"
            ]
        }
        
        # Save to file
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(skater_database, f, indent=2, ensure_ascii=False)
        
        # Log file size for debugging
        file_size = os.path.getsize(output_file) / (1024 * 1024)  # Size in MB
        logging.info(f"Skater database file saved with size: {file_size:.2f} MB")
        
        # Mark as complete
        skater_db_progress["is_complete"] = True
        skater_db_progress["downloaded_skaters"] = total_skaters
        
        logging.info(f"Successfully downloaded {total_skaters} skaters to {output_file}")
        return output_file
    
    except Exception as e:
        logging.error(f"Error downloading skater database: {e}")
        skater_db_progress["is_complete"] = True  # Mark as complete even if there was an error
        raise

def main():
    """Main function to execute when script is run standalone"""
    try:
        latest_date, output_dir = fetch_rankings()
        logging.info(f"Successfully downloaded rankings for {latest_date} to {output_dir}")
        return 0
    except Exception as e:
        logging.error(f"Failed to download rankings: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
