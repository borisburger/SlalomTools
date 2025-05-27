import React, { useEffect, useState } from 'react';
const API_BASE = "http://localhost:8000";
function OperatorPage() {
  const [excelUrl, setExcelUrl] = useState("");
  const [liveState, setLiveState] = useState({ category: null, discipline: null, competitors: [], category_complete: false });
  const [publicState, setPublicState] = useState({ category: null, discipline: null, competitors: [], category_complete: false, message: "", display_mode: "results" });
  const [messageText, setMessageText] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [authStatus, setAuthStatus] = useState(null);
  const [authMessage, setAuthMessage] = useState("");
  const [authAccount, setAuthAccount] = useState(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(5);
  const [lastAutoRefresh, setLastAutoRefresh] = useState(null);
  const [lastModified, setLastModified] = useState(null);
  const [authSectionExpanded, setAuthSectionExpanded] = useState(false);
  const [excelSectionExpanded, setExcelSectionExpanded] = useState(true);
  const [autoRefreshSectionExpanded, setAutoRefreshSectionExpanded] = useState(false);

  // Last skater indicator component
  const LastSkaterIndicator = () => (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: '8px',
      backgroundColor: '#8e24aa',
      borderRadius: '50%',
      width: '24px',  // Larger circle
      height: '24px',  // Larger circle
      fontSize: '14px',  // Larger triangle
      fontWeight: 'bold',
      color: 'white',
      textShadow: '0.5px 0.5px 0.5px rgba(0,0,0,0.5)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
      paddingRight: '2px',  // Adjust position of triangle
      paddingBottom: '2px'  // Adjust position of triangle
    }}>
      ◀
    </span>
  );

  // Medal indicator component for top 3 ranks
  const MedalIcon = ({ rank }) => {
    // Only show for top 3 ranks
    if (rank > 3) return null;
    
    // Colors for medals
    const colors = {
      1: { bg: '#FFD700', border: '#FFA000' }, // Gold
      2: { bg: '#C0C0C0', border: '#A0A0A0' }, // Silver
      3: { bg: '#CD7F32', border: '#A05A2C' }  // Bronze
    };

    return (
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: '8px',
        backgroundColor: colors[rank].bg,
        border: `2px solid ${colors[rank].border}`,
        borderRadius: '50%',
        width: '18px',
        height: '18px',
        fontSize: '10px',
        fontWeight: 'bold',
        color: '#333',
        boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
      }}>
        {rank}
      </span>
    );
  };

  useEffect(() => {
    // Log the fetch attempt
    console.log("Fetching config from:", `${API_BASE}/config`);
    fetch(`${API_BASE}/config`)
      .then(r => {
        console.log("Config response:", r);
        return r.json();
      })
      .then(data => {
        console.log("Config data:", data);
        const s = data.style;
        document.body.style.fontFamily = s.fontFamily;
        document.body.style.color = s.textColor;
        document.body.style.backgroundColor = s.backgroundColor;
        // Background image is now only for public view, not for operator
        if (data.defaultExcelUrl) {
          console.log("Setting default Excel URL:", data.defaultExcelUrl);
          setExcelUrl(data.defaultExcelUrl);
        }
      })
      .catch(error => {
        console.error("Error fetching config:", error);
        setError("Failed to load configuration");
      });
    
    // Fetch auto-refresh settings
    fetch(`${API_BASE}/auto_refresh/status`)
      .then(r => r.json())
      .then(data => {
        console.log("Auto-refresh status:", data);
        setAutoRefreshEnabled(data.enabled);
        setAutoRefreshInterval(data.interval);
        setLastModified(data.last_modified);
      })
      .catch(err => {
        console.error("Error fetching auto-refresh settings:", err);
      });
    
    const ws = new WebSocket(`ws://localhost:8000/ws/operator`);
    ws.onmessage = e => {
      const msg = JSON.parse(e.data);
      console.log("Received WebSocket message:", msg);
      if (msg.type === "live_update") {
        console.log("Updating live state with:", msg.data);
        setLiveState(msg.data);
        
        // Check if this was an auto-refresh
        if (msg.auto_refreshed) {
          setLastAutoRefresh(msg.timestamp || new Date().toISOString());
          console.log("Auto-refreshed data at:", msg.timestamp);
        }
      }
      if (msg.type === "public_update") setPublicState(msg.data);
      // No longer handling background_update for operator view
    };
    return () => ws.close();
  }, []);

  // Check authentication status periodically
  useEffect(() => {
    const checkAuth = () => {
      fetch(`${API_BASE}/auth/status`)
        .then(r => r.json())
        .then(data => {
          setAuthStatus(data.is_authenticated);
          setAuthMessage(data.message);
          setAuthAccount(data.account);
          setTokenExpiresAt(data.token_expires_at);
        })
        .catch(err => {
          setAuthStatus(false);
          setAuthMessage("Failed to check authentication status");
          setAuthAccount(null);
          setTokenExpiresAt(null);
        });
    };

    checkAuth();
    const interval = setInterval(checkAuth, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Automatically expand the auth section if not authenticated
    if (authStatus === false) {
      setAuthSectionExpanded(true);
    }
  }, [authStatus]);

  const handleInitiateAuth = async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/initiate`, { method: 'POST' });
      const data = await response.json();
      setAuthMessage(data.message);
      // Open the verification URL in a new tab
      window.open(data.verification_url, '_blank');
    } catch (err) {
      setError("Failed to initiate authentication");
    }
  };

  const toggleAutoRefresh = async () => {
    try {
      const newState = !autoRefreshEnabled;
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/auto_refresh/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: newState })
      });
      const data = await response.json();
      setAutoRefreshEnabled(data.enabled);
      setIsLoading(false);
    } catch (err) {
      setError("Failed to update auto-refresh settings");
      setIsLoading(false);
    }
  };

  const updateRefreshInterval = async (interval) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE}/auto_refresh/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval: parseInt(interval) })
      });
      const data = await response.json();
      setAutoRefreshInterval(data.interval);
      setIsLoading(false);
    } catch (err) {
      setError("Failed to update refresh interval");
      setIsLoading(false);
    }
  };

  const post = async (url, body) => {
    try {
      setIsLoading(true);
      setError("");
      console.log(`Making POST request to ${url}`, body);
      
      const response = await fetch(`${API_BASE}${url}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      
      let data;
      try {
        // Try to parse JSON response, but handle case where response isn't valid JSON
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch (parseError) {
        console.error(`Error parsing response from ${url}:`, parseError);
        data = { error: "Invalid response format" };
      }
      
      console.log(`Response from ${url}:`, data);
      
      if (!response.ok) {
        throw new Error(data.error || `Server returned ${response.status}: ${response.statusText}`);
      }
      
      return data;
    } catch (err) {
      console.error(`Error in POST to ${url}:`, err);
      setError(err.message || "An unknown error occurred");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  // Button click handlers with direct implementation
  const safelyCallAPI = async (func) => {
    try {
      await func();
    } catch (err) {
      console.error("Error in API call:", err);
      setError(err.message || "An unknown error occurred");
    }
  };
  
  // Simplest possible implementation for switch mode
  const handleSwitchResults = () => {
    safelyCallAPI(async () => {
      setIsLoading(true);
      try {
        // Raw fetch implementation as a fallback
        const response = await fetch(`${API_BASE}/switch_display_mode`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "results" })
        });
        console.log("Switch mode response:", response);
      } catch (err) {
        console.error("Switch mode error:", err);
        setError("Could not switch mode: " + (err.message || "Unknown error"));
      } finally {
        setIsLoading(false);
      }
    });
  };
  
  const handleSwitchMessage = () => {
    safelyCallAPI(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE}/switch_display_mode`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "message" })
        });
        console.log("Switch message mode response:", response);
      } catch (err) {
        console.error("Switch message mode error:", err);
        setError("Could not switch to message mode: " + (err.message || "Unknown error"));
      } finally {
        setIsLoading(false);
      }
    });
  };

  const handleSetMessage = () => {
    setIsLoading(true);
    post("/display_message", {message: messageText})
      .then(result => {
        if (result) return post("/switch_display_mode", {mode: "message"});
      })
      .catch(err => {
        console.error("Error setting message:", err);
        setError(`Failed to set message: ${err.message}`);
      })
      .finally(() => setIsLoading(false));
  };

  const handleClearMessage = () => {
    setIsLoading(true);
    setMessageText("");
    post("/display_message", {message: ""})
      .then(result => {
        if (result) return post("/switch_display_mode", {mode: "results"});
      })
      .catch(err => {
        console.error("Error clearing message:", err);
        setError(`Failed to clear message: ${err.message}`);
      })
      .finally(() => setIsLoading(false));
  };

  const formatExpiryTime = (timestamp) => {
    if (!timestamp) return "";
    const expiryDate = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = expiryDate - now;
    
    // If already expired
    if (diffMs <= 0) return "Expired";
    
    // Calculate time components
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    // Format relative time
    let relativeTime = "";
    if (hours > 0) {
      relativeTime += `${hours} hour${hours !== 1 ? 's' : ''}`;
      if (minutes > 0) {
        relativeTime += ` and ${minutes} minute${minutes !== 1 ? 's' : ''}`;
      }
    } else {
      relativeTime = `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    
    return `${expiryDate.toLocaleString()} (expires in ${relativeTime})`;
  };

  const formatExpiryTimeShort = (timestamp) => {
    if (!timestamp) return "";
    const expiryDate = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = expiryDate - now;
    
    // If already expired
    if (diffMs <= 0) return "Expired";
    
    // Calculate time components
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    // Format relative time briefly
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const formatLastRefresh = (isoTimestamp) => {
    if (!isoTimestamp) return "Never";
    const date = new Date(isoTimestamp);
    return date.toLocaleTimeString();
  };

  // Function to load Excel document
  const handleLoadExcel = async () => {
    const result = await post("/load_excel", { url: excelUrl });
    if (result && result.status === "ok") {
      // Collapse the Excel section after successful load
      setExcelSectionExpanded(false);
    }
  };

  return (
    <div style={{padding:"10px"}}>
      {/* Header with title and navigation buttons in one line */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px"
      }}>
        <h2 style={{margin: 0}}>Operator Console</h2>
        
        <div style={{
          display: "flex",
          gap: "10px"
        }}>
          <button 
            onClick={() => window.location.href = "/rankings"}
            style={{
              padding: "8px 15px",
              backgroundColor: "#6f42c1",
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
            <span>World Rankings</span>
            <span style={{fontSize: "0.9rem"}}>→</span>
          </button>
          
          <button 
            onClick={() => window.location.href = "/reg"}
            style={{
              padding: "8px 15px",
              backgroundColor: "#007BFF",
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
            <span>Registration Lists</span>
            <span style={{fontSize: "0.9rem"}}>→</span>
          </button>
          
          <button 
            onClick={() => window.open("/public", "_blank")}
            style={{
              padding: "8px 15px",
              backgroundColor: "#4CAF50",
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
            <span>Public View</span>
            <span style={{fontSize: "0.9rem"}}>↗</span>
          </button>
        </div>
      </div>
      
      {/* Authentication Status - Collapsible */}
      <div style={{
        marginBottom: "10px", 
        padding: "10px", 
        border: "1px solid #333", 
        borderRadius: "4px",
        background: "#222",
        color: "#fff",
        transition: "all 0.3s ease"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer"
        }} onClick={() => setAuthSectionExpanded(!authSectionExpanded)}>
          <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
            <h3 style={{margin: 0}}>Microsoft Authentication</h3>
            {/* Status indicator */}
            <div style={{
              width: "12px",
              height: "12px",
              borderRadius: "50%",
              backgroundColor: authStatus ? "#4CAF50" : "#dc3545",
              display: "inline-block"
            }}></div>
            
            {/* Minimal info when collapsed */}
            {!authSectionExpanded && authStatus && authAccount && (
              <span style={{color: "#ccc", fontSize: "0.9em"}}>
                {authAccount.username} {tokenExpiresAt && `(expires in ${formatExpiryTimeShort(tokenExpiresAt)})`}
              </span>
            )}
          </div>
          
          {/* Toggle icon */}
          <div style={{
            fontSize: "1.2rem",
            transform: authSectionExpanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s ease"
          }}>
            ▼
          </div>
        </div>
        
        {/* Expanded content */}
        {authSectionExpanded && (
          <div style={{
            marginTop: "10px",
            paddingTop: "10px",
            borderTop: "1px solid #444",
            animation: "fadeIn 0.3s ease"
          }}>
            <p>{authMessage}</p>
            {authAccount && (
              <div style={{marginTop: "10px", fontSize: "0.9em"}}>
                <p><strong>Account:</strong> {authAccount.username}</p>
                <p><strong>Environment:</strong> {authAccount.environment}</p>
                {tokenExpiresAt && (
                  <p><strong>Token expires:</strong> {formatExpiryTime(tokenExpiresAt)}</p>
                )}
              </div>
            )}
            {!authStatus && (
              <button 
                onClick={handleInitiateAuth} 
                disabled={isLoading}
                style={{
                  marginTop: "10px",
                  padding: "10px 15px",
                  backgroundColor: "#007BFF",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold"
                }}
              >
                {isLoading ? "Loading..." : "Authenticate with Microsoft"}
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div style={{color: "red", marginBottom: "10px", padding: "10px", border: "1px solid red", borderRadius: "4px"}}>
          Error: {error}
        </div>
      )}
      
      {/* Excel loading section with collapsible behavior */}
      <div style={{
        marginBottom: "20px",
        padding: "15px",
        border: "1px solid #333", 
        borderRadius: "4px",
        background: "#222",
        color: "#fff"
      }}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer"
        }} onClick={() => setExcelSectionExpanded(!excelSectionExpanded)}>
          <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
            <h3 style={{margin: 0}}>Judge's Excel on OneDrive</h3>
            
            {/* Status indicator */}
            {!excelSectionExpanded && liveState.category && (
              <span style={{color: "#ccc", fontSize: "0.9em"}}>
                Current: {liveState.category} ({liveState.competitors.length} competitors)
              </span>
            )}
          </div>
          
          {/* Toggle icon */}
          <div style={{
            fontSize: "1.2rem",
            transform: excelSectionExpanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s ease"
          }}>
            ▼
          </div>
        </div>
        
        {/* Expanded content */}
        {excelSectionExpanded && (
          <div style={{
            marginTop: "15px",
            animation: "fadeIn 0.3s ease"
          }}>
            <p style={{marginTop: 0, marginBottom: "10px", fontSize: "0.9em", color: "#ccc"}}>
              Enter the URL to your Excel document on OneDrive:
            </p>
            
            <div style={{display: "flex", gap: "10px", alignItems: "center"}}>
              <input 
                type="text" 
                placeholder="OneDrive Excel URL or path" 
                value={excelUrl} 
                onChange={e=>setExcelUrl(e.target.value)} 
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "4px",
                  border: "1px solid #555",
                  backgroundColor: "#333",
                  color: "#fff",
                  fontSize: "1rem"
                }}
                disabled={isLoading || !authStatus}
              />
              <button 
                onClick={handleLoadExcel} 
                disabled={isLoading || !authStatus}
                style={{
                  padding: "12px 20px",
                  backgroundColor: "#007BFF",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: "1rem",
                  whiteSpace: "nowrap"
                }}
              >
                {isLoading ? "Loading..." : "Load Excel"}
              </button>
            </div>
            
            <div style={{marginTop: "10px", fontSize: "0.85em", color: "#aaa"}}>
              <p style={{margin: "5px 0"}}>
                • Excel document must contain a "Final results" sheet with competitor data
              </p>
              <p style={{margin: "5px 0"}}>
                • Share the Excel file from OneDrive and paste the sharing URL here
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Auto-refresh controls - collapsible */}
      <div style={{marginBottom:"10px", padding:"10px", border:"1px solid #333", borderRadius:"4px", backgroundColor:"#333", color:"#fff"}}>
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer"
        }} onClick={() => setAutoRefreshSectionExpanded(!autoRefreshSectionExpanded)}>
          <div style={{display: "flex", alignItems: "center", gap: "10px"}}>
            <h3 style={{margin: 0}}>Auto-Refresh Settings</h3>
            
            {/* Status indicator when collapsed */}
            {!autoRefreshSectionExpanded && (
              <span style={{color: "#ccc", fontSize: "0.9em"}}>
                {autoRefreshEnabled ? (
                  <span>Active - checking every {autoRefreshInterval} seconds</span>
                ) : (
                  <span>Disabled - manual refresh only</span>
                )}
                {lastAutoRefresh && (
                  <span> (last refresh: {formatLastRefresh(lastAutoRefresh)})</span>
                )}
              </span>
            )}
          </div>
          
          {/* Toggle icon */}
          <div style={{
            fontSize: "1.2rem",
            transform: autoRefreshSectionExpanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.3s ease"
          }}>
            ▼
          </div>
        </div>
        
        {/* Expanded content */}
        {autoRefreshSectionExpanded && (
          <div style={{
            marginTop: "15px",
            animation: "fadeIn 0.3s ease"
          }}>
            <div style={{display:"flex", alignItems:"center", marginBottom:"8px"}}>
              <label style={{marginRight:"10px"}}>
                <input 
                  type="checkbox" 
                  checked={autoRefreshEnabled} 
                  onChange={toggleAutoRefresh}
                  disabled={isLoading || !authStatus}
                /> 
                Enable auto-refresh
              </label>
              
              <label style={{marginLeft:"20px"}}>
                Check every: 
                <select 
                  value={autoRefreshInterval}
                  onChange={(e) => updateRefreshInterval(e.target.value)}
                  disabled={isLoading || !autoRefreshEnabled || !authStatus}
                  style={{marginLeft:"5px", backgroundColor:"#555", color:"#fff", padding:"3px", border:"1px solid #666"}}
                >
                  <option value="5">5 seconds</option>
                  <option value="10">10 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="60">1 minute</option>
                  <option value="120">2 minutes</option>
                  <option value="300">5 minutes</option>
                </select>
              </label>
            </div>
            
            <div style={{fontSize:"0.9em", color:"#ccc"}}>
              <p>Last auto-refresh: {formatLastRefresh(lastAutoRefresh)}</p>
              {lastModified && <p>File last modified: {new Date(lastModified).toLocaleString()}</p>}
              {autoRefreshEnabled ? 
                <p>Status: <span style={{color:"#5f5", fontWeight:"bold"}}>Active - checking for updates automatically</span></p> :
                <p>Status: <span style={{color:"#fa5", fontWeight:"bold"}}>Disabled - updates must be refreshed manually</span></p>
              }
            </div>
          </div>
        )}
      </div>
      
      {/* Add message and display mode controls */}
      <div style={{marginBottom:"20px"}}>
        <div style={{
          border: "1px solid #333", 
          borderRadius: "4px", 
          padding: "15px",
          marginBottom: "10px",
          background: "#222",
          color: "#fff"
        }}>
          <h3 style={{marginTop: 0}}>Public Display Mode</h3>
          
          <div style={{
            display: "flex", 
            flexDirection: "row", 
            gap: "20px",
            marginBottom: "15px"
          }}>
            {/* Left column - Mode selection */}
            <div style={{flex: "1"}}>
              <p style={{marginTop: 0, marginBottom: "10px", fontSize: "0.9em", color: "#ccc"}}>
                Choose what content to display on the public screen:
              </p>
              
              <div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
                <button 
                  onClick={handleSwitchResults}
                  disabled={isLoading}
                  style={{
                    padding: "10px 15px",
                    backgroundColor: publicState.display_mode === "results" ? "#4CAF50" : "#444",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: publicState.display_mode === "results" ? "bold" : "normal"
                  }}
                >
                  Show Results Table
                </button>
                
                <button 
                  onClick={handleSwitchMessage}
                  disabled={isLoading || !messageText.trim()}
                  style={{
                    padding: "10px 15px",
                    backgroundColor: publicState.display_mode === "message" ? "#4CAF50" : "#444",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: publicState.display_mode === "message" ? "bold" : "normal"
                  }}
                >
                  Show Message Only
                </button>
              </div>
            </div>
            
            {/* Right column - Message content */}
            <div style={{flex: "1"}}>
              <p style={{marginTop: 0, marginBottom: "10px", fontSize: "0.9em", color: "#ccc"}}>
                Message text (displayed when in message mode):
              </p>
              
              <div style={{marginBottom: "10px"}}>
                <input 
                  type="text" 
                  placeholder="Enter message to display" 
                  value={messageText} 
                  onChange={e => setMessageText(e.target.value)} 
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "4px",
                    border: "1px solid #555",
                    backgroundColor: "#333",
                    color: "white"
                  }}
                />
              </div>
              
              <div style={{display: "flex", gap: "10px"}}>
                <button 
                  onClick={handleSetMessage} 
                  disabled={isLoading || !messageText.trim()}
                  style={{
                    padding: "8px 15px",
                    backgroundColor: "#007BFF",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: messageText.trim() ? "pointer" : "not-allowed",
                    opacity: messageText.trim() ? 1 : 0.6,
                    flex: 1
                  }}
                >
                  Set & Show Message
                </button>
                
                <button 
                  onClick={handleClearMessage}
                  disabled={isLoading || !messageText.trim()}
                  style={{
                    padding: "8px 15px",
                    backgroundColor: "#dc3545",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: messageText.trim() ? "pointer" : "not-allowed",
                    opacity: messageText.trim() ? 1 : 0.6
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          
          <div style={{
            marginTop: "10px", 
            background: "#333", 
            padding: "10px", 
            borderRadius: "4px", 
            fontSize: "0.9em",
            borderLeft: "4px solid " + (publicState.display_mode === "results" ? "#4CAF50" : "#007BFF")
          }}>
            <p style={{margin: "5px 0", fontWeight: "bold"}}>
              Current Mode: 
              <span style={{
                marginLeft: "5px", 
                color: publicState.display_mode === "results" ? "#4CAF50" : "#007BFF"
              }}>
                {publicState.display_mode === "results" ? "Showing Results Table" : "Showing Message"}
              </span>
            </p>
            {publicState.message && (
              <p style={{margin: "5px 0"}}>
                <strong>Current Message:</strong> 
                <span style={{fontStyle: "italic", marginLeft: "5px", color: "#ccc"}}>{publicState.message}</span>
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Two-column layout for data tables */}
      <div style={{
        display: "flex", 
        flexDirection: "row", 
        gap: "20px",
        flexWrap: "wrap",
        marginBottom: "20px"
      }}>
        {/* Live Data Column */}
        <div style={{flex: "1", minWidth: "300px"}}>
          <div style={{
            marginBottom: "15px",
            background: "#333",
            padding: "15px",
            borderRadius: "5px",
            borderLeft: "5px solid #007BFF"
          }}>
            <h2 style={{
              margin: "0 0 5px 0",
              fontSize: "1.5rem",
              fontWeight: "bold",
              color: "#fff"
            }}>
              {liveState.discipline || "Freestyle Slalom"} {liveState.category ? `- ${liveState.category}` : ""}
            </h2>
            <p style={{
              margin: 0,
              fontSize: "1rem",
              color: "#ccc"
            }}>Judge's Data</p>
          </div>
          
          <table border="1" cellPadding="4" style={{width: "100%"}}><thead><tr>
            <th>Rank</th><th>Name</th> <th>Country</th> <th style={{color: "#e65100", fontWeight: "bold"}}>PEN</th>
            <th>J1</th><th>J2</th><th>J3</th>
          </tr></thead><tbody>
            {liveState.competitors.map(c=>(
              <tr key={c.rank}>
                <td>
                  {liveState.category_complete && c.rank <= 3 && <MedalIcon rank={c.rank} />}
                  {c.rank}
                </td>
                <td>
                  {c.name}
                  {c.last_skater && !liveState.category_complete && <LastSkaterIndicator />}
                </td>
                <td>{c.country}</td>
                <td style={{color: "#e65100", fontWeight: "bold", textShadow: "1px 1px 2px rgba(0,0,0,0.7)"}}>
                  {c.penalty || '0'}
                </td>
                <td>{c.judge1}</td><td>{c.judge2}</td><td>{c.judge3}</td>
              </tr>
            ))}
          </tbody></table>
          
          <div style={{marginTop: "15px", display: "flex", gap: "10px"}}>
            <button 
              onClick={()=>post("/refresh_data",{})} 
              disabled={isLoading}
              style={{
                padding: "10px 15px",
                backgroundColor: "#555",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                flex: 1
              }}
            >
              {isLoading ? "Refreshing..." : "Refresh Data Now"}
            </button>
            
            <button 
              onClick={() => post("/mark_complete", {category_complete: !liveState.category_complete})} 
              disabled={isLoading}
              style={{
                padding: "10px 15px",
                backgroundColor: liveState.category_complete ? "#d9534f" : "#5cb85c",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px"
              }}
            >
              <span style={{
                display: "inline-block", 
                width: "12px", 
                height: "12px", 
                borderRadius: "50%", 
                backgroundColor: "white"
              }}></span>
              {liveState.category_complete ? "Mark as Ongoing" : "Mark as Complete"}
            </button>
          </div>
        </div>
        
        {/* Public Snapshot Column */}
        <div style={{flex: "1", minWidth: "300px"}}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px"
          }}>
            <div style={{
              flexGrow: 1,
              marginRight: "10px"
            }}>
              <div style={{
                background: "#333",
                padding: "15px",
                borderRadius: "5px",
                borderLeft: "5px solid #4CAF50",
                marginBottom: "10px"
              }}>
                <h2 style={{
                  margin: "0",
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color: "#fff"
                }}>
                  Current Public View
                </h2>
              </div>
            </div>
            
            <button 
              onClick={()=>post("/publish",{})} 
              disabled={isLoading}
              style={{
                padding: "12px 20px",
                backgroundColor: "#4CAF50",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "1rem",
                alignSelf: "flex-start"
              }}
            >
              Update Public Display
            </button>
          </div>
          
          <p>{publicState.message}</p>
          <table border="1" cellPadding="4" style={{width: "100%"}}><thead><tr>
            <th>Rank</th><th>Name</th><th>Country</th><th style={{color: "#e65100", fontWeight: "bold"}}>PEN</th>
            <th>J1</th><th>J2</th><th>J3</th>
          </tr></thead><tbody>
            {publicState.competitors.map(c=>(
              <tr key={c.rank}>
                <td>
                  {publicState.category_complete && c.rank <= 3 && <MedalIcon rank={c.rank} />}
                  {c.rank}
                </td>
                <td>
                  {c.name}
                  {c.last_skater && !publicState.category_complete && <LastSkaterIndicator />}
                </td>
                <td>{c.country}</td>
                <td style={{color: "#e65100", fontWeight: "bold", textShadow: "1px 1px 2px rgba(0,0,0,0.7)"}}>
                  {c.penalty || '0'}
                </td>
                <td>{c.judge1}</td><td>{c.judge2}</td><td>{c.judge3}</td>
              </tr>
            ))}
          </tbody></table>
        </div>
      </div>
    </div>
  );
}
export default OperatorPage;