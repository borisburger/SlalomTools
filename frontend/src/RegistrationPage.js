import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const API_BASE = "http://localhost:8000";
const LOCAL_STORAGE_KEY = "registration_sheet_url";

const DISPLAY_PRESETS = {
  "classic": {
    name: "Classic (ID, Name, Team, W. Rank, Ctry)",
    columns: ["world_skate_id", "full_name", "club", "world_rank", "nationality"],
    showOrder: false
  },
  "battle": {
    name: "Battle (ID, BIB, Name, Team, Ctry, W.Rank)",
    columns: ["world_skate_id", "bib", "full_name", "club", "nationality", "world_rank"],
    showOrder: false
  },
  "names_only": {
    name: "Names Only",
    columns: ["full_name"],
    showOrder: false
  },
  "complete": {
    name: "Complete Profile",
    columns: ["world_skate_id", "full_name", "dob", "age", "sex", "nationality", "club", "disciplines", "email", "phone"],
    showOrder: true
  },
  "new_skaters": {
    name: "New Skaters",
    columns: ["first_name", "family_name", "sex", "dob", "nationality"],
    showOrder: false,
    specialFilters: {
      noWorldSkateId: true,
      minAge: 10
    }
  }
};

// Get current year for age calculations
const CURRENT_YEAR = new Date().getFullYear();

// Define age categories with dynamic year calculations
const getAgePresets = () => {
  return {
    "kids_u10": {
      name: "Kids U10",
      // Kids 4-9 years old (will not reach 10 this year)
      minYear: CURRENT_YEAR - 9,  // Oldest: turning 9 this year
      maxYear: CURRENT_YEAR - 4   // Youngest: turning 4 this year (practical minimum)
    },
    "juniors_u15": {
      name: "Juniors U15",
      // Kids 10-14 years old this year
      minYear: CURRENT_YEAR - 14, // Oldest: turning 14 this year
      maxYear: CURRENT_YEAR - 10  // Youngest: turning 10 this year
    },
    "juniors_u19": {
      name: "Juniors U19",
      // Teens 15-18 years old this year
      minYear: CURRENT_YEAR - 18, // Oldest: turning 18 this year
      maxYear: CURRENT_YEAR - 15  // Youngest: turning 15 this year
    },
    "juniors_10_18": {
      name: "Juniors 10-18",
      // All juniors 10-18 years old this year
      minYear: CURRENT_YEAR - 18, // Oldest: turning 18 this year
      maxYear: CURRENT_YEAR - 10  // Youngest: turning 10 this year
    },
    "seniors": {
      name: "Seniors",
      // 19 years and older this year
      minYear: null,               // No upper age limit
      maxYear: CURRENT_YEAR - 19   // Youngest: turning 19 this year
    },
    "custom": {
      name: "Custom Range",
      minYear: null,
      maxYear: null,
      isCustom: true
    }
  };
};

const AGE_PRESETS = getAgePresets();

// Helper function to get birth year from date string
const getBirthYear = (dobString) => {
  if (!dobString) return null;
  
  // Log the original date string for debugging
  console.log(`Processing date of birth: "${dobString}"`);
  
  try {
    // Try to parse the date string
    const date = new Date(dobString);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      console.log(`  - Parsed as Date object: ${date.toISOString()}, year: ${year}`);
      return year;
    }
    
    // If direct parsing fails, try to extract year from string
    const yearMatch = dobString.match(/\d{4}/);
    if (yearMatch) {
      const year = parseInt(yearMatch[0]);
      console.log(`  - Extracted year from string: ${year}`);
      return year;
    }
    
    console.log(`  - Failed to parse date or extract year`);
  } catch (e) {
    console.error(`Error parsing date "${dobString}":`, e);
  }
  return null;
};

// Helper function to check if a birth year falls within an age range
const isInAgeRange = (birthYear, minYear, maxYear) => {
  if (!birthYear) return false;
  if (minYear !== null && birthYear < minYear) return false;
  if (maxYear !== null && birthYear > maxYear) return false;
  return true;
};

