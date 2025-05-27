import React, { useState, useEffect, useRef, useMemo } from 'react';

const API_BASE = "http://localhost:8000";

// Add keyframe animation CSS
const pulseAnimation = `
  @keyframes pulse {
    0% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0.7); }
    70% { box-shadow: 0 0 0 10px rgba(220, 53, 69, 0); }
    100% { box-shadow: 0 0 0 0 rgba(220, 53, 69, 0); }
  }
`;

// Fallback mock data for development
const MOCK_RANKINGS_DATA = {
  latest_date: "2023 June",
  external_latest_date: "2023 July",
  newer_available: true,
  available_disciplines: [
    "classic-men-senior",
    "classic-women-senior",
    "battle-men-senior", 
    "battle-women-senior",
    "speed-men-senior",
    "speed-women-senior",
    "classic-men-junior",
    "classic-women-junior"
  ]
};

// Mock rankings data for individual disciplines
const MOCK_DISCIPLINE_RANKINGS = [
  { rank: 1, name: "John Smith", country: "USA", world_skate_id: "12345", best_points: 320 },
  { rank: 2, name: "Maria Garcia", country: "ESP", world_skate_id: "23456", best_points: 280 },
  { rank: 3, name: "Yuki Tanaka", country: "JPN", world_skate_id: "34567", best_points: 260 },
  { rank: 4, name: "Lucas Mueller", country: "GER", world_skate_id: "45678", best_points: 240 },
  { rank: 5, name: "Sophie Martin", country: "FRA", world_skate_id: "56789", best_points: 220 },
  { rank: 6, name: "Chen Wei", country: "CHN", world_skate_id: "67890", best_points: 200 },
  { rank: 7, name: "Isabella Rossi", country: "ITA", world_skate_id: "78901", best_points: 180 },
  { rank: 8, name: "Alexandre Silva", country: "BRA", world_skate_id: "89012", best_points: 160 },
  { rank: 9, name: "Emma Wilson", country: "GBR", world_skate_id: "90123", best_points: 140 },
  { rank: 10, name: "Park Min-ho", country: "KOR", world_skate_id: "01234", best_points: 120 },
  { rank: 11, name: "Olivia Brown", country: "CAN", world_skate_id: "13579", best_points: 100 },
  { rank: 12, name: "Mateo Rodriguez", country: "ARG", world_skate_id: "24680", best_points: 90 },
  { rank: 13, name: "Ava Johnson", country: "USA", world_skate_id: "13570", best_points: 80 },
  { rank: 14, name: "Noah Williams", country: "AUS", world_skate_id: "24682", best_points: 70 },
  { rank: 15, name: "Mia Jones", country: "NZL", world_skate_id: "35791", best_points: 60 }
];