function RegistrationPage() {
  const [searchParams] = useSearchParams();
  const [sheetsUrl, setSheetsUrl] = useState("");
  const [skaters, setSkaters] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [filteredSkaters, setFilteredSkaters] = useState([]);
  const [selectedDiscipline, setSelectedDiscipline] = useState("");
  const [selectedGender, setSelectedGender] = useState("all");
  const [selectedAgePreset, setSelectedAgePreset] = useState("all");
  const [customMinAge, setCustomMinAge] = useState(10);
  const [customMaxAge, setCustomMaxAge] = useState(18);
  const [showCustomAgeControls, setShowCustomAgeControls] = useState(false);
  const [displayPreset, setDisplayPreset] = useState("classic");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [authStatus, setAuthStatus] = useState(null);
  const [authEmail, setAuthEmail] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [showAuthDetails, setShowAuthDetails] = useState(false);
  const [showSheetDetails, setShowSheetDetails] = useState(true);
  const [documentTitle, setDocumentTitle] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [rankingsData, setRankingsData] = useState({});
  const [rankingsLatestUpdate, setRankingsLatestUpdate] = useState("");
  const [isLoadingRankings, setIsLoadingRankings] = useState(false);
  const [rankingsError, setRankingsError] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [sortColumn, setSortColumn] = useState("world_rank"); // Default sort by world rank
  const [sortDirection, setSortDirection] = useState("asc"); // For world_rank, asc now means unranked first, then worst to best
  
  // State for World Skate database
  const [skaterDB, setSkaterDB] = useState(null);
  const [isLoadingSkaterDB, setIsLoadingSkaterDB] = useState(false);
  const [skaterDBError, setSkaterDBError] = useState("");
  const [verificationResults, setVerificationResults] = useState({});

  // Load URL from local storage on component mount
  useEffect(() => {
    const savedUrl = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedUrl) {
      console.log("Loading saved URL from localStorage:", savedUrl);
      setSheetsUrl(savedUrl);
      
      // Load saved document title from localStorage
      const savedTitle = localStorage.getItem(`${LOCAL_STORAGE_KEY}_title`);
      if (savedTitle) {
        console.log("Loading saved document title:", savedTitle);
        setDocumentTitle(savedTitle);
      } else {
        // Try to extract the document title from the URL
        try {
          const urlObj = new URL(savedUrl);
          const pathParts = urlObj.pathname.split('/');
          const possibleTitle = pathParts.find(part => part.length > 5 && !part.includes('.'));
          setDocumentTitle(possibleTitle || "Google Sheet");
        } catch {
          setDocumentTitle("Google Sheet");
        }
      }
      
      // Optionally load data automatically if authentication is available
      if (authStatus) {
        loadRegistrationFromSavedUrl(savedUrl);
      }
    }
  }, [authStatus]); // Add authStatus as dependency to reload when auth changes

  // Handle authentication code from URL if present
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get("code");
    const state = urlParams.get("state");
    
    if (authCode) {
      completeAuthentication(authCode, state);
    } else if (searchParams.get("auth_success") === "true") {
      checkAuthStatus();
    }
  }, [searchParams]);

  // Check authentication status
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // Fetch rankings data when component mounts
  useEffect(() => {
    fetchRankingsData();
  }, []);

  // Load skater database when component mounts
  useEffect(() => {
    if (dataLoaded) {
      fetchSkaterDatabase();
    }
  }, [dataLoaded]);

  // Update useEffect for display preset changes
  useEffect(() => {
    if (dataLoaded && skaters.length > 0) {
      console.log("Display preset changed, reapplying filters with preset:", displayPreset);
      fetchSkaters(selectedDiscipline, selectedGender, selectedAgePreset, displayPreset);
    }
  }, [displayPreset, dataLoaded]);

  // Update useEffect for other filter changes
  useEffect(() => {
    if (dataLoaded && skaters.length > 0) {
      console.log("Regular filters changed, reapplying all filters including display preset:", displayPreset);
      fetchSkaters(selectedDiscipline, selectedGender, selectedAgePreset, displayPreset);
    }
  }, [selectedDiscipline, selectedGender, selectedAgePreset, dataLoaded]);

  // Load skater database and verify skaters
  useEffect(() => {
    if (dataLoaded && filteredSkaters.length > 0) {
      const loadDBAndVerify = async () => {
        console.log("Data loaded and skaters available - ensuring database is loaded for verification");
        
        // Check if database is already loaded
        if (!skaterDB || !skaterDB.data || !skaterDB.data.skaters) {
          console.log("Database not loaded yet - loading now");
          // Load the database first
          const db = await fetchSkaterDatabase();
          
          // Make sure database was successfully loaded
          if (db && db.data && db.data.skaters) {
            console.log("Database loaded successfully, verifying skaters");
            // Database loaded successfully, verify skaters
            verifySkaters(filteredSkaters, db.idMap);
          } else {
            console.error("Failed to load database for verification");
          }
        } else {
          console.log("Database already loaded, verifying skaters");
          // Database already loaded, just verify
          verifySkaters(filteredSkaters, skaterDB.idMap);
        }
      };
      
      loadDBAndVerify();
    }
  }, [dataLoaded, filteredSkaters]);
  
  // Original database loading effect - keep for backward compatibility
  useEffect(() => {
    if (dataLoaded) {
      fetchSkaterDatabase();
    }
  }, [dataLoaded]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${API_BASE}/google/auth/status`);
      const data = await response.json();
      setAuthStatus(data.is_authenticated);
      setAuthEmail(data.email || "");
      setAuthMessage(data.is_authenticated ? 
        `Authenticated as ${data.email || 'unknown user'}` : 
        "Not authenticated with Google. Please authenticate to access Google Sheets.");
    } catch (error) {
      setAuthStatus(false);
      setAuthEmail("");
      setError("Failed to check authentication status: " + error.message);
    }
  };

  const handleInitiateAuth = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/google/auth/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        // Open the auth URL in a new window
        window.open(data.auth_url, "_blank");
        setAuthMessage(data.message);
      }
    } catch (error) {
      setError("Failed to initiate authentication: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRegistration = async () => {
    if (!sheetsUrl) {
      setError("Please enter a Google Sheets URL");
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      
      // Save URL to local storage
      localStorage.setItem(LOCAL_STORAGE_KEY, sheetsUrl);
      console.log("Saved URL to localStorage:", sheetsUrl);
      
      const response = await fetch(`${API_BASE}/registration/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sheetsUrl })
      });
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setDataLoaded(false);
      } else {
        // Set document title from API response
        if (data.document_title) {
          setDocumentTitle(data.document_title);
          // Also save the document title to localStorage for future use
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_title`, data.document_title);
        } else {
          // Extract a title from the URL if possible
          try {
            const urlObj = new URL(sheetsUrl);
            const pathParts = urlObj.pathname.split('/');
            // Try to find a meaningful name in the URL
            const possibleTitle = pathParts.find(part => part.length > 5 && !part.includes('.'));
            setDocumentTitle(possibleTitle || "Google Sheet");
          } catch {
            setDocumentTitle("Google Sheet");
          }
        }
        
        // Fetch disciplines and skaters
        await fetchDisciplines();
        await fetchSkaters();
        
        // Mark data as loaded
        setDataLoaded(true);
        
        // Collapse the sheets source section after successful loading
        setShowSheetDetails(false);
      }
    } catch (error) {
      setError("Failed to load registration data: " + error.message);
      setDataLoaded(false);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDisciplines = async () => {
    try {
      const response = await fetch(`${API_BASE}/registration/disciplines`);
      const data = await response.json();
      setDisciplines(data.disciplines || []);
    } catch (error) {
      setError("Failed to fetch disciplines: " + error.message);
    }
  };

  const fetchSkaters = async (discipline = "", sex = "all", agePreset = "all", currentDisplayPreset = null) => {
    try {
      // Use the passed display preset or fall back to the state value
      const presetToUse = currentDisplayPreset || displayPreset;
      console.log(`fetchSkaters called with discipline: ${discipline}, sex: ${sex}, agePreset: ${agePreset}, displayPreset: ${presetToUse}`);
      
      // First fetch the full list of skaters if not already loaded
      if (skaters.length === 0) {
        let url = `${API_BASE}/registration/skaters`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.error) {
          setError(data.error);
          return;
        }
        
        setSkaters(data.skaters || []);
        
        // Apply filters to the full list of skaters
        let filtered = data.skaters || [];
        console.log(`Starting with ${filtered.length} skaters from API`);
        
        // First apply regular filters
        filtered = applyFilters(filtered, discipline, sex, agePreset);
        console.log(`After regular filters: ${filtered.length} skaters`);
        
        // Then apply display preset specific filters, using the correct preset
        filtered = applyDisplayPresetFilters(filtered, presetToUse);
        console.log(`After display preset filters (${presetToUse}): ${filtered.length} skaters`);
        
        // Apply sorting to the filtered list
        filtered = sortSkaters(filtered);
        
        // Log the final list before setting state
        console.log(`Final filtered list (${filtered.length} skaters):`, filtered.map(s => s.full_name).join(", "));
        
        setFilteredSkaters(filtered);
      } else {
        // Apply filters to the existing skaters list
        let filtered = [...skaters];
        console.log(`Starting with ${filtered.length} skaters from state`);
        
        // First apply regular filters
        filtered = applyFilters(filtered, discipline, sex, agePreset);
        console.log(`After regular filters: ${filtered.length} skaters`);
        
        // Then apply display preset specific filters, using the correct preset
        filtered = applyDisplayPresetFilters(filtered, presetToUse);
        console.log(`After display preset filters (${presetToUse}): ${filtered.length} skaters`);
        
        // Apply sorting to the filtered list
        filtered = sortSkaters(filtered);
        
        // Log the final list before setting state
        console.log(`Final filtered list (${filtered.length} skaters):`, filtered.map(s => s.full_name).join(", "));
        
        setFilteredSkaters(filtered);
      }
      
      setDataLoaded(true);
    } catch (error) {
      setError("Failed to fetch skaters: " + error.message);
    }
  };
  
  // Helper function to apply filters to a list of skaters
  const applyFilters = (skatersList, discipline, sex, agePreset) => {
    let filtered = [...skatersList];
    
    console.log("Starting filters with", filtered.length, "skaters");
    
    // Apply discipline filter
    if (discipline) {
      filtered = filtered.filter(skater => 
        skater.disciplines && 
        Array.isArray(skater.disciplines) && 
        skater.disciplines.includes(discipline)
      );
      console.log(`After discipline filter (${discipline}):`, filtered.length, "skaters");
    }
    
    // Apply gender filter
    if (sex && sex !== "all") {
      filtered = filtered.filter(skater => skater.sex === sex);
      console.log(`After gender filter (${sex}):`, filtered.length, "skaters");
    }
    
    // Apply age filter
    if (agePreset && agePreset !== "all") {
      // Common log header to show we're starting age filtering
      console.log("------ Age filtering ------");
      
      if (agePreset === "custom") {
        // Force sanity check - make sure customMinAge <= customMaxAge
        const minAge = Math.min(customMinAge, customMaxAge);
        const maxAge = Math.max(customMinAge, customMaxAge);
        
        console.log(`Custom age range: ${minAge}-${maxAge} years`);
        
        // Calculate birth year range exactly the same way as presets
        // For someone to be X years old in CURRENT_YEAR, they were born in CURRENT_YEAR - X
        // For example, to be 18 in 2024, birth year is 2024-18=2006
        // To be in the range 10-18, birth year must be between 2024-18=2006 and 2024-10=2014
        const oldestBirthYear = CURRENT_YEAR - maxAge; // oldest skater, lowest birth year (2006 for 18yo)
        const youngestBirthYear = CURRENT_YEAR - minAge; // youngest skater, highest birth year (2014 for 10yo)
        
        console.log(`Birth year range: ${oldestBirthYear} to ${youngestBirthYear}`);
        
        // Create an array of all skaters with their parsed birth years for debugging
        const skatersWithYears = filtered.map(skater => ({
          name: skater.full_name,
          dob: skater.dob,
          birthYear: getBirthYear(skater.dob),
          age: getBirthYear(skater.dob) ? CURRENT_YEAR - getBirthYear(skater.dob) : "unknown"
        }));
        
        console.log("Skaters before age filter:", skatersWithYears);
        
        // Filter by age range
        filtered = filtered.filter(skater => {
          const birthYear = getBirthYear(skater.dob);
          if (!birthYear) return false;
          
          // Calculate actual age in current year
          const ageThisYear = CURRENT_YEAR - birthYear;
          
          // Log detailed info for each skater (helpful for debugging)
          console.log(`Skater: ${skater.full_name}, Born: ${birthYear}, Age: ${ageThisYear}, In range ${minAge}-${maxAge}: ${ageThisYear >= minAge && ageThisYear <= maxAge}`);
          
          // This skater is in range if:
          // 1. Their age this year is at least minAge
          // 2. Their age this year is at most maxAge
          // This is equivalent to checking birth year against the calculated range
          return ageThisYear >= minAge && ageThisYear <= maxAge;
        });
        
        // Log the results
        console.log(`After custom age filter (${minAge}-${maxAge}):`, filtered.length, "skaters");
      } else {
        // Using a preset age category
        const preset = AGE_PRESETS[agePreset];
        if (preset) {
          console.log(`Age preset: ${agePreset} (${preset.name})`);
          console.log(`Birth year range: ${preset.minYear || "no min"} to ${preset.maxYear || "no max"}`);
          
          filtered = filtered.filter(skater => {
            const birthYear = getBirthYear(skater.dob);
            if (!birthYear) return false;
            
            // Standard range check
            let inRange = true;
            if (preset.minYear !== null) inRange = inRange && birthYear >= preset.minYear;
            if (preset.maxYear !== null) inRange = inRange && birthYear <= preset.maxYear;
            
            return inRange;
          });
          
          console.log(`After preset age filter (${preset.name}):`, filtered.length, "skaters");
        }
      }
    }
    
    return filtered;
  };

  // Update applyDisplayPresetFilters to accept a preset parameter
  const applyDisplayPresetFilters = (skaters, presetToUse = null) => {
    // Use the passed preset or fall back to the state value
    const preset = presetToUse || displayPreset;
    console.log("Applying display preset filters for preset:", preset);
    
    if (!preset || !DISPLAY_PRESETS[preset]?.specialFilters) {
      console.log("No special filters for this preset, returning original list");
      return skaters;
    }
    
    const specialFilters = DISPLAY_PRESETS[preset].specialFilters;
    let filtered = [...skaters];
    console.log("Starting with", filtered.length, "skaters before special filters");
    
    // Filter out skaters with world_skate_id
    if (specialFilters.noWorldSkateId) {
      filtered = filtered.filter(skater => {
        const hasNoId = !skater.world_skate_id;
        if (!hasNoId) {
          console.log(`Excluding skater with ID: ${skater.full_name}, ID: ${skater.world_skate_id}`);
        }
        return hasNoId;
      });
      console.log("After filtering out skaters with World Skate ID:", filtered.length);
    }
    
    // Filter by minimum age
    if (specialFilters.minAge) {
      filtered = filtered.filter(skater => {
        const birthYear = getBirthYear(skater.dob);
        if (!birthYear) {
          console.log(`Excluding skater with no birth year: ${skater.full_name}, DOB: ${skater.dob}`);
          return false;
        }
        
        // Calculate age in current year
        const ageThisYear = CURRENT_YEAR - birthYear;
        const included = ageThisYear >= specialFilters.minAge;
        
        if (!included) {
          console.log(`Excluding skater too young: ${skater.full_name}, Birth Year: ${birthYear}, Age This Year: ${ageThisYear}`);
        }
        
        return included;
      });
      console.log(`After filtering by minimum age (${specialFilters.minAge}):`, filtered.length);
    }
    
    // Log the remaining skaters
    console.log("Skaters after all special filters:", filtered.map(s => s.full_name).join(", "));
    
    return filtered;
  };

  const handleDisciplineChange = async (discipline) => {
    setSelectedDiscipline(discipline);
    await fetchSkaters(discipline, selectedGender, selectedAgePreset);
  };

  const handleGenderChange = async (gender) => {
    setSelectedGender(gender);
    await fetchSkaters(selectedDiscipline, gender, selectedAgePreset);
  };

  const handleAgePresetChange = async (preset) => {
    setSelectedAgePreset(preset);
    
    // Show custom controls if custom preset is selected
    if (preset === "custom") {
      setShowCustomAgeControls(true);
    } else {
      setShowCustomAgeControls(false);
    }
    
    await fetchSkaters(selectedDiscipline, selectedGender, preset);
  };
  
  const handleCustomAgeChange = async () => {
    // Only re-fetch if custom preset is selected
    if (selectedAgePreset === "custom") {
      // Clear any existing timeout to prevent race conditions
      if (window.customAgeTimeout) {
        clearTimeout(window.customAgeTimeout);
      }
      
      // Log the current age range for debugging
      console.log(`Custom age change: setting range to ${customMinAge}-${customMaxAge}`);
      
      // Apply filtering with current state values
      await fetchSkaters(selectedDiscipline, selectedGender, "custom");
    }
  };

  // Helper function to determine age category for rankings (junior or senior)
  const getAgeCategory = (birthYear) => {
    if (!birthYear) return null;
    
    const currentYear = new Date().getFullYear();
    // If skater is/will be 19 or older this year, they are a senior
    return (currentYear - birthYear >= 19) ? 'senior' : 'junior';
  };
  
  // Helper function to map gender to rankings format
  const mapGenderToRankings = (gender) => {
    if (gender === 'M') return 'men';
    if (gender === 'F') return 'women';
    return null;
  };
  
  // Helper function to map discipline name to rankings format
  const mapDisciplineToRankings = (discipline) => {
    const lowerDiscipline = discipline.toLowerCase();
    
    // Map based on common discipline naming patterns
    if (lowerDiscipline.includes('classic') || lowerDiscipline.includes('slalom classic')) {
      return 'classic';
    } else if (lowerDiscipline.includes('battle') || lowerDiscipline.includes('slalom battle')) {
      return 'battle';
    } else if (lowerDiscipline.includes('speed') || lowerDiscipline.includes('speed slalom')) {
      return 'speed';
    } else if (lowerDiscipline.includes('jump') || lowerDiscipline.includes('high jump')) {
      return 'jump';
    } else if (lowerDiscipline.includes('slides') || lowerDiscipline.includes('slides')) {
      return 'slides';
    } else if (lowerDiscipline.includes('pair')) {
      return 'pair';
    }
    
    return null;
  };
  
  // Get skater ranking based on world skate ID, discipline, gender and age
  const getSkaterRanking = (skater) => {
    if (!skater || !skater.world_skate_id || !rankingsData) {
      return null;
    }
    
    // Get age category based on birth year
    const birthYear = getBirthYear(skater.dob);
    
    // Kids under 10 don't have rankings
    if (birthYear && (new Date().getFullYear() - birthYear) < 10) {
      return null;
    }
    
    const ageCategory = getAgeCategory(birthYear);
    if (!ageCategory) return null;
    
    // Current discipline and gender
    let discipline = selectedDiscipline ? mapDisciplineToRankings(selectedDiscipline) : null;
    let gender = mapGenderToRankings(skater.sex);
    
    if (!discipline || !gender) return null;
    
    // Construct the rankings key using the pattern discipline-gender-ageCategory
    const rankingsKey = `${discipline}-${gender}-${ageCategory}`;
    
    // Check if we have rankings for this combination
    if (rankingsData[rankingsKey] && rankingsData[rankingsKey][skater.world_skate_id]) {
      return rankingsData[rankingsKey][skater.world_skate_id];
    }
    
    return null;
  };

  const handlePresetChange = (preset) => {
    console.log("Changing display preset to:", preset);
    
    // Set the preset state
    setDisplayPreset(preset);
    
    // Call fetchSkaters with the new preset explicitly passed
    fetchSkaters(selectedDiscipline, selectedGender, selectedAgePreset, preset);
  };

  // Function to complete the authentication flow
  const completeAuthentication = async (code, state) => {
    try {
      setIsLoading(true);
      setError("");
      
      // Call the API endpoint to complete authentication
      const response = await fetch(`${API_BASE}/api/google/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || '')}`);
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
      } else {
        // Remove code from URL without page refresh
        const url = new URL(window.location.href);
        url.searchParams.delete("code");
        url.searchParams.delete("state");
        url.searchParams.delete("scope");
        window.history.replaceState({}, document.title, url.toString());
        
        // Check auth status after successful authentication
        await checkAuthStatus();
      }
    } catch (error) {
      setError("Failed to complete authentication: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to load registration from saved URL
  const loadRegistrationFromSavedUrl = async (url) => {
    if (!url) return;
    
    try {
      setIsLoading(true);
      setError("");
      
      const response = await fetch(`${API_BASE}/registration/load`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        setDataLoaded(false);
      } else {
        console.log("Successfully loaded data from saved URL");
        
        // Use document title from API response
        if (data.document_title) {
          setDocumentTitle(data.document_title);
          // Also save the document title to localStorage for future use
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_title`, data.document_title);
          console.log("Saved document title:", data.document_title);
        } else {
          // Use saved title from localStorage if available
          const savedTitle = localStorage.getItem(`${LOCAL_STORAGE_KEY}_title`);
          if (savedTitle) {
            setDocumentTitle(savedTitle);
          } else {
            setDocumentTitle("Registration Sheet");
          }
        }
        
        // Fetch disciplines and skaters
        await fetchDisciplines();
        await fetchSkaters();
        
        // Mark data as loaded
        setDataLoaded(true);
        
        // Explicitly collapse the sheet details section
        setShowSheetDetails(false);
      }
    } catch (error) {
      setError("Failed to load registration data: " + error.message);
      setDataLoaded(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to get a shortened URL for display
  const getShortenedUrl = (url) => {
    if (!url) return "";
    try {
      // Extract the document ID from the URL
      const match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        return `.../${match[1].substring(0, 8)}...`;
      }
      // If no match, just truncate the URL
      return url.length > 40 ? url.substring(0, 37) + "..." : url;
    } catch (e) {
      return url.length > 40 ? url.substring(0, 37) + "..." : url;
    }
  };

  // Function to copy table data to clipboard
  const copyTableToClipboard = () => {
    if (filteredSkaters.length === 0) return;
    
    try {
      // Format each row of data
      const rows = filteredSkaters.map((skater, index) => {
        const rowData = [];
        
        // Only add order if the current preset shows it
        if (DISPLAY_PRESETS[displayPreset].showOrder) {
          rowData.push(index + 1); // Ord column (skating order)
        }
        
        DISPLAY_PRESETS[displayPreset].columns.forEach(column => {
          let cellContent = skater[column] || "";
          
          // Special case for disciplines array
          if (column === "disciplines" && Array.isArray(cellContent)) {
            cellContent = cellContent.join(", ");
          }
          
          // Special case for world_rank (get from rankings)
          if (column === "world_rank") {
            const ranking = getSkaterRanking(skater);
            if (ranking) {
              // Extract just the numeric rank value for clipboard copying
              cellContent = ranking.rank;
            } else if (skater.world_skate_id) {
              cellContent = "-"; // Has ID but no ranking
            } else {
              cellContent = "N/A"; // No ID
            }
          }
          
          // Special case for BIB (not assigned yet)
          if (column === "bib") {
            cellContent = "";
          }
          
          // Special case for first_name and family_name (split from full_name)
          if (column === "first_name" && !skater.first_name) {
            const nameParts = (skater.full_name || "").split(" ");
            cellContent = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
          }
          
          if (column === "family_name" && !skater.family_name) {
            const nameParts = (skater.full_name || "").split(" ");
            cellContent = nameParts.length > 0 ? nameParts[0] : "";
          }
          
          // Special case for sex (display as "man" or "woman")
          if (column === "sex") {
            cellContent = skater.sex === "M" ? "man" : skater.sex === "F" ? "woman" : "";
          }
          
          // Special case for dob (format as DD/MM/YYYY)
          if (column === "dob" && skater.dob) {
            try {
              const date = new Date(skater.dob);
              if (!isNaN(date.getTime())) {
                // Format as DD/MM/YYYY
                const day = date.getDate().toString().padStart(2, '0');
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const year = date.getFullYear();
                cellContent = `${day}/${month}/${year}`;
              }
            } catch (e) {
              // Keep original content if parsing fails
            }
          }
          
          // Special case for age (compute from birth year)
          if (column === "age") {
            const birthYear = getBirthYear(skater.dob);
            if (birthYear) {
              // Calculate age in current year
              const ageThisYear = CURRENT_YEAR - birthYear;
              cellContent = ageThisYear.toString();
            } else {
              cellContent = "-";
            }
          }
          
          rowData.push(cellContent);
        });
        
        return rowData;
      });
      
      // Convert to tab-separated string for clipboard (works well with Excel/Sheets)
      // Exclude headers, only include the skater rows
      const clipboardText = rows.map(row => row.join('\t')).join('\n');
      
      // Copy to clipboard
      navigator.clipboard.writeText(clipboardText).then(() => {
        // Show success message
        setCopySuccess(true);
        // Hide success message after 2 seconds
        setTimeout(() => setCopySuccess(false), 2000);
      });
    } catch (err) {
      console.error('Failed to copy table to clipboard:', err);
      setError("Failed to copy table to clipboard. Your browser may not support this feature.");
    }
  };

  // Function to fetch all rankings data
  const fetchRankingsData = async (retryCount = 0, maxRetries = 3) => {
    if (isLoadingRankings) return;
    
    try {
      setIsLoadingRankings(true);
      setRankingsError("");
      
      const response = await fetch(`${API_BASE}/api/rankings/all/combined`);
      
      if (!response.ok) {
        if (response.status === 404 && retryCount < maxRetries) {
          // If not found, maybe rankings aren't downloaded yet, wait and retry
          console.log(`Rankings data not found (404), retrying (${retryCount + 1}/${maxRetries})...`);
          setTimeout(() => fetchRankingsData(retryCount + 1, maxRetries), 2000);
          return;
        } else {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
      }
      
      const data = await response.json();
      console.log(`Loaded rankings data: ${Object.keys(data.rankings).length} disciplines`);
      
      setRankingsData(data.rankings || {});
      setRankingsLatestUpdate(data.latest_update || "");
    } catch (error) {
      console.error("Error fetching rankings data:", error);
      setRankingsError(error.message);
    } finally {
      setIsLoadingRankings(false);
    }
  };

  // Fetch World Skate skater database
  const fetchSkaterDatabase = async (retryCount = 0, maxRetries = 3) => {
    if (isLoadingSkaterDB) return;
    
    try {
      setIsLoadingSkaterDB(true);
      setSkaterDBError("");
      
      console.log("Fetching World Skate skater database...");
      const response = await fetch(`${API_BASE}/api/skater-db/data`);
      
      if (!response.ok) {
        if (response.status === 404 && retryCount < maxRetries) {
          // If not found, maybe database isn't downloaded yet, wait and retry
          console.log(`Skater database not found (404), retrying (${retryCount + 1}/${maxRetries})...`);
          setTimeout(() => fetchSkaterDatabase(retryCount + 1, maxRetries), 2000);
          return;
        } else {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
      }
      
      // Parse the response
      const responseData = await response.json();
      console.log("Received database response:", responseData);
      
      // Validate the response
      if (!responseData) {
        throw new Error("Empty response received from server");
      }
      
      // Make sure skaters array exists
      if (!responseData.skaters || !Array.isArray(responseData.skaters)) {
        console.error("Invalid database format:", responseData);
        throw new Error("Invalid skater database format: missing skaters array");
      }
      
      const uniqueSkatersCount = responseData.skaters.length;
      console.log(`Successfully loaded World Skate database with ${uniqueSkatersCount} skaters`);
      
      // Create a map for faster lookups by ID
      const idMap = {};
      responseData.skaters.forEach(skater => {
        const id = skater.world_skate_id;
        if (id) {
          idMap[id] = skater;
          
          // Also map by previous IDs if available
          if (skater.previous_ids && Array.isArray(skater.previous_ids)) {
            skater.previous_ids.forEach(prevId => {
              if (prevId) idMap[prevId] = skater;
            });
          }
        }
      });
      
      const totalIdsCount = Object.keys(idMap).length;
      
      // Store both the raw data and the ID map for easy lookups
      const dbObject = {
        data: responseData,  // Store the complete response
        idMap: idMap,
        uniqueSkatersCount: uniqueSkatersCount,
        totalIdsCount: totalIdsCount,
        timestamp: responseData.timestamp || new Date().toISOString()
      };
      
      console.log("Setting database state:", dbObject);
      setSkaterDB(dbObject);
      
      // If we have skaters loaded, verify them against the database
      if (filteredSkaters.length > 0) {
        console.log(`Verifying ${filteredSkaters.length} skaters against new database`);
        verifySkaters(filteredSkaters, idMap);
      }
      
      return dbObject; // Return the database object for potential immediate use
      
    } catch (error) {
      console.error("Error fetching skater database:", error);
      setSkaterDBError(error.message);
      return null;
    } finally {
      setIsLoadingSkaterDB(false);
    }
  };
  
  // Verify skaters against World Skate database
  const verifySkaters = (skatersToVerify, idMap) => {
    if (!idMap) {
      if (skaterDB && skaterDB.idMap) {
        idMap = skaterDB.idMap;
      } else {
        console.error("No skater database available for verification");
        return;
      }
    }
    
    // Make sure we have the skater database data available for potential matches
    let database = null;
    if (skaterDB) {
      database = skaterDB;
      console.log("Using skaterDB for potential matches search", skaterDB);
    }
    
    if (!database || !database.data || !database.data.skaters) {
      console.error("Cannot verify skaters: No skater database available or invalid database format");
      return;
    }
    
    console.log(`Verifying ${skatersToVerify.length} skaters against World Skate database...`);
    const results = {};
    
    // Format date consistently for display
    const formatDateForDisplay = (dateObj) => {
      if (!dateObj) return "Not provided";
      return `${(dateObj.month + 1).toString().padStart(2, '0')}/${dateObj.day.toString().padStart(2, '0')}/${dateObj.year}`;
    };
    
    // Check each skater in the list
    skatersToVerify.forEach(skater => {
      const id = skater.world_skate_id;
      if (!id) {
        // Skater doesn't have a World Skate ID - try to find potential matches
        console.log(`Searching for matches for skater without ID: ${skater.full_name}`);
        const potentialMatches = findPotentialMatches(skater, database);
        
        if (potentialMatches.length === 0) {
          // No potential matches found - this is a valid state for new skaters
          // Mark as verified since no ID has been assigned yet
          results[skater.id || skater.full_name] = {
            verified: true, // Mark as verified since this is a legitimate state
            noIdAssigned: true,
            error: null,
            details: "No World Skate ID has been assigned to this skater"
          };
        } else if (potentialMatches.length === 1) {
          // Found exactly one potential match - suggest this as a likely match
          const match = potentialMatches[0];
          const regDateObj = skater.dob ? parseDate(skater.dob) : null;
          const wsDateObj = match.birth_date ? parseDate(match.birth_date) : null;
          
          results[skater.id || skater.full_name] = {
            verified: false,
            error: null,
            potentialMatch: true,
            suggestion: `Possible match found: ${match.first_name} ${match.family_name} (${match.world_skate_id})`,
            registeredData: {
              name: skater.full_name,
              dob: skater.dob,
              parsedDob: regDateObj ? formatDateForDisplay(regDateObj) : null,
              nationality: skater.nationality
            },
            wsData: {
              name: `${match.first_name} ${match.family_name}`,
              dob: match.birth_date,
              parsedDob: wsDateObj ? formatDateForDisplay(wsDateObj) : null,
              nationality: match.nationality,
              world_skate_id: match.world_skate_id
            }
          };
        } else {
          // Multiple potential matches found
          results[skater.id || skater.full_name] = {
            verified: false,
            error: null,
            potentialMatches: true,
            matchCount: potentialMatches.length,
            suggestions: potentialMatches.map(match => ({
              name: `${match.first_name} ${match.family_name}`,
              id: match.world_skate_id,
              nationality: match.nationality,
              birth_date: match.birth_date
            }))
          };
        }
        return;
      }
      
      // Continue with existing verification for skaters with IDs
      // Look up the skater in the database
      const dbSkater = idMap[id];
      if (!dbSkater) {
        // ID not found in database
        results[skater.id || skater.full_name] = {
          verified: false,
          error: "World Skate ID not found in database",
          details: null
        };
        return;
      }
      
      // Check name match (partial match is acceptable)
      const regName = (skater.full_name || "").toLowerCase();
      const wsName = `${dbSkater.first_name} ${dbSkater.family_name}`.toLowerCase();
      
      // Use normalized text for name comparison
      const normalizedRegName = normalizeText(skater.full_name);
      const normalizedWsName = normalizeText(`${dbSkater.first_name} ${dbSkater.family_name}`);
      const normalizedFirstName = normalizeText(dbSkater.first_name);
      
      const nameMatch = 
        normalizedWsName.includes(normalizedRegName) || 
        normalizedRegName.includes(normalizedWsName) ||
        normalizedRegName.includes(normalizedFirstName); // Check first name match
      
      // Parse and check birth date match using our custom date parser
      let dobMatch = false;
      let regDateObj = null;
      let wsDateObj = null;
      
      if (skater.dob && dbSkater.birth_date) {
        regDateObj = parseDate(skater.dob);
        wsDateObj = parseDate(dbSkater.birth_date);
        
        if (regDateObj && wsDateObj) {
          // Compare year and month (day can sometimes vary by 1-2 days in registration)
          dobMatch = regDateObj.year === wsDateObj.year && regDateObj.month === wsDateObj.month;
          
          // Log the comparison
          console.log(`Date comparison for ${skater.full_name}: 
            Reg: ${formatDateForDisplay(regDateObj)} 
            WS: ${formatDateForDisplay(wsDateObj)} 
            Match: ${dobMatch}`);
        }
      }
      
      // Overall verification result
      results[skater.id || skater.full_name] = {
        verified: nameMatch && dobMatch,
        nameMatch: nameMatch,
        dobMatch: dobMatch,
        registeredData: {
          name: skater.full_name,
          dob: skater.dob,
          parsedDob: regDateObj ? formatDateForDisplay(regDateObj) : null
        },
        wsData: {
          name: `${dbSkater.first_name} ${dbSkater.family_name}`,
          dob: dbSkater.birth_date,
          parsedDob: wsDateObj ? formatDateForDisplay(wsDateObj) : null,
          nationality: dbSkater.nationality
        }
      };
    });
    
    console.log("Verification complete:", results);
    setVerificationResults(results);
    return results;
  };

  // Add this new function for sorting by World Skate ID
  const sortSkaters = (skaters) => {
    const sortedSkaters = [...skaters];
    
    sortedSkaters.sort((a, b) => {
      if (sortColumn === "world_rank") {
        // Get rankings for both skaters
        const rankingA = getSkaterRanking(a);
        const rankingB = getSkaterRanking(b);
        
        // NEW SORT LOGIC:
        // 1. Unranked skaters appear first (they skate first)
        // 2. Ranked skaters appear in order from worst to best (highest number to lowest)
        
        if (rankingA && rankingB) {
          // Both have rankings, compare them - higher numbers (worse rankings) come first
          return sortDirection === "asc" 
            ? rankingB.rank - rankingA.rank  // Reverse: higher numbers first
            : rankingA.rank - rankingB.rank;
        } else if (rankingA) {
          // Only A has a ranking, unranked B comes first for asc
          return sortDirection === "asc" ? 1 : -1;
        } else if (rankingB) {
          // Only B has a ranking, unranked A comes first for asc
          return sortDirection === "asc" ? -1 : 1;
        } else {
          // Neither has a ranking, maintain original order
          return 0;
        }
      } else if (sortColumn === "world_skate_id") {
        // Sort by World Skate ID
        const idA = a[sortColumn] || "";
        const idB = b[sortColumn] || "";
        
        // Empty IDs should be sorted last regardless of direction
        if (!idA && !idB) return 0;
        if (!idA) return sortDirection === "asc" ? 1 : -1;
        if (!idB) return sortDirection === "asc" ? -1 : 1;
        
        // Normal string comparison for non-empty IDs
        if (idA < idB) return sortDirection === "asc" ? -1 : 1;
        if (idA > idB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      } else if (sortColumn === "age") {
        // Calculate ages for both skaters
        const birthYearA = getBirthYear(a.dob);
        const birthYearB = getBirthYear(b.dob);
        
        // Calculate age in current year
        const ageA = birthYearA ? CURRENT_YEAR - birthYearA : -1; // -1 for unknown ages
        const ageB = birthYearB ? CURRENT_YEAR - birthYearB : -1;
        
        // Sort by age (ascending = youngest to oldest)
        if (ageA === -1 && ageB === -1) return 0; // Both unknown
        if (ageA === -1) return sortDirection === "asc" ? 1 : -1; // Unknown ages last
        if (ageB === -1) return sortDirection === "asc" ? -1 : 1;
        
        return sortDirection === "asc" ? ageA - ageB : ageB - ageA;
      } else if (sortColumn === "full_name" || sortColumn === "first_name" || sortColumn === "family_name") {
        // String comparison for name fields
        const valueA = (a[sortColumn] || "").toLowerCase();
        const valueB = (b[sortColumn] || "").toLowerCase();
        
        if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
        if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      } else if (sortColumn === "club" || sortColumn === "nationality") {
        // Simple string comparison for club and nationality
        const valueA = (a[sortColumn] || "").toLowerCase();
        const valueB = (b[sortColumn] || "").toLowerCase();
        
        if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
        if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      }
      
      // Default: maintain original order
      return 0;
    });
    
    return sortedSkaters;
  };

  // Function to handle column header clicks for sorting
  const handleSort = (column) => {
    // If clicking the same column, toggle direction
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // If clicking a new column, set it as sort column
      // and set appropriate default direction
      setSortColumn(column);
      // For world_rank, asc means unranked first, then worst to best (highest to lowest numbers)
      // For text columns, asc means alphabetical A-Z
      setSortDirection("asc");
    }
    
    // Re-sort the current filtered skaters
    setFilteredSkaters(currentSkaters => sortSkaters([...currentSkaters]));
  };

  // Add a button to manually trigger verification
  const handleVerifySkaters = () => {
    if (!skaterDB) {
      // Load database first
      fetchSkaterDatabase().then(() => {
        if (skaterDB && skaterDB.idMap) {
          verifySkaters(filteredSkaters, skaterDB.idMap);
        }
      });
    } else {
      // Database already loaded, just verify
      verifySkaters(filteredSkaters, skaterDB.idMap);
    }
  };
  
  // Get verification status icon/color for a skater
  const getVerificationStatus = (skater) => {
    if (!verificationResults || !skaterDB) {
      return { icon: "⚪", color: "#6c757d", tooltip: "Not verified yet" };
    }
    
    const result = verificationResults[skater.id || skater.full_name];
    if (!result) {
      return { icon: "⚪", color: "#6c757d", tooltip: "Not verified yet" };
    }
    
    // Debug log the verification result structure
    console.log(`Verification result for ${skater.full_name}:`, result);
    
    if (!skater.world_skate_id) {
      // No WS ID provided, check if we found potential matches
      if (result.noIdAssigned) {
        // This is a skater without an assigned World Skate ID (valid state)
        return { 
          icon: "✅", 
          color: "#28a745", 
          tooltip: "Verified: No World Skate ID has been assigned to this skater" 
        };
      }
      
      if (result.potentialMatch) {
        // Found a single strong match
        return { 
          icon: "💡", 
          color: "#28a745", 
          tooltip: `${result.suggestion}
Found a likely match in World Skate database.
Registration: ${result.registeredData.name} (${result.registeredData.parsedDob || result.registeredData.dob || 'No DOB'})
World Skate: ${result.wsData.name} (${result.wsData.parsedDob || result.wsData.dob || 'No DOB'})
ID in Database: ${result.wsData.world_skate_id}`
        };
      }
      
      if (result.potentialMatches) {
        // Found multiple possible matches
        const matchesInfo = result.suggestions
          .slice(0, 3) // Limit to first 3 for tooltip readability
          .map(s => `${s.name} (${s.id}, ${s.nationality})`)
          .join('\n');
          
        return { 
          icon: "🔍", 
          color: "#17a2b8", 
          tooltip: `Found ${result.matchCount} possible matches in World Skate database.
Top matches:
${matchesInfo}${result.matchCount > 3 ? '\n(and more...)' : ''}`
        };
      }
      
      // If we get here with a result but none of the above conditions match,
      // something might be wrong with the result object
      if (result.error) {
        return { icon: "⚠️", color: "#ffc107", tooltip: result.error };
      }
      
      return { icon: "⚪", color: "#6c757d", tooltip: "Verification status unknown" };
    }
    
    if (result.error) {
      return { icon: "❌", color: "#dc3545", tooltip: result.error };
    }
    
    if (result.verified) {
      return { icon: "✅", color: "#28a745", tooltip: "Verified" };
    }
    
    // Partial match - show detailed information about what doesn't match
    if (result.nameMatch && !result.dobMatch) {
      return { 
        icon: "🔶", 
        color: "#fd7e14", 
        tooltip: `Name matches but birth date doesn't match
Registration: ${result.registeredData.parsedDob || result.registeredData.dob || 'Not provided'}
World Skate: ${result.wsData.parsedDob || result.wsData.dob || 'Not provided'}`
      };
    }
    
    if (!result.nameMatch && result.dobMatch) {
      return { 
        icon: "🔶", 
        color: "#fd7e14", 
        tooltip: `Birth date matches but name doesn't match
Registration: ${result.registeredData.name || 'Not provided'}
World Skate: ${result.wsData.name || 'Not provided'}`
      };
    }
    
    // Both name and DOB don't match
    if (!result.nameMatch && !result.dobMatch) {
      return { 
        icon: "❌", 
        color: "#dc3545", 
        tooltip: `Neither name nor birth date match
Registration: ${result.registeredData.name || 'Not provided'} (${result.registeredData.parsedDob || result.registeredData.dob || 'No DOB'})
World Skate: ${result.wsData.name || 'Not provided'} (${result.wsData.parsedDob || result.wsData.dob || 'No DOB'})`
      };
    }
    
    return { icon: "❌", color: "#dc3545", tooltip: "Verification failed" };
  };

  // Function to normalize text for comparison - handles accents, special characters, etc.
  const normalizeText = (text) => {
    if (!text) return '';
    
    // Convert to lowercase
    let normalized = text.toLowerCase();
    
    // Replace accented characters with non-accented equivalents using NFD normalization
    // This handles most accented Latin characters
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Handle special characters that don't decompose properly with NFD
    // More efficient lookup table for non-standard transliterations
    const transliterations = {
      // Special character pairs
      'æ': 'ae', 'œ': 'oe', 'ø': 'o', 'ö': 'o', 'ő': 'o',
      'å': 'a', 'ä': 'a', 'â': 'a', 'à': 'a', 'á': 'a',
      'ë': 'e', 'ê': 'e', 'è': 'e', 'é': 'e', 'ę': 'e',
      'ï': 'i', 'î': 'i', 'ì': 'i', 'í': 'i',
      'ü': 'u', 'û': 'u', 'ù': 'u', 'ú': 'u', 'ű': 'u',
      'ÿ': 'y', 'ý': 'y',
      'ß': 'ss', 'þ': 'th',
      
      // Slavic/Eastern European
      'č': 'c', 'ć': 'c', 'ċ': 'c',
      'š': 's', 'ś': 's', 'ŝ': 's',
      'ž': 'z', 'ź': 'z', 'ż': 'z',
      'ň': 'n', 'ń': 'n', 'ñ': 'n',
      'ř': 'r', 'ŕ': 'r', 'ŗ': 'r',
      'ď': 'd', 'đ': 'd', 'ð': 'd',
      'ť': 't', 'ț': 't', 'ŧ': 't',
      'ł': 'l', 'ŀ': 'l',
      
      // Other special characters
      'ı': 'i', 'ȷ': 'j', 'ĸ': 'k',
      'ŉ': 'n', 'ſ': 's', 
      'ą': 'a'
    };
    
    // Apply transliterations in a single pass by replacing each character
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized[i];
      if (transliterations[char]) {
        normalized = normalized.substring(0, i) + transliterations[char] + normalized.substring(i + 1);
        i += transliterations[char].length - 1; // Adjust index to account for replacement length
      }
    }
    
    // Remove any remaining non-alphanumeric characters (keep spaces)
    normalized = normalized.replace(/[^a-z0-9\s]/g, '');
    
    // Trim excess whitespace and collapse multiple spaces into one
    normalized = normalized.trim().replace(/\s+/g, ' ');
    
    return normalized;
  };

  // Search for potential matches in the skater database by name, birth date, and nationality
  const findPotentialMatches = (skater, skaterDatabase) => {
    if (!skaterDatabase || !skaterDatabase.data || !skaterDatabase.data.skaters) {
      console.error("Invalid database object provided to findPotentialMatches", skaterDatabase);
      return [];
    }
    
    const skaterName = (skater.full_name || "").toLowerCase();
    if (!skaterName || skaterName.length < 3) {
      console.log(`Skater name too short for matching: ${skaterName}`);
      return []; // Name too short for reliable matching
    }
    
    // Normalize skater name for comparison
    const normalizedSkaterName = normalizeText(skater.full_name);
    
    // Parse the registration skater's date of birth
    const regDateObj = skater.dob ? parseDate(skater.dob) : null;
    
    // Get the skater's nationality (if available)
    const nationality = (skater.nationality || "").toUpperCase();
    
    console.log(`Searching for potential matches for: ${skater.full_name} (normalized: ${normalizedSkaterName}), DOB: ${skater.dob}, Nationality: ${nationality}`);
    console.log(`Database has ${skaterDatabase.data.skaters.length} skaters to search through`);
    
    // Filter the database to find potential matches
    const potentialMatches = skaterDatabase.data.skaters.filter(dbSkater => {
      // Create full name from World Skate database
      const dbFullName = `${dbSkater.first_name} ${dbSkater.family_name}`;
      
      // Normalize World Skate name
      const normalizedDbName = normalizeText(dbFullName);
      const normalizedFirstName = normalizeText(dbSkater.first_name);
      const normalizedFamilyName = normalizeText(dbSkater.family_name);
      
      // Split the skater name for better matching
      const nameParts = normalizedSkaterName.split(' ');
      
      // Check for name similarity using normalized text
      let nameMatches = false;
      
      // Method 1: Complete string inclusion
      if (normalizedDbName.includes(normalizedSkaterName) || normalizedSkaterName.includes(normalizedDbName)) {
        nameMatches = true;
      } 
      // Method 2: Check first and last names separately
      else if (nameParts.length > 1) {
        // Try to match first part of skater name with family name
        const potentialLastName = nameParts[0];
        // Try to match remaining parts with first name
        const potentialFirstName = nameParts.slice(1).join(' ');
        
        // Check if potential last name matches family name
        const lastNameMatch = normalizedFamilyName.includes(potentialLastName) || 
                            potentialLastName.includes(normalizedFamilyName);
                            
        // Check if potential first name matches first name
        const firstNameMatch = normalizedFirstName.includes(potentialFirstName) || 
                             potentialFirstName.includes(normalizedFirstName);
                             
        // Both parts need to match in some way
        if (lastNameMatch && firstNameMatch) {
          nameMatches = true;
        }
        
        // Try alternate order (Western naming convention) 
        const westernFirstName = nameParts[0];
        const westernLastName = nameParts.slice(1).join(' ');
        
        const altLastNameMatch = normalizedFamilyName.includes(westernLastName) || 
                                westernLastName.includes(normalizedFamilyName);
                                
        const altFirstNameMatch = normalizedFirstName.includes(westernFirstName) || 
                                westernFirstName.includes(normalizedFirstName);
                                
        if (altLastNameMatch && altFirstNameMatch) {
          nameMatches = true;
        }
      }
      
      if (!nameMatches) return false;
      
      // Log potential name match
      console.log(`Name match found: "${dbFullName}" for "${skater.full_name}"`);
      
      // If we have a birth date, check for a match
      if (regDateObj && dbSkater.birth_date) {
        const wsDateObj = parseDate(dbSkater.birth_date);
        if (!wsDateObj) return false;
        
        // Must match on year and month
        const dateMatches = regDateObj.year === wsDateObj.year && regDateObj.month === wsDateObj.month;
        console.log(`Date comparison: ${skater.dob} vs ${dbSkater.birth_date} - Match: ${dateMatches}`);
        
        if (!dateMatches) return false;
      }
      
      // If we have nationality, check for a match
      if (nationality && dbSkater.nationality) {
        const nationalityMatches = nationality === dbSkater.nationality.toUpperCase();
        console.log(`Nationality comparison: ${nationality} vs ${dbSkater.nationality} - Match: ${nationalityMatches}`);
        
        if (!nationalityMatches) return false;
      }
      
      // If we reached here, this is a good match
      console.log(`Found matching skater: ${dbFullName} (${dbSkater.world_skate_id})`);
      return true;
    });
    
    console.log(`Found ${potentialMatches.length} potential matches`);
    return potentialMatches;
  };

  // Helper function to parse dates regardless of format
  const parseDate = (dateString) => {
    if (!dateString) return null;
    
    console.log(`Parsing date: ${dateString}`);
    
    try {
      // For MM/DD/YYYY format (common in registration data)
      if (dateString.includes('/')) {
        const parts = dateString.split('/');
        if (parts.length === 3) {
          // Create date from parts assuming MM/DD/YYYY
          const month = parseInt(parts[0], 10) - 1; // JS months are 0-indexed
          const day = parseInt(parts[1], 10);
          const year = parseInt(parts[2], 10);
          
          if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            console.log(`Parsed as MM/DD/YYYY: ${month+1}/${day}/${year}`);
            return { day, month, year };
          }
        }
      }
      
      // For YYYY-MM-DD format (World Skate database)
      if (dateString.includes('-')) {
        const parts = dateString.split('-');
        if (parts.length === 3) {
          // Create date from parts assuming YYYY-MM-DD
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
          const day = parseInt(parts[2], 10);
          
          if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            console.log(`Parsed as YYYY-MM-DD: ${month+1}/${day}/${year}`);
            return { day, month, year };
          }
        }
      }
      
      // Try standard Date parsing as fallback
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        console.log(`Parsed with standard Date: ${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`);
        return {
          day: date.getDate(),
          month: date.getMonth(),
          year: date.getFullYear()
        };
      }
    } catch (err) {
      console.error(`Error parsing date ${dateString}:`, err);
    }
    
    console.log(`Failed to parse date: ${dateString}`);
    return null;
  };

  return (
    <div style={{ 
      padding: "20px", 
      backgroundColor: "#121212", 
      color: "#ffffff", 
      minHeight: "100vh",
      fontFamily: "Arial, sans-serif"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px"
      }}>
        <h1 style={{ margin: 0 }}>Registration Management</h1>
        <button 
          onClick={() => window.location.href = "/operator"}
          style={{
            padding: "8px 15px",
            backgroundColor: "#555",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "1rem",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <span>Back to Operator Console</span>
          <span style={{fontSize: "0.9rem"}}>←</span>
        </button>
      </div>
      
      {/* Google Authentication Section */}
      <div style={{
        marginBottom: "15px",
        padding: "12px 15px",
        border: "1px solid #333",
        borderRadius: "4px",
        backgroundColor: "#222"
      }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer" 
        }} onClick={() => setShowAuthDetails(!showAuthDetails)}>
          <div style={{ 
            display: "flex", 
            alignItems: "center"
          }}>
            <div style={{
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: authStatus ? "#4CAF50" : "#dc3545",
              marginRight: "10px"
            }}></div>
            <div style={{ fontSize: "0.9em" }}>
              {authStatus 
                ? `Google Sheets: Authenticated as ${authEmail || 'unknown user'}` 
                : "Google Sheets: Not authenticated"}
            </div>
          </div>
          <div style={{ 
            fontSize: "1.2em", 
            transform: showAuthDetails ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s"
          }}>
            ▼
          </div>
        </div>
        
        {showAuthDetails && (
          <div style={{ marginTop: "15px" }}>
            <p style={{ fontSize: "0.9em", color: "#ccc", marginTop: "0" }}>
              {authMessage || "Authentication is required to access Google Sheets data."}
            </p>
            
            {!authStatus && (
              <button 
                onClick={handleInitiateAuth}
                disabled={isLoading}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#007BFF",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "0.9em"
                }}
              >
                {isLoading ? "Loading..." : "Authenticate with Google"}
              </button>
            )}
          </div>
        )}
      </div>
      
      {/* Google Sheets URL Section */}
      <div style={{
        marginBottom: "15px",
        padding: "12px 15px",
        border: "1px solid #333",
        borderRadius: "4px",
        backgroundColor: "#222"
      }}>
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer" 
        }} onClick={() => setShowSheetDetails(!showSheetDetails)}>
          <div style={{ 
            display: "flex", 
            alignItems: "center",
            overflow: "hidden",
            maxWidth: "calc(100% - 30px)"
          }}>
            <div style={{
              fontSize: "0.9em",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden"
            }}>
              <span style={{ fontWeight: "bold", marginBottom: "2px" }}>Google Sheets Source:</span>
              {skaters.length > 0 && (
                <>
                  <span style={{ color: "#4CAF50", fontWeight: "bold", marginBottom: "2px" }}>
                    {documentTitle} ({skaters.length} skaters)
                  </span>
                  <span style={{ 
                    color: "#4CAF50", 
                    fontSize: "0.85em",
                    textOverflow: "ellipsis",
                    overflow: "hidden",
                    whiteSpace: "nowrap"
                  }}>
                    {sheetsUrl}
                  </span>
                </>
              )}
              {skaters.length === 0 && sheetsUrl && (
                <span style={{ color: "#FFA500" }}>
                  URL loaded but no data found
                </span>
              )}
              {!sheetsUrl && (
                <span style={{ color: "#dc3545" }}>
                  No sheet selected
                </span>
              )}
            </div>
          </div>
          <div style={{ 
            fontSize: "1.2em", 
            transform: showSheetDetails ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s",
            flexShrink: 0
          }}>
            ▼
          </div>
        </div>
        
        {showSheetDetails && (
          <div style={{ marginTop: "15px" }}>
            <p style={{ fontSize: "0.9em", color: "#ccc", marginTop: "0" }}>
              Enter the sharing URL of your Google Sheets document containing the registration data:
            </p>
            
            <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
              <input
                type="text"
                value={sheetsUrl}
                onChange={(e) => setSheetsUrl(e.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/..."
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "4px",
                  border: "1px solid #555",
                  backgroundColor: "#333",
                  color: "#fff"
                }}
                disabled={isLoading || !authStatus}
              />
              <button
                onClick={loadRegistration}
                disabled={isLoading || !authStatus || !sheetsUrl}
                style={{
                  padding: "10px 15px",
                  backgroundColor: "#007BFF",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                {isLoading ? "Loading..." : "Load Data"}
              </button>
            </div>
            
            <div style={{ fontSize: "0.8em", color: "#aaa" }}>
              <p>• Make sure you've shared the Google Sheet with appropriate permissions</p>
              <p>• The URL will be saved in your browser for future use</p>
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <div style={{
          padding: "10px 15px",
          backgroundColor: "#dc3545",
          color: "white",
          borderRadius: "4px",
          marginBottom: "20px"
        }}>
          {error}
        </div>
      )}
      
      {/* Display Options Section */}
      {dataLoaded && (
        <div style={{
          marginBottom: "20px",
          padding: "15px",
          border: "1px solid #333",
          borderRadius: "4px",
          backgroundColor: "#222"
        }}>
          <h2 style={{ marginTop: 0 }}>Display Options</h2>
          
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Filter by Discipline:</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
              <button
                onClick={() => handleDisciplineChange("")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: selectedDiscipline === "" ? "#007BFF" : "#444",
                  color: "white",
                  cursor: "pointer"
                }}
              >
                All Disciplines
              </button>
              {disciplines.map(discipline => (
                <button
                  key={discipline}
                  onClick={() => handleDisciplineChange(discipline)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "none",
                    backgroundColor: selectedDiscipline === discipline ? "#007BFF" : "#444",
                    color: "white",
                    cursor: "pointer"
                  }}
                >
                  {discipline}
                </button>
              ))}
            </div>
          </div>
          
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Filter by Gender:</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => handleGenderChange("all")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: selectedGender === "all" ? "#007BFF" : "#444",
                  color: "white",
                  cursor: "pointer"
                }}
              >
                Mixed
              </button>
              <button
                onClick={() => handleGenderChange("M")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: selectedGender === "M" ? "#007BFF" : "#444",
                  color: "white",
                  cursor: "pointer"
                }}
              >
                Males
              </button>
              <button
                onClick={() => handleGenderChange("F")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: selectedGender === "F" ? "#007BFF" : "#444",
                  color: "white",
                  cursor: "pointer"
                }}
              >
                Females
              </button>
            </div>
          </div>
          
          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px" }}>Filter by Age:</label>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => handleAgePresetChange("all")}
                style={{
                  padding: "8px 12px",
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: selectedAgePreset === "all" ? "#007BFF" : "#444",
                  color: "white",
                  cursor: "pointer"
                }}
              >
                All Ages
              </button>
              {Object.entries(AGE_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handleAgePresetChange(key)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "none",
                    backgroundColor: selectedAgePreset === key ? "#007BFF" : "#444",
                    color: "white",
                    cursor: "pointer"
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            {showCustomAgeControls && (
              <div style={{ 
                marginTop: "10px", 
                padding: "10px", 
                backgroundColor: "#333", 
                borderRadius: "4px",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <label>Minimum Age:</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={customMinAge}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value) || 0;
                      console.log(`Setting minimum age: ${newValue}`);
                      setCustomMinAge(newValue);
                      
                      // Clear any existing timeout
                      if (window.customAgeTimeout) {
                        clearTimeout(window.customAgeTimeout);
                      }
                      
                      // Set a new timeout
                      window.customAgeTimeout = setTimeout(() => {
                        handleCustomAgeChange();
                      }, 500);
                    }}
                    onBlur={() => handleCustomAgeChange()} // Also apply on blur for immediate feedback
                    style={{
                      padding: "6px 10px",
                      backgroundColor: "#444",
                      color: "white",
                      border: "1px solid #555",
                      borderRadius: "4px",
                      width: "70px"
                    }}
                  />
                  
                  <label style={{ marginLeft: "15px" }}>Maximum Age:</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={customMaxAge}
                    onChange={(e) => {
                      const newValue = parseInt(e.target.value) || 0;
                      console.log(`Setting maximum age: ${newValue}`);
                      setCustomMaxAge(newValue);
                      
                      // Clear any existing timeout
                      if (window.customAgeTimeout) {
                        clearTimeout(window.customAgeTimeout);
                      }
                      
                      // Set a new timeout
                      window.customAgeTimeout = setTimeout(() => {
                        handleCustomAgeChange();
                      }, 500);
                    }}
                    onBlur={() => handleCustomAgeChange()} // Also apply on blur for immediate feedback
                    style={{
                      padding: "6px 10px",
                      backgroundColor: "#444",
                      color: "white",
                      border: "1px solid #555",
                      borderRadius: "4px",
                      width: "70px"
                    }}
                  />
                </div>
                
                <div style={{ color: "#aaa", fontSize: "0.85em" }}>
                  This will filter skaters who are (or will be) {customMinAge}-{customMaxAge} years old in {CURRENT_YEAR}
                </div>
              </div>
            )}
          </div>
          
          <div>
            <label style={{ display: "block", marginBottom: "5px" }}>Display Preset:</label>
            <div style={{ display: "flex", gap: "10px" }}>
              {Object.entries(DISPLAY_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => handlePresetChange(key)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "4px",
                    border: "none",
                    backgroundColor: displayPreset === key ? "#007BFF" : "#444",
                    color: "white",
                    cursor: "pointer"
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>
          
          {/* Rankings status indicator */}
          {isLoadingRankings ? (
            <div style={{ marginTop: "15px", fontSize: "0.9em", color: "#FFA500" }}>
              Loading world rankings data...
            </div>
          ) : rankingsError ? (
            <div style={{ marginTop: "15px", fontSize: "0.9em", color: "#dc3545" }}>
              Error loading rankings: {rankingsError}
            </div>
          ) : Object.keys(rankingsData).length > 0 ? (
            <div style={{ marginTop: "15px", fontSize: "0.9em", color: "#4CAF50", display: "flex", alignItems: "center" }}>
              <span style={{ 
                width: "8px", 
                height: "8px", 
                backgroundColor: "#4CAF50", 
                borderRadius: "50%", 
                display: "inline-block",
                marginRight: "8px" 
              }}></span>
              World rankings loaded ({rankingsLatestUpdate}) - {Object.keys(rankingsData).length} disciplines
            </div>
          ) : (
            <div style={{ marginTop: "15px", fontSize: "0.9em", color: "#999" }}>
              No world rankings data available
            </div>
          )}
          
          {/* World Skate database status indicator */}
          {isLoadingSkaterDB ? (
            <div style={{ marginTop: "15px", fontSize: "0.9em", color: "#FFA500" }}>
              Loading World Skate database...
            </div>
          ) : skaterDBError ? (
            <div style={{ marginTop: "15px", fontSize: "0.9em", color: "#dc3545" }}>
              Error loading skater database: {skaterDBError}
            </div>
          ) : skaterDB ? (
            <div style={{ marginTop: "15px", fontSize: "0.9em", color: "#4CAF50", display: "flex", alignItems: "center" }}>
              <span style={{ 
                width: "8px", 
                height: "8px", 
                backgroundColor: "#4CAF50", 
                borderRadius: "50%", 
                display: "inline-block",
                marginRight: "8px" 
              }}></span>
              World Skate database loaded ({skaterDB.uniqueSkatersCount.toLocaleString()} skaters, {skaterDB.totalIdsCount.toLocaleString()} total IDs including previous ones)
            </div>
          ) : (
            <div style={{ marginTop: "15px", fontSize: "0.9em", color: "#999", display: "flex", alignItems: "center" }}>
              <span style={{ 
                width: "8px", 
                height: "8px", 
                backgroundColor: "#999", 
                borderRadius: "50%", 
                display: "inline-block",
                marginRight: "8px" 
              }}></span>
              World Skate database not loaded
              <button
                onClick={() => fetchSkaterDatabase()}
                style={{
                  marginLeft: "10px",
                  padding: "2px 8px",
                  fontSize: "0.9em",
                  backgroundColor: "#6610f2",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Load Database
              </button>
            </div>
          )}
          
          {/* Verification button */}
          {skaterDB && filteredSkaters.length > 0 && (
            <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
              <button
                onClick={handleVerifySkaters}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#6610f2",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Verify IDs & Birth Dates
              </button>
              
              <button
                onClick={async () => {
                  // Force database reload and verification
                  console.log("Force loading database and verifying all skaters");
                  const db = await fetchSkaterDatabase(0, 3); // Fresh load with retries
                  if (db && db.data && db.data.skaters) {
                    console.log("Database force-loaded successfully, verifying skaters");
                    verifySkaters(filteredSkaters, db.idMap);
                  }
                }}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#dc3545",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer"
                }}
              >
                Force Reload & Verify
              </button>
              
              <a 
                href="https://www.worldskate.org/inline-freestyle/athletes.html" 
                target="_blank" 
                rel="noopener noreferrer"
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#007bff",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  fontSize: "0.9em"
                }}
              >
                <span style={{ marginRight: "5px" }}>Official WS Athlete DB</span>
                <span>↗</span>
              </a>
              
              <span style={{ marginLeft: "auto", fontSize: "0.9em", color: "#aaa" }}>
                {Object.keys(verificationResults).length > 0 
                  ? `${Object.values(verificationResults).filter(r => r.verified).length} of ${Object.keys(verificationResults).length} verified`
                  : "Click to verify skaters against World Skate database"}
              </span>
            </div>
          )}
        </div>
      )}
      
      {/* Skaters Table */}
      {dataLoaded && (filteredSkaters.length > 0 ? (
        <div style={{
          marginBottom: "20px",
          padding: "15px",
          border: "1px solid #333",
          borderRadius: "4px",
          backgroundColor: "#222",
          overflowX: "auto"
        }}>
          <div style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center",
            marginBottom: "15px"
          }}>
            <h2 style={{ margin: 0 }}>
              {selectedDiscipline ? selectedDiscipline : "All Disciplines"} - 
              {selectedGender === "all" 
                ? " Mixed Skaters" 
                : selectedGender === "M" 
                  ? " Male Skaters" 
                  : " Female Skaters"}
              {selectedAgePreset !== "all" && selectedAgePreset !== "custom" && 
                ` - ${AGE_PRESETS[selectedAgePreset].name}`}
              {selectedAgePreset === "custom" && 
                ` - Ages ${customMinAge}-${customMaxAge}`}
              ({filteredSkaters.length})
            </h2>
            
            <button
              onClick={copyTableToClipboard}
              style={{
                padding: "8px 12px",
                backgroundColor: copySuccess ? "#4CAF50" : "#007BFF",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "background-color 0.3s"
              }}
            >
              {copySuccess ? "Copied!" : "Copy to Clipboard"}
              <span style={{ fontSize: "1em" }}>
                {copySuccess ? "✓" : "📋"}
              </span>
            </button>
          </div>
          
          {/* Actual table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ 
              borderCollapse: "collapse", 
              marginTop: "15px",
              width: "auto", // Changed from width: "100%" to width: "auto"
              tableLayout: "auto" // Added to make columns size based on content
            }}>
              <thead>
                <tr style={{ backgroundColor: "#222" }}>
                  {/* Verification status column header */}
                  <th style={{ 
                    padding: "6px 0", 
                    textAlign: "center", 
                    width: "30px",
                    minWidth: "30px"
                  }}>
                    <span title="Verification Status">✓</span>
                  </th>
                  
                  {/* Show order column if the preset requires it */}
                  {DISPLAY_PRESETS[displayPreset].showOrder && (
                    <th style={{ 
                      padding: "6px 8px", 
                      textAlign: "left", 
                      whiteSpace: "nowrap", 
                      width: "40px" 
                    }}>
                      Ord
                    </th>
                  )}
                  
                  {/* Generate columns based on the display preset */}
                  {DISPLAY_PRESETS[displayPreset].columns.map(column => {
                    let headerText = column;
                    switch(column) {
                      case "world_skate_id": headerText = "WS ID"; break;
                      case "full_name": headerText = "Name"; break;
                      case "first_name": headerText = "First Name"; break;
                      case "family_name": headerText = "Family Name"; break;
                      case "club": headerText = "Team"; break;
                      case "nationality": headerText = "Ctry"; break;
                      case "world_rank": headerText = "W.Rank"; break;
                      case "bib": headerText = "BIB"; break;
                      case "dob": headerText = "Date of Birth"; break;
                      case "age": headerText = "Age"; break;
                      case "sex": headerText = "Gender"; break;
                      case "disciplines": headerText = "Disciplines"; break;
                      case "email": headerText = "Email"; break;
                      case "phone": headerText = "Phone"; break;
                      default: headerText = column.charAt(0).toUpperCase() + column.slice(1);
                    }
                    
                    const isSortable = ["world_rank", "world_skate_id", "club", "nationality", "full_name", "first_name", "family_name", "age"].includes(column);
                    const isCurrentSortColumn = sortColumn === column;
                    
                    // Define appropriate column widths based on content type
                    let columnWidth = "auto";
                    let minWidth = "auto";
                    switch(column) {
                      case "world_skate_id": minWidth = "180px"; break; // Use min-width to ensure full display
                      case "full_name": minWidth = "200px"; break;
                      case "first_name": minWidth = "140px"; break;
                      case "family_name": minWidth = "140px"; break;
                      case "club": minWidth = "140px"; break;
                      case "nationality": minWidth = "70px"; break;
                      case "world_rank": minWidth = "80px"; break;
                      case "bib": minWidth = "60px"; break;
                      case "dob": minWidth = "110px"; break;
                      case "age": minWidth = "60px"; break;
                      case "sex": minWidth = "90px"; break;
                      case "disciplines": minWidth = "200px"; break;
                      case "email": minWidth = "180px"; break;
                      case "phone": minWidth = "120px"; break;
                    }
                    
                    return (
                      <th 
                        key={column} 
                        onClick={() => isSortable && handleSort(column)}
                        style={{ 
                          padding: "6px 8px", 
                          textAlign: "left", 
                          whiteSpace: column === "disciplines" ? "normal" : "nowrap",
                          cursor: isSortable ? "pointer" : "default",
                          backgroundColor: isCurrentSortColumn ? "#2a2a2a" : "transparent",
                          position: "relative",
                          paddingRight: isSortable ? "20px" : "8px",
                          minWidth: minWidth, // Use min-width instead of width
                          width: "auto" // Let content determine width
                        }}
                      >
                        {headerText}
                        {isSortable && (
                          <span style={{
                            position: "absolute",
                            right: "6px",
                            color: isCurrentSortColumn ? "#fff" : "#777"
                          }}>
                            {isCurrentSortColumn && (
                              column === "world_rank" ? 
                                (sortDirection === "asc" ? "↓" : "↑") :  // For world_rank, arrow points to direction of better ranking
                                (sortDirection === "asc" ? "▲" : "▼")     // For other columns, standard up/down arrows
                            )}
                            {!isCurrentSortColumn && "⋮"}
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredSkaters.map((skater, index) => (
                  <tr key={skater.id || index} style={{ 
                    backgroundColor: index % 2 === 0 ? "#1a1a1a" : "#222",
                    borderBottom: "1px solid #333",
                    position: "relative"
                  }}>
                    {/* Simplified verification status indicator with just an icon at the beginning */}
                    <td style={{ 
                      padding: "6px 0", 
                      textAlign: "center",
                      width: "30px",
                      minWidth: "30px"
                    }}>
                      {(() => {
                        const status = getVerificationStatus(skater);
                        return (
                          <span
                            title={status.tooltip}
                            style={{
                              cursor: "help",
                              fontSize: "1.1em",
                              color: status.color
                            }}
                          >
                            {status.icon}
                          </span>
                        );
                      })()}
                    </td>
                    
                    {/* Order column (if enabled) */}
                    {DISPLAY_PRESETS[displayPreset].showOrder && (
                      <td style={{ 
                        padding: "6px 8px", 
                        textAlign: "center",
                        fontWeight: "bold",
                        width: "40px"
                      }}>
                        {index + 1}
                      </td>
                    )}
                    
                    {/* Regular data columns based on display preset */}
                    {DISPLAY_PRESETS[displayPreset].columns.map((column, colIndex) => {
                      let cellContent = skater[column] || "";
                      
                      // Special case for disciplines array
                      if (column === "disciplines" && Array.isArray(cellContent)) {
                        cellContent = cellContent.join(", ");
                      }
                      
                      // Special case for world_rank (get from rankings)
                      if (column === "world_rank") {
                        const ranking = getSkaterRanking(skater);
                        if (ranking) {
                          cellContent = (
                            <span style={{ fontWeight: "bold", color: "#4CAF50" }}>
                              {ranking.rank}
                            </span>
                          );
                        } else if (skater.world_skate_id) {
                          cellContent = "-"; // Has ID but no ranking
                        } else {
                          cellContent = "N/A"; // No ID
                        }
                      }
                      
                      // Special case for BIB (not assigned yet)
                      if (column === "bib") {
                        cellContent = "";
                      }
                      
                      // Special case for first_name and family_name (split from full_name)
                      if (column === "first_name" && !skater.first_name) {
                        const nameParts = (skater.full_name || "").split(" ");
                        cellContent = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";
                      }
                      
                      if (column === "family_name" && !skater.family_name) {
                        const nameParts = (skater.full_name || "").split(" ");
                        cellContent = nameParts.length > 0 ? nameParts[0] : "";
                      }
                      
                      // Special case for sex (display as "man" or "woman")
                      if (column === "sex") {
                        cellContent = skater.sex === "M" ? "man" : skater.sex === "F" ? "woman" : "";
                      }
                      
                      // Special case for dob (format as DD/MM/YYYY)
                      if (column === "dob" && skater.dob) {
                        try {
                          const date = new Date(skater.dob);
                          if (!isNaN(date.getTime())) {
                            // Format as DD/MM/YYYY
                            const day = date.getDate().toString().padStart(2, '0');
                            const month = (date.getMonth() + 1).toString().padStart(2, '0');
                            const year = date.getFullYear();
                            cellContent = `${day}/${month}/${year}`;
                          }
                        } catch (e) {
                          // Keep original content if parsing fails
                        }
                      }
                      
                      // Special case for age (compute from birth year)
                      if (column === "age") {
                        const birthYear = getBirthYear(skater.dob);
                        if (birthYear) {
                          // Calculate age in current year
                          const ageThisYear = CURRENT_YEAR - birthYear;
                          cellContent = ageThisYear.toString();
                        } else {
                          cellContent = "-";
                        }
                      }
                      
                      // Define appropriate column widths based on content type
                      let columnWidth = "auto";
                      let minWidth = "auto";
                      switch(column) {
                        case "world_skate_id": minWidth = "180px"; break; // Use min-width to ensure full display
                        case "full_name": minWidth = "200px"; break;
                        case "first_name": minWidth = "140px"; break;
                        case "family_name": minWidth = "140px"; break;
                        case "club": minWidth = "140px"; break;
                        case "nationality": minWidth = "70px"; break;
                        case "world_rank": minWidth = "80px"; break;
                        case "bib": minWidth = "60px"; break;
                        case "dob": minWidth = "110px"; break;
                        case "age": minWidth = "60px"; break;
                        case "sex": minWidth = "90px"; break;
                        case "disciplines": minWidth = "200px"; break;
                        case "email": minWidth = "180px"; break;
                        case "phone": minWidth = "120px"; break;
                      }
                      
                      return (
                        <td key={column} style={{ 
                          padding: "6px 8px", 
                          whiteSpace: column === "disciplines" ? "normal" : "nowrap",
                          maxWidth: column === "disciplines" ? "250px" : "none",
                          minWidth: minWidth, // Use min-width instead of fixed width
                          width: "auto", // Let content determine actual width
                          // Remove overflow and textOverflow properties to show complete content
                        }}>
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={{
          marginBottom: "20px",
          padding: "15px",
          border: "1px solid #333",
          borderRadius: "4px",
          backgroundColor: "#222",
          textAlign: "center"
        }}>
          <h2 style={{ margin: 0, color: "#FFA500" }}>No skaters match the current filter criteria</h2>
          <p style={{ color: "#aaa", marginTop: "10px" }}>
            Try adjusting the discipline, gender, or age filters to see more results
          </p>
        </div>
      ))}
    </div>
  );
}

export default RegistrationPage; 