// Modal component for displaying rankings
const RankingsModal = ({ 
  isOpen, 
  onClose, 
  discipline, 
  rankings, 
  isLoading, 
  error,
  isDarkMode,
  formatDisciplineName,
  worldSkateRankingsUrl
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const modalRef = useRef(null);
  const [tableId, setTableId] = useState(null);
  
  // Define modalStyles within the component scope
  const modalStyles = {
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    modalContent: {
      width: '90%',
      maxWidth: '800px',
      maxHeight: '80vh',
      borderRadius: '8px',
      boxShadow: '0 5px 15px rgba(0, 0, 0, 0.3)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '15px 20px',
      borderBottom: '1px solid #444',
    },
    modalTitle: {
      margin: 0,
      fontSize: '1.5rem',
      fontWeight: '600',
    },
    headerActions: {
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
    },
    worldSkateLink: {
      color: isDarkMode ? '#4dabf7' : '#0d6efd',
      textDecoration: 'none',
      fontSize: '0.9rem',
      padding: '5px 10px',
      border: `1px solid ${isDarkMode ? '#4dabf7' : '#0d6efd'}`,
      borderRadius: '4px',
      transition: 'all 0.2s ease',
    },
    closeButton: {
      background: 'none',
      border: 'none',
      fontSize: '1.8rem',
      cursor: 'pointer',
      color: '#adb5bd',
      lineHeight: '1',
    },
    searchContainer: {
      padding: '15px 20px',
      borderBottom: '1px solid #444',
    },
    searchInput: {
      width: '100%',
      padding: '8px 12px',
      fontSize: '1rem',
      borderRadius: '4px',
      border: '1px solid #555',
      boxSizing: 'border-box',
    },
    tableContainer: {
      overflowY: 'auto',
      padding: '0 20px 20px',
      flex: '1',
    },
    rankingsTable: {
      width: '100%',
      borderCollapse: 'collapse',
      marginTop: '10px',
    },
    tableHeader: {
      textAlign: 'left',
      padding: '10px 15px',
      borderBottom: '2px solid #444',
      position: 'sticky',
      top: 0,
      background: isDarkMode ? '#333' : '#fff',
    },
    tableRow: {
      borderBottom: '1px solid #444',
    },
    tableCell: {
      padding: '8px 15px',
    },
    modalLoading: {
      padding: '20px',
      textAlign: 'center',
      fontStyle: 'italic',
      color: '#adb5bd',
    },
    modalError: {
      padding: '20px',
      textAlign: 'center',
      color: '#dc3545',
      backgroundColor: 'rgba(220, 53, 69, 0.1)',
      margin: '20px',
      borderRadius: '4px',
    },
    emptyTableMessage: {
      textAlign: 'center',
      padding: '20px',
      color: '#adb5bd',
      fontStyle: 'italic',
    }
  };
  
  // Sort and filter the rankings
  const filteredRankings = useMemo(() => {
    if (!rankings) return [];
    
    // Convert rankings to a new array for sorting
    const sortedRankings = [...rankings];
    
    // Sort by rank (convert to number for proper sorting)
    sortedRankings.sort((a, b) => {
      const rankA = parseInt(a.rank, 10) || Number.MAX_SAFE_INTEGER;
      const rankB = parseInt(b.rank, 10) || Number.MAX_SAFE_INTEGER;
      return rankA - rankB;
    });
    
    // Filter by search term
    if (!searchTerm) return sortedRankings;
    
    const term = searchTerm.toLowerCase();
    return sortedRankings.filter(
      skater => 
        skater.name?.toLowerCase().includes(term) || 
        skater.country?.toLowerCase().includes(term)
    );
  }, [rankings, searchTerm]);
  
  // Close modal when clicking outside
  const handleClickOutside = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      onClose();
    }
  };
  
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);
  
  // Reset search when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);
  
  // Add keyboard event handler for ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);
  
  // Function to get table ID from discipline name
  const getTableId = async (discipline) => {
    try {
      const response = await fetch(`${API_BASE}/api/rankings/table-metadata`);
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = await response.json();
      
      // Extract discipline type, sex, and age from the discipline name
      const parts = discipline.split('-');
      const disciplineType = parts[0];
      const sex = parts[1];
      const age = parts[2];
      
      // Find matching table in metadata
      const table = data.tables.find(t => 
        t.discipline === disciplineType && 
        t.sex === sex && 
        t.age === age
      );
      
      if (table) {
        setTableId(table.table_id);
      }
    } catch (err) {
      console.error('Error fetching table metadata:', err);
    }
  };

  // Fetch table ID when discipline changes
  useEffect(() => {
    if (discipline) {
      getTableId(discipline);
    }
  }, [discipline]);
  
  if (!isOpen) return null;
  
  return (
    <div style={modalStyles.modalOverlay} onClick={handleClickOutside}>
      <div 
        ref={modalRef}
        style={{
          ...modalStyles.modalContent,
          background: isDarkMode ? '#333' : '#fff',
          color: isDarkMode ? '#f8f9fa' : '#333'
        }}
      >
        <div style={modalStyles.modalHeader}>
          <h2 style={modalStyles.modalTitle}>
            {formatDisciplineName(discipline)}
          </h2>
          <div style={modalStyles.headerActions}>
            <a 
              href={`${worldSkateRankingsUrl}#${tableId || ''}`}
              target="_blank"
              rel="noopener noreferrer"
              style={modalStyles.worldSkateLink}
            >
              View on World Skate
            </a>
            <button 
              onClick={onClose}
              style={modalStyles.closeButton}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>
        
        <div style={modalStyles.searchContainer}>
          <input
            type="text"
            placeholder="Search by name or country..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              ...modalStyles.searchInput,
              background: isDarkMode ? '#444' : '#f8f9fa',
              color: isDarkMode ? '#f8f9fa' : '#333',
              borderColor: isDarkMode ? '#555' : '#dee2e6'
            }}
          />
        </div>
        
        {isLoading ? (
          <div style={modalStyles.modalLoading}>Loading rankings data...</div>
        ) : error ? (
          <div style={modalStyles.modalError}>{error}</div>
        ) : (
          <div style={modalStyles.tableContainer}>
            <table style={modalStyles.rankingsTable}>
              <thead>
                <tr>
                  <th style={modalStyles.tableHeader}>Rank</th>
                  <th style={modalStyles.tableHeader}>Name</th>
                  <th style={modalStyles.tableHeader}>Country</th>
                  <th style={modalStyles.tableHeader}>ID</th>
                  <th style={modalStyles.tableHeader}>Best</th>
                </tr>
              </thead>
              <tbody>
                {filteredRankings?.length > 0 ? (
                  filteredRankings.map((skater) => (
                    <tr key={skater.world_skate_id || `rank-${skater.rank}`} style={modalStyles.tableRow}>
                      <td style={modalStyles.tableCell}>{skater.rank || '-'}</td>
                      <td style={modalStyles.tableCell}>{skater.name || '-'}</td>
                      <td style={modalStyles.tableCell}>{skater.country || '-'}</td>
                      <td style={modalStyles.tableCell}>{skater.world_skate_id || '-'}</td>
                      <td style={modalStyles.tableCell}>{skater.best_points || '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" style={modalStyles.emptyTableMessage}>
                      {searchTerm 
                        ? "No skaters match your search" 
                        : "No ranking data available"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

const RankingsPage = () => {
  const [rankingsInfo, setRankingsInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState({ completed: 0, total: 0, current_discipline: null });
  const [appStyles, setAppStyles] = useState({
    backgroundColor: '#333',
    textColor: '#f8f9fa',
    fontFamily: 'Arial, sans-serif'
  });
  
  // State for handling modal and discipline rankings
  const [selectedDiscipline, setSelectedDiscipline] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [disciplineRankings, setDisciplineRankings] = useState([]);
  const [loadingRankings, setLoadingRankings] = useState(false);
  const [rankingsError, setRankingsError] = useState(null);
  const [worldSkateRankingsUrl, setWorldSkateRankingsUrl] = useState("https://app-69b8883b-99d4-4935-9b2b-704880862424.cleverapps.io");

  // Add state variables for skater DB download
  const [isDownloadingSkaterDB, setIsDownloadingSkaterDB] = useState(false);
  const [skaterDBProgress, setSkaterDBProgress] = useState({ total_skaters: 0, downloaded_skaters: 0, is_complete: false });

  // Add state variables for skater DB info
  const [skaterDBInfo, setSkaterDBInfo] = useState({ exists: false, count: 0, last_updated: null });
  
  // Add state for the full skater database
  const [fullSkaterDB, setFullSkaterDB] = useState(null);
  const [loadingFullDB, setLoadingFullDB] = useState(false);

  // Handle card click to open modal with rankings
  const handleDisciplineClick = (discipline) => {
    setSelectedDiscipline(discipline);
    setIsModalOpen(true);
    fetchDisciplineRankings(discipline);
  };
  
  // Close the rankings modal
  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDiscipline(null);
  };
  
  // Fetch rankings data for a specific discipline
  const fetchDisciplineRankings = async (discipline) => {
    setLoadingRankings(true);
    setRankingsError(null);
    
    try {
      // Use the real API endpoint
      const response = await fetch(`${API_BASE}/api/rankings/${discipline}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`HTTP error ${response.status}`);
      }
      
      const data = await response.json();
      setDisciplineRankings(data.rankings || []);
    } catch (err) {
      console.error('Error fetching discipline rankings:', err);
      setRankingsError('Failed to load rankings. Please try again.');
      
      // Fallback to mock data in development or if API fails
      if (process.env.NODE_ENV === 'development') {
        console.warn('Using mock data as fallback');
        setDisciplineRankings(MOCK_DISCIPLINE_RANKINGS);
      }
    } finally {
      setLoadingRankings(false);
    }
  };

  // Add the pulse animation CSS
  useEffect(() => {
    const styleEl = document.createElement('style');
    styleEl.textContent = pulseAnimation;
    document.head.appendChild(styleEl);
    
    // Cleanup when component unmounts
    return () => {
      if (styleEl && document.head.contains(styleEl)) {
        document.head.removeChild(styleEl);
      }
    };
  }, []);

  // Load application style configuration
  useEffect(() => {
    // Fetch config from backend
    console.log("Fetching config from:", `${API_BASE}/config`);
    fetch(`${API_BASE}/config`)
      .then(r => {
        console.log("Config response:", r);
        return r.json();
      })
      .then(data => {
        console.log("Config data:", data);
        const s = data.style;
        
        // Apply styles to both state and body
        setAppStyles({
          backgroundColor: s.backgroundColor || '#333',
          textColor: s.textColor || '#f8f9fa',
          fontFamily: s.fontFamily || 'Arial, sans-serif'
        });
        
        // Apply to body
        document.body.style.fontFamily = s.fontFamily;
        document.body.style.color = s.textColor;
        document.body.style.backgroundColor = s.backgroundColor;
        
        // Set World Skate rankings URL
        if (data.worldSkateRankingsUrl) {
          setWorldSkateRankingsUrl(data.worldSkateRankingsUrl);
        }
      })
      .catch(error => {
        console.error("Error fetching config:", error);
        // Keep default values in state
      });
  }, []);

  // Function to fetch rankings info with fallback to mock data
  const fetchRankingsInfo = async () => {
    try {
      setLoading(true);
      console.log('Fetching rankings info from:', `${API_BASE}/api/rankings/info`);
      
      try {
        const response = await fetch(`${API_BASE}/api/rankings/info`);
        console.log('Response status:', response.status);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.log('Error response text:', errorText);
          throw new Error(`HTTP error ${response.status}`);
        }
        
        const text = await response.text();
        console.log('Response text preview:', text.substring(0, 100));
        
        try {
          const data = JSON.parse(text);
          setRankingsInfo(data);
          setError(null);
        } catch (parseErr) {
          console.error('JSON parse error:', parseErr);
          throw new Error(`Invalid JSON response: ${parseErr.message}`);
        }
      } catch (fetchErr) {
        console.warn('API fetch failed, using mock data:', fetchErr);
        // Use mock data as fallback
        setRankingsInfo(MOCK_RANKINGS_DATA);
        setError("Using mock data (API endpoint not available)");
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(`Failed to fetch rankings info: ${err.message}`);
      // Ensure we still have data to display even if there's an error
      if (!rankingsInfo) {
        setRankingsInfo(MOCK_RANKINGS_DATA);
      }
    } finally {
      setLoading(false);
    }
  };

  // Function to update rankings
  const updateRankings = async () => {
    try {
      setIsUpdating(true);
      setUpdateProgress({ completed: 0, total: 0, current_discipline: null });
      
      // Start the progress indicator
      const progressInterval = setInterval(async () => {
        try {
          const progressResponse = await fetch(`${API_BASE}/api/rankings/progress`);
          const progressData = await progressResponse.json();
          
          if (progressData.is_complete) {
            clearInterval(progressInterval);
            setUpdateProgress({ 
              completed: progressData.total_disciplines, 
              total: progressData.total_disciplines,
              current_discipline: null 
            });
            fetchRankingsInfo();
            setIsUpdating(false);
          } else if (progressData.total_disciplines > 0) {
            setUpdateProgress({
              completed: progressData.completed_disciplines,
              total: progressData.total_disciplines,
              current_discipline: progressData.current_discipline
            });
          }
        } catch (err) {
          console.error('Error fetching progress:', err);
        }
      }, 1000);

      const response = await fetch(`${API_BASE}/api/rankings/update`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      // Safety timeout after 40 seconds
      setTimeout(() => {
        clearInterval(progressInterval);
        fetchRankingsInfo();
        setIsUpdating(false);
      }, 40000);

    } catch (err) {
      setError(`Failed to update rankings: ${err.message}`);
      setIsUpdating(false);
    }
  };

  // Function to download rankings as a zip file
  const downloadRankingsZip = () => {
    // Redirect the browser to the download endpoint
    window.location.href = `${API_BASE}/api/rankings/download-zip`;
  };

  // Function to fetch skater database info with retries
  const fetchSkaterDBInfo = async (retries = 3) => {
    try {
      console.log("Fetching skater database info...");
      const response = await fetch(`${API_BASE}/api/skater-db/info`);
      
      if (!response.ok) {
        console.error(`Error fetching skater DB info: ${response.status} ${response.statusText}`);
        if (retries > 0) {
          console.log(`Retrying (${retries} attempts left)...`);
          setTimeout(() => fetchSkaterDBInfo(retries - 1), 1000);
        }
        return;
      }
      
      const data = await response.json();
      console.log("Received skater DB info:", data);
      setSkaterDBInfo(data);
    } catch (err) {
      console.error('Error fetching skater DB info:', err);
      if (retries > 0) {
        console.log(`Retrying after error (${retries} attempts left)...`);
        setTimeout(() => fetchSkaterDBInfo(retries - 1), 1000);
      }
    }
  };

  // Function to test skater database info
  const testSkaterDBInfo = async () => {
    try {
      console.log("Testing skater database info...");
      const response = await fetch(`${API_BASE}/api/skater-db/info-test`);
      
      if (!response.ok) {
        console.error(`Error in test endpoint: ${response.status} ${response.statusText}`);
        return;
      }
      
      const data = await response.json();
      console.log("Test endpoint response:", data);
      
      // If we get valid data, update the UI
      if (data.exists && (data.total_skaters > 0 || data.skaters_array_length > 0)) {
        setSkaterDBInfo({
          exists: true,
          count: data.total_skaters || data.skaters_array_length,
          last_updated: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Error testing skater DB info:', err);
    }
  };

  // Function to fetch the full skater database
  const fetchFullSkaterDB = async () => {
    try {
      console.log("Fetching full skater database...");
      setLoadingFullDB(true);
      
      const response = await fetch(`${API_BASE}/api/skater-db/data`);
      
      if (!response.ok) {
        console.error(`Error fetching full skater DB: ${response.status} ${response.statusText}`);
        setLoadingFullDB(false);
        return;
      }
      
      const data = await response.json();
      console.log(`Successfully fetched full skater database with ${data.skaters ? data.skaters.length : 0} skaters`);
      
      // Store the data in state
      setFullSkaterDB(data);
      setLoadingFullDB(false);
      
      return data;
    } catch (err) {
      console.error('Error fetching full skater database:', err);
      setLoadingFullDB(false);
    }
  };

  // Function to format date and time
  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    
    try {
      const date = new Date(isoString);
      return date.toLocaleString();
    } catch (e) {
      return isoString;
    }
  };

  // Function to start downloading the skater database
  const downloadSkaterDatabase = async () => {
    try {
      setIsDownloadingSkaterDB(true);
      setSkaterDBProgress({ total_skaters: 0, downloaded_skaters: 0, is_complete: false });
      
      // Call the API to start the download
      const response = await fetch(`${API_BASE}/api/skater-db/update`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      
      console.log("Skater database download started");
      
      // Start the progress indicator
      const progressInterval = setInterval(async () => {
        try {
          const progressResponse = await fetch(`${API_BASE}/api/skater-db/progress`);
          if (!progressResponse.ok) {
            console.error(`Progress API error: ${progressResponse.status}`);
            return;
          }
          
          const progressData = await progressResponse.json();
          console.log("Progress data:", progressData);
          
          // Update progress state
          setSkaterDBProgress(progressData);
          
          // Check if download is complete
          if (progressData.is_complete === true) {
            console.log("Skater database download complete!");
            clearInterval(progressInterval);
            setIsDownloadingSkaterDB(false);
            
            // Try multiple approaches to refresh the DB info
            console.log("Refreshing skater database info after download...");
            
            // Approach 1: Wait a moment then use the regular info endpoint 
            setTimeout(() => {
              fetchSkaterDBInfo(3); // Try up to 3 times
            }, 1000);
            
            // Approach 2: Try the test endpoint after a slightly longer delay
            setTimeout(() => {
              testSkaterDBInfo();
            }, 2000);
          }
        } catch (err) {
          console.error('Error fetching skater DB progress:', err);
        }
      }, 1000);

      // Safety timeout after 5 minutes
      setTimeout(() => {
        console.log("Safety timeout reached - stopping progress tracking");
        clearInterval(progressInterval);
        setIsDownloadingSkaterDB(false);
        // Fetch updated skater DB info even after timeout
        fetchSkaterDBInfo(3);
        setTimeout(testSkaterDBInfo, 1000);
      }, 300000); // 5 minutes

    } catch (err) {
      console.error("Error downloading skater database:", err);
      setError(`Failed to download skater database: ${err.message}`);
      setIsDownloadingSkaterDB(false);
    }
  };

  // Function to download the skater database file
  const downloadSkaterDatabaseFile = () => {
    // Redirect the browser to the download endpoint
    window.location.href = `${API_BASE}/api/skater-db/download`;
  };

  // Initial data fetch
  useEffect(() => {
    fetchRankingsInfo();
    fetchSkaterDBInfo();
  }, []);

  // Check if a newer version is available
  const newerVersionAvailable = rankingsInfo?.newer_available;

  // Group disciplines by category
  const groupDisciplines = (disciplines) => {
    // First group by discipline type (Battle, Classic, Speed, etc.)
    const disciplineGroups = {};
    
    disciplines.forEach(discipline => {
      const parts = discipline.split('-');
      if (parts.length >= 3) {
        const type = parts[0]; // classic, battle, etc.
        const gender = parts[1]; // men, women
        const age = parts[2]; // senior, junior
        
        // Initialize the discipline group if it doesn't exist
        if (!disciplineGroups[type]) {
          disciplineGroups[type] = {
            type,
            subgroups: {}
          };
        }
        
        // Create a key for the gender-age subgroup
        const subgroupKey = `${gender}-${age}`;
        
        // Initialize the subgroup if it doesn't exist
        if (!disciplineGroups[type].subgroups[subgroupKey]) {
          disciplineGroups[type].subgroups[subgroupKey] = {
            gender,
            age,
            disciplines: []
          };
        }
        
        // Add the discipline to the appropriate subgroup
        disciplineGroups[type].subgroups[subgroupKey].disciplines.push(discipline);
      } else {
        // Handle irregular format
        const type = 'other';
        if (!disciplineGroups[type]) {
          disciplineGroups[type] = {
            type,
            subgroups: {
              'other': {
                gender: '',
                age: '',
                disciplines: []
              }
            }
          };
        }
        disciplineGroups[type].subgroups['other'].disciplines.push(discipline);
      }
    });
    
    return disciplineGroups;
  };

  const disciplineGroups = rankingsInfo?.available_disciplines 
    ? groupDisciplines(rankingsInfo.available_disciplines) 
    : {};

  // Helper function to format discipline name for display
  const formatDisciplineName = (name) => {
    if (!name) return '';
    const parts = name.split('-');
    if (parts.length >= 3) {
      // Capitalize each part
      const formattedParts = parts.map(part => 
        part.charAt(0).toUpperCase() + part.slice(1)
      );
      return formattedParts.join(' ');
    }
    return name;
  };

  // Helper function to create a group title from a discipline group
  const formatGroupTitle = (gender, age, type) => {
    const typeFormatted = type.charAt(0).toUpperCase() + type.slice(1);
    
    // Use abbreviations for age and gender
    let ageAbbrev = age === 'junior' ? 'JR' : 'SR';
    let genderAbbrev = gender === 'men' ? 'M' : 'W';
    
    // Format: "Type AgeGender" (e.g., "Classic SRM", "Battle JRW")
    return `${typeFormatted} ${ageAbbrev}${genderAbbrev}`;
  };
  
  // Get gender-specific style (color)
  const getGenderStyle = (gender) => {
    if (gender === 'men') {
      return { 
        color: '#4dabf7',  // Blue for men
        fontWeight: '500'
      }; 
    } else if (gender === 'women') {
      return { 
        color: '#f783ac',  // Pink for women
        fontWeight: '500'
      }; 
    }
    return {}; // Default - no special styling
  };
  
  // Get age category indicator
  const getAgeIndicator = (age) => {
    if (age === 'junior') {
      return '🌱 '; // Seedling for juniors (growth/development)
    } else if (age === 'senior') {
      return '🎓 '; // Graduation cap for seniors (achievement/experience)
    }
    return '';
  };
  
  // Extract additional information from discipline name that isn't in the group title
  const getUniqueInfo = (discipline, type, gender, age) => {
    const parts = discipline.split('-');
    const typeFormatted = type.charAt(0).toUpperCase() + type.slice(1);
    
    // Use abbreviations for age and gender
    let ageAbbrev = age === 'junior' ? 'JR' : 'SR';
    let genderAbbrev = gender === 'men' ? 'M' : 'W';
    
    // If there are additional parts beyond type, gender, and age, display those
    if (parts.length > 3) {
      const additionalInfo = parts.slice(3).map(part => 
        part.charAt(0).toUpperCase() + part.slice(1)
      ).join(' ');
      return `${typeFormatted} ${ageAbbrev}${genderAbbrev} - ${additionalInfo}`;
    }
    
    // Check if there's some variation in the basic parts
    const baseParts = parts.slice(0, 3);
    if (baseParts[0] !== type || baseParts[1] !== gender || baseParts[2] !== age) {
      return formatDisciplineName(discipline);
    }
    
    // Even if no unique info, return the discipline type with abbreviations
    return `${typeFormatted} ${ageAbbrev}${genderAbbrev}`;
  };

  // Helper function to determine if a color is dark
  const isDarkColor = (color) => {
    // Default to true if color is undefined or not a string
    if (!color || typeof color !== 'string') return true;
    
    // Simple check for hex colors or known dark color names
    if (color.startsWith('#')) {
      // Remove the # if present
      const hex = color.substring(1);
      
      // Convert hex to RGB
      const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.substring(0, 2), 16);
      const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.substring(2, 4), 16);
      const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.substring(4, 6), 16);
      
      // Calculate luminance (perceived brightness)
      // Using the formula: 0.299*R + 0.587*G + 0.114*B
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      
      // Return true if the color is dark (luminance < 0.5)
      return luminance < 0.5;
    }
    
    // For named colors, check if they are dark
    const darkColors = ['black', 'darkblue', 'darkgreen', 'darkred', 'navy', 'purple', 'darkgrey'];
    return darkColors.includes(color.toLowerCase()) || color.toLowerCase().includes('dark');
  };

  // Dynamically create styles based on app theme
  const styles = {
    container: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: appStyles.fontFamily,
      color: appStyles.textColor,
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      padding: '10px 0',
      borderBottom: `1px solid ${isDarkColor(appStyles.backgroundColor) ? '#555' : '#eaeaea'}`,
    },
    headerTitle: {
      margin: 0,
      fontSize: '1.8rem',
      fontWeight: '600',
      color: appStyles.textColor,
    },
    backButton: {
      display: 'flex',
      alignItems: 'center',
      padding: '8px 15px',
      background: isDarkColor(appStyles.backgroundColor) ? '#555' : '#f8f9fa',
      border: `1px solid ${isDarkColor(appStyles.backgroundColor) ? '#666' : '#dee2e6'}`,
      borderRadius: '4px',
      color: isDarkColor(appStyles.backgroundColor) ? '#f8f9fa' : '#495057',
      cursor: 'pointer',
      fontSize: '0.9rem',
      transition: 'all 0.2s ease',
    },
    rankingsContainer: {
      marginTop: '20px',
    },
    card: {
      background: isDarkColor(appStyles.backgroundColor) ? '#3a3a3a' : '#ffffff',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
      padding: '15px',
      marginBottom: '25px',
      color: isDarkColor(appStyles.backgroundColor) ? '#f8f9fa' : '#333',
      overflow: 'hidden'
    },
    cardTitle: {
      fontSize: '1.3rem',
      fontWeight: '600',
      marginTop: 0,
      marginBottom: '12px',
      color: isDarkColor(appStyles.backgroundColor) ? '#f8f9fa' : '#333',
      borderBottom: `1px solid ${isDarkColor(appStyles.backgroundColor) ? '#555' : '#eee'}`,
      paddingBottom: '6px',
    },
    statusInfo: {
      marginBottom: '15px',
    },
    statusLine: {
      fontSize: '1rem',
      margin: '6px 0',
      color: isDarkColor(appStyles.backgroundColor) ? '#f8f9fa' : '#333',
    },
    actionButtons: {
      marginTop: '15px',
      display: 'flex',
    },
    button: {
      padding: '10px 16px',
      borderRadius: '4px',
      border: 'none',
      cursor: 'pointer',
      fontWeight: '500',
      fontSize: '0.95rem',
      background: '#007bff',
      color: 'white',
      transition: 'background-color 0.3s ease',
    },
    updateNeeded: {
      background: '#dc3545',
      animation: 'pulse 2s infinite',
      boxShadow: '0 0 0 0 rgba(220, 53, 69, 0.7)'
    },
    newerAvailable: {
      color: '#dc3545',
      fontWeight: 'bold'
    },
    updateProgress: {
      flex: 1
    },
    progressBar: {
      width: '100%',
      height: '20px',
      background: isDarkColor(appStyles.backgroundColor) ? '#333' : '#e9ecef',
      borderRadius: '10px',
      overflow: 'hidden',
      marginBottom: '10px',
      border: '1px solid #ccc'
    },
    progressBarFill: {
      height: '100%',
      background: '#007bff',
      transition: 'width 0.5s ease',
      minWidth: '5px'  // Ensure there's at least some visible bar
    },
    progressText: {
      fontSize: '0.95rem',
      color: isDarkColor(appStyles.backgroundColor) ? '#f8f9fa' : '#333',
      margin: '5px 0',
    },
    note: {
      fontSize: '0.8rem',
      color: isDarkColor(appStyles.backgroundColor) ? '#adb5bd' : '#6c757d',
      marginTop: '5px'
    },
    loading: {
      padding: '20px',
      textAlign: 'center',
      fontStyle: 'italic',
      background: isDarkColor(appStyles.backgroundColor) ? '#3a3a3a' : '#ffffff',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
      color: isDarkColor(appStyles.backgroundColor) ? '#f8f9fa' : '#333',
    },
    error: {
      padding: '20px',
      textAlign: 'center',
      background: isDarkColor(appStyles.backgroundColor) ? '#442a2d' : '#fff3f5',
      color: '#dc3545',
      borderRadius: '8px',
      marginBottom: '20px',
      border: '1px solid #dc3545',
    },
    emptyMessage: {
      fontStyle: 'italic',
      color: isDarkColor(appStyles.backgroundColor) ? '#adb5bd' : '#6c757d',
      textAlign: 'center',
      padding: '20px',
    },
    disciplinesSections: {
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      width: '100%',
      maxWidth: '100%',
    },
    disciplineTypeSection: {
      width: '100%',
      background: isDarkColor(appStyles.backgroundColor) ? '#3a3a3a' : '#f8f9fa',
      padding: '10px 15px',
      borderRadius: '6px',
      border: `1px solid ${isDarkColor(appStyles.backgroundColor) ? '#555' : '#eaeaea'}`,
      color: isDarkColor(appStyles.backgroundColor) ? '#f8f9fa' : '#333',
      boxSizing: 'border-box',
      marginBottom: '5px',
    },
    disciplineTypeTitle: {
      fontSize: '1.1rem',
      fontWeight: '600',
      marginTop: 0,
      marginBottom: '10px',
      color: isDarkColor(appStyles.backgroundColor) ? '#f8f9fa' : '#333',
      borderBottom: `1px solid ${isDarkColor(appStyles.backgroundColor) ? '#555' : '#eaeaea'}`,
      paddingBottom: '5px',
    },
    disciplinesGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '8px',
      width: '100%',
    },
    disciplineGroup: {
      background: isDarkColor(appStyles.backgroundColor) ? '#444' : '#ffffff',
      borderRadius: '6px',
      boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
      padding: '10px',
      color: isDarkColor(appStyles.backgroundColor) ? '#f8f9fa' : '#333',
      wordBreak: 'break-word',
    },
    groupTitle: {
      fontSize: '1rem',
      fontWeight: '600',
      marginTop: 0,
      marginBottom: '6px',
      color: isDarkColor(appStyles.backgroundColor) ? '#f8f9fa' : '#333',
    },
    disciplineList: {
      listStyle: 'none',
      padding: 0,
      margin: '6px 0 0 0'
    },
    disciplineItem: {
      padding: '4px 0',
      borderBottom: `1px solid ${isDarkColor(appStyles.backgroundColor) ? '#555' : '#eee'}`,
      fontSize: '0.9rem',
      color: isDarkColor(appStyles.backgroundColor) ? '#f8f9fa' : '#495057',
    },
    subtleText: {
      fontStyle: 'italic',
      color: isDarkColor(appStyles.backgroundColor) ? '#adb5bd' : '#6c757d',
      fontSize: '0.9rem',
    },
    clickableNote: {
      fontSize: '0.9rem',
      fontStyle: 'italic',
      marginBottom: '15px',
      color: isDarkColor(appStyles.backgroundColor) ? '#adb5bd' : '#6c757d',
    },
  };

  return (
    <div className="container" style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>World Rankings Management</h1>
        <button 
          onClick={() => window.location.href = "/operator"}
          style={styles.backButton}
        >
          Back to Operator Console
        </button>
      </div>
      
      <div style={styles.rankingsContainer}>
        {loading ? (
          <div style={styles.loading}>Loading rankings information...</div>
        ) : (
          <>
            {error && (
              <div style={styles.error}>{error}</div>
            )}
            
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>Rankings Status</h2>
              <div style={styles.statusInfo}>
                <p style={styles.statusLine}>
                  <strong>Current Local Rankings:</strong> {rankingsInfo?.latest_date || 'Not downloaded yet'}
                </p>
                <p style={styles.statusLine}>
                  <strong>Latest Available Rankings:</strong> {rankingsInfo?.external_latest_date || 'Unknown'} 
                  {newerVersionAvailable && (
                    <span style={styles.newerAvailable}> (Newer version available!)</span>
                  )}
                </p>
                
                <div style={styles.actionButtons}>
                  {isUpdating ? (
                    <div style={styles.updateProgress}>
                      <div style={styles.progressBar}>
                        <div 
                          style={{
                            ...styles.progressBarFill, 
                            width: typeof updateProgress === 'number' 
                              ? `${updateProgress}%` 
                              : `${(updateProgress.completed / updateProgress.total) * 100}%`
                          }}
                        ></div>
                      </div>
                      <p style={styles.progressText}>
                        {typeof updateProgress === 'number' 
                          ? `Downloading table ${updateProgress} of ${updateProgress}`
                          : `Downloading table ${updateProgress.completed} of ${updateProgress.total}: ${updateProgress.current_discipline || '...'}`
                        }
                      </p>
                      <p style={styles.note}>This process may take up to 30 seconds.</p>
                    </div>
                  ) : (
                    <>
                      <button 
                        onClick={updateRankings}
                        disabled={isUpdating}
                        style={newerVersionAvailable ? {...styles.button, ...styles.updateNeeded} : styles.button}
                      >
                        {newerVersionAvailable 
                          ? `Update to ${rankingsInfo?.external_latest_date}` 
                          : rankingsInfo?.latest_date 
                            ? "Check for Updates" 
                            : "Download Rankings"
                        }
                      </button>
                      
                      {rankingsInfo?.latest_date && (
                        <button 
                          onClick={downloadRankingsZip}
                          disabled={isUpdating}
                          style={{
                            ...styles.button, 
                            marginLeft: '10px',
                            background: '#28a745' // Green color for download button
                          }}
                        >
                          Download CSV (zipped)
                        </button>
                      )}
                    </>
                  )}
                </div>
                
                {/* Skater Database Section */}
                <div style={{marginTop: '20px', borderTop: `1px solid ${isDarkColor(appStyles.backgroundColor) ? '#555' : '#eee'}`, paddingTop: '15px'}}>
                  <h3 style={{fontSize: '1.1rem', marginTop: 0, marginBottom: '10px'}}>Skater Database</h3>
                  
                  {/* Database stats */}
                  <div style={{marginBottom: '15px'}}>
                    <p style={{...styles.statusLine, fontSize: '0.95rem'}}>
                      <strong>Total Skaters:</strong> {skaterDBInfo.count.toLocaleString() || '0'}
                    </p>
                    <p style={{...styles.statusLine, fontSize: '0.95rem'}}>
                      <strong>Last Updated:</strong> {formatDateTime(skaterDBInfo.last_updated)}
                    </p>
                    {fullSkaterDB && (
                      <p style={{...styles.statusLine, fontSize: '0.95rem', color: '#28a745'}}>
                        <strong>Database loaded for registration verification</strong>
                      </p>
                    )}
                  </div>
                  
                  {isDownloadingSkaterDB ? (
                    <div style={styles.updateProgress}>
                      <div style={styles.progressBar}>
                        <div 
                          style={{
                            ...styles.progressBarFill, 
                            width: skaterDBProgress.total_skaters > 0 
                              ? `${Math.min(100, Math.round((skaterDBProgress.downloaded_skaters / skaterDBProgress.total_skaters) * 100))}%` 
                              : '5%'  // Show minimal width when starting
                          }}
                        ></div>
                      </div>
                      <p style={styles.progressText}>
                        {skaterDBProgress.total_skaters > 0 
                          ? `Downloading ${skaterDBProgress.downloaded_skaters} of ${skaterDBProgress.total_skaters} skaters (${Math.round((skaterDBProgress.downloaded_skaters / skaterDBProgress.total_skaters) * 100)}%)` 
                          : "Preparing download..."
                        }
                      </p>
                      <p style={styles.note}>This process may take 2-3 minutes to complete.</p>
                    </div>
                  ) : (
                    <div style={styles.actionButtons}>
                      <button 
                        onClick={downloadSkaterDatabase}
                        disabled={isDownloadingSkaterDB || isUpdating}
                        style={{
                          ...styles.button,
                          background: '#6c757d' // Gray color for skater DB download button
                        }}
                      >
                        Update Skater Database
                      </button>
                      
                      <button 
                        onClick={downloadSkaterDatabaseFile}
                        style={{
                          ...styles.button, 
                          marginLeft: '10px',
                          background: '#17a2b8', // Info color for download
                          opacity: isDownloadingSkaterDB ? 0.6 : 1,
                          cursor: isDownloadingSkaterDB ? 'not-allowed' : 'pointer'
                        }}
                        disabled={isDownloadingSkaterDB}
                      >
                        Download Skater Database
                      </button>
                      
                      <button 
                        onClick={fetchFullSkaterDB}
                        style={{
                          ...styles.button, 
                          marginLeft: '10px',
                          background: '#6610f2', // Purple color for special action
                          opacity: (isDownloadingSkaterDB || loadingFullDB) ? 0.6 : 1,
                          cursor: (isDownloadingSkaterDB || loadingFullDB) ? 'not-allowed' : 'pointer'
                        }}
                        disabled={isDownloadingSkaterDB || loadingFullDB}
                      >
                        {loadingFullDB ? 'Loading...' : fullSkaterDB ? 'Reload Database' : 'Load for Registration Verification'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {rankingsInfo?.latest_date && (
              <div style={styles.card}>
                <h2 style={styles.cardTitle}>Available Disciplines</h2>
                <p style={styles.clickableNote}>Click on a discipline to view its rankings</p>
                
                <div style={{padding: '8px 12px', marginBottom: '15px', background: isDarkColor(appStyles.backgroundColor) ? '#2d2d2d' : '#f8f9fa', borderRadius: '6px', fontSize: '0.9rem'}}>
                  <p style={{margin: '0 0 5px 0', fontWeight: '600'}}>Legend:</p>
                  <div style={{display: 'flex', flexWrap: 'wrap', gap: '15px'}}>
                    <span><span style={getGenderStyle('men')}>Men</span> / <span style={getGenderStyle('women')}>Women</span></span>
                    <span>{getAgeIndicator('senior')} Senior</span>
                    <span>{getAgeIndicator('junior')} Junior</span>
                  </div>
                </div>
                
                {Object.keys(disciplineGroups).length === 0 ? (
                  <p style={styles.emptyMessage}>No disciplines available.</p>
                ) : (
                  <div style={styles.disciplinesSections}>
                    {Object.entries(disciplineGroups).map(([typeName, typeGroup]) => (
                      <div key={typeName} style={styles.disciplineTypeSection}>
                        <h3 style={styles.disciplineTypeTitle}>
                          {typeName.charAt(0).toUpperCase() + typeName.slice(1)}
                        </h3>
                        <div style={styles.disciplinesGrid}>
                          {Object.entries(typeGroup.subgroups).map(([subgroupKey, subgroup]) => (
                            <div 
                              key={subgroupKey} 
                              style={{
                                ...styles.disciplineGroup,
                                cursor: 'pointer',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                ':hover': {
                                  transform: 'translateY(-2px)',
                                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)'
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering parent's onClick
                                handleDisciplineClick(subgroup.disciplines[0]);
                              }}
                            >
                              <h4 style={styles.groupTitle}>
                                {getAgeIndicator(subgroup.age)}
                                <span style={getGenderStyle(subgroup.gender)}>
                                  {formatGroupTitle(subgroup.gender, subgroup.age, typeName)}
                                </span>
                                {subgroup.disciplines.length > 1 && ` (${subgroup.disciplines.length})`}
                              </h4>
                              {/* Only show list if there's more than one discipline */}
                              {subgroup.disciplines.length > 1 && (
                                <ul style={styles.disciplineList}>
                                  {subgroup.disciplines.map((discipline, idx) => {
                                    const uniqueInfo = getUniqueInfo(discipline, typeName, subgroup.gender, subgroup.age);
                                    return (
                                      <li 
                                        key={idx} 
                                        style={{
                                          ...styles.disciplineItem,
                                          cursor: 'pointer',
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation(); // Prevent triggering parent's onClick
                                          handleDisciplineClick(discipline);
                                        }}
                                      >
                                        {uniqueInfo ? (
                                          <span style={{...styles.subtleText, ...getGenderStyle(subgroup.gender)}}>
                                            {getAgeIndicator(subgroup.age)}{uniqueInfo}
                                          </span>
                                        ) : (
                                          <span style={{...styles.subtleText, ...getGenderStyle(subgroup.gender)}}>
                                            {getAgeIndicator(subgroup.age)}{formatDisciplineName(discipline)}
                                          </span>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Rankings Modal */}
      <RankingsModal
        isOpen={isModalOpen}
        onClose={closeModal}
        discipline={selectedDiscipline}
        rankings={disciplineRankings}
        isLoading={loadingRankings}
        error={rankingsError}
        isDarkMode={isDarkColor(appStyles.backgroundColor)}
        formatDisciplineName={formatDisciplineName}
        worldSkateRankingsUrl={worldSkateRankingsUrl}
      />
    </div>
  );
};

export default RankingsPage; 