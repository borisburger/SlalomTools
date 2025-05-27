import React, { useEffect, useState, useRef, useCallback } from 'react';
const API_BASE = "http://localhost:8000";

// Country code to flag mapping using flag API
const getFlag = (countryCode) => {
  // For 3-letter codes, map to 2-letter ISO codes
  const codeMap = {
    'SVK': 'SK', // Slovakia
    'POL': 'PL', // Poland
    'CZE': 'CZ', // Czech Republic
    'HUN': 'HU', // Hungary
    'GER': 'DE', // Germany
    'UKR': 'UA', // Ukraine
    'IND': 'IN', // India
    'USA': 'US', // United States
    'GBR': 'GB', // Great Britain
    'CAN': 'CA', // Canada
    'AUS': 'AU', // Australia
    'FRA': 'FR', // France
    'ITA': 'IT', // Italy
    'ESP': 'ES', // Spain
    'JPN': 'JP', // Japan
    'CHN': 'CN', // China
    'BRA': 'BR', // Brazil
    'RUS': 'RU', // Russia
    'KOR': 'KR', // South Korea
    'NED': 'NL', // Netherlands
    'SUI': 'CH', // Switzerland
    'AUT': 'AT', // Austria
    'SWE': 'SE', // Sweden
    'NOR': 'NO', // Norway
    'FIN': 'FI', // Finland
    'DEN': 'DK', // Denmark
    'BEL': 'BE', // Belgium
    'POR': 'PT', // Portugal
    'GRE': 'GR', // Greece
    'TUR': 'TR', // Turkey
    // Add more mappings as needed
  };
  
  // Use the 2-letter code if available in our mapping, otherwise use first 2 letters
  let code = codeMap[countryCode] || countryCode.substring(0, 2);
  
  // Return flag image URL from Flagpedia API (using ISO 3166-1 alpha-2 codes)
  return {
    url: `https://flagcdn.com/w80/${code.toLowerCase()}.png`,
    code: code
  };
};

function PublicPage() {
  const [state, setState] = useState({category:null, discipline:null, competitors:[], category_complete:false, message:"", display_mode: "results"});
  const [theme, setTheme] = useState({
    fontFamily: 'Arial, sans-serif',
    textColor: '#ffffff',
    backgroundColor: '#121212'
  });
  
  // Use useCallback to create a stable function reference that persists across renders
  const updateBackgroundScale = useCallback((scale) => {
    const bgDiv = document.getElementById('background-container');
    if (!bgDiv) return;
    
    bgDiv.dataset.scale = scale.toString();
    bgDiv.style.transform = `scale(${scale})`;
    bgDiv.style.transformOrigin = 'center center';
    localStorage.setItem('backgroundScale', scale.toString());
  }, []);
  
  useEffect(()=>{
    // Define handleResize at the top level of useEffect so it's accessible for cleanup
    const handleResize = () => {
      const bgDiv = document.getElementById('background-container');
      if (bgDiv) {
        // Force a repaint of the background div
        bgDiv.style.display = 'none';
        void bgDiv.offsetHeight;
        bgDiv.style.display = 'block';
      }
    };
    
    fetch(`${API_BASE}/config`).then(r=>r.json()).then(data=>{
      const s=data.style;
      setTheme({
        fontFamily: s.fontFamily || 'Arial, sans-serif',
        textColor: s.textColor || '#ffffff',
        backgroundColor: s.backgroundColor || '#121212'
      });
      
      // Set basic styling on body
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.fontFamily = s.fontFamily;
      document.body.style.color = s.textColor;
      document.body.style.backgroundColor = s.backgroundColor;
      document.body.style.height = '100vh';
      document.body.style.width = '100vw';
      document.body.style.overflow = 'auto';
      
      // Clear any existing background
      document.body.style.backgroundImage = 'none';
      
      if(data.backgroundUrl){
        console.log(`Received background URL: ${data.backgroundUrl}`);
        
        // Use direct paths for URLs starting with '/backgrounds/'
        const backgroundUrl = data.backgroundUrl.startsWith('http') || data.backgroundUrl.startsWith('/backgrounds/')
          ? data.backgroundUrl
          : `${API_BASE}${data.backgroundUrl}`;
        
        console.log(`Setting background image: ${backgroundUrl}`);
        
        // Create a dedicated background div instead of setting on body
        const bgDiv = document.createElement('div');
        bgDiv.id = 'background-container';
        bgDiv.style.position = 'fixed';
        bgDiv.style.top = '0';
        bgDiv.style.left = '0';
        bgDiv.style.width = '100%';
        bgDiv.style.height = '100%';
        bgDiv.style.zIndex = '-1';
        bgDiv.style.backgroundImage = `url(${backgroundUrl})`;
        
        // Set background size to preserve aspect ratio
        bgDiv.style.backgroundSize = 'contain';  // Preserve aspect ratio
        bgDiv.style.backgroundPosition = 'center center';
        bgDiv.style.backgroundRepeat = 'no-repeat';
        
        // Create controls to adjust scaling
        const scaleControls = document.createElement('div');
        scaleControls.id = 'scale-controls';
        scaleControls.style.position = 'fixed';
        scaleControls.style.bottom = '10px';
        scaleControls.style.right = '10px';
        scaleControls.style.background = 'rgba(0,0,0,0.5)';
        scaleControls.style.padding = '5px';
        scaleControls.style.borderRadius = '5px';
        scaleControls.style.zIndex = '1000';
        scaleControls.style.display = 'flex';
        scaleControls.style.gap = '5px';
        
        // Scale down button
        const scaleDownBtn = document.createElement('button');
        scaleDownBtn.textContent = '−';
        scaleDownBtn.style.width = '30px';
        scaleDownBtn.style.height = '30px';
        scaleDownBtn.style.cursor = 'pointer';
        scaleDownBtn.onclick = () => {
          const currentScale = parseFloat(bgDiv.dataset.scale || '1');
          const newScale = Math.max(0.5, currentScale - 0.05);
          updateBackgroundScale(newScale);
        };
        
        // Scale up button
        const scaleUpBtn = document.createElement('button');
        scaleUpBtn.textContent = '+';
        scaleUpBtn.style.width = '30px';
        scaleUpBtn.style.height = '30px';
        scaleUpBtn.style.cursor = 'pointer';
        scaleUpBtn.onclick = () => {
          const currentScale = parseFloat(bgDiv.dataset.scale || '1');
          const newScale = Math.min(1.5, currentScale + 0.05);
          updateBackgroundScale(newScale);
        };
        
        // Reset button
        const resetBtn = document.createElement('button');
        resetBtn.textContent = '100%';
        resetBtn.style.height = '30px';
        resetBtn.style.cursor = 'pointer';
        resetBtn.onclick = () => {
          updateBackgroundScale(1);
        };
        
        // Add buttons to controls
        scaleControls.appendChild(scaleDownBtn);
        scaleControls.appendChild(resetBtn);
        scaleControls.appendChild(scaleUpBtn);
        
        // Try to load saved scale
        const savedScale = localStorage.getItem('backgroundScale');
        if (savedScale) {
          updateBackgroundScale(parseFloat(savedScale));
        } else {
          updateBackgroundScale(1); // Start at 100% scale since we're using 'contain'
        }
        
        // Remove any existing background container
        const existingBg = document.getElementById('background-container');
        if (existingBg) {
          existingBg.remove();
        }
        
        // Remove any existing scale controls
        const existingControls = document.getElementById('scale-controls');
        if (existingControls) {
          existingControls.remove();
        }
        
        // Add the background div to the body
        document.body.appendChild(bgDiv);
        document.body.appendChild(scaleControls);
      }
      
      // Add CSS for scrollbar
      const style = document.createElement('style');
      style.textContent = `
        ::-webkit-scrollbar {
          width: 10px;
          height: 10px;
        }
        ::-webkit-scrollbar-track {
          background: #1e1e1e;
        }
        ::-webkit-scrollbar-thumb {
          background: #555;
          border-radius: 5px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #888;
        }
        
        html, body {
          height: 100%;
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }
        
        #background-container {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: -1;
        }
        
        #root {
          position: relative;
          z-index: 1;
        }
        
        /* Font selection - Uncomment your preferred choice */
        
        /* OPTION 1: Montserrat - Modern, clean, sporty
        body, h1, h2, h3, table {
          font-family: 'Montserrat', sans-serif !important;
        }
        */
       
        /* OPTION 2: Oswald - Bold, condensed, excellent for sports
        body, h1, h2, h3, table {
          font-family: 'Oswald', sans-serif !important;
        }
        */
        
        /* OPTION 3: Raleway - Elegant, light, modern */
        body, h1, h2, h3, table {
          font-family: 'Raleway', sans-serif !important;
        }
        
        
        /* OPTION 4: Barlow - Contemporary, versatile, technical 
        body, h1, h2, h3, table {
          font-family: 'Barlow', sans-serif !important;
        }*/
        
        /* OPTION 5: Bebas Neue for headers, Roboto for text (mixed)
        h1, h2, h3, thead th {
          font-family: 'Bebas Neue', sans-serif !important;
          letter-spacing: 1px;
        }
        body, table, td {
          font-family: 'Roboto', sans-serif !important;
        }
        */
      `;
      document.head.appendChild(style);
      
      // Add window resize event listener
      window.addEventListener('resize', handleResize);
      
      // Load Google Fonts - expanded options
      const fontLink = document.createElement('link');
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&family=Oswald:wght@400;500;700&family=Raleway:wght@400;700&family=Barlow:wght@400;600&family=Bebas+Neue&family=Roboto:wght@400;700&display=swap';
      fontLink.rel = 'stylesheet';
      document.head.appendChild(fontLink);
    });
    
    const ws=new WebSocket(`ws://localhost:8000/ws/public`);
    ws.onmessage=e=>{
      const msg=JSON.parse(e.data);
      if(msg.type==="public_update")setState(msg.data);
      if(msg.type==="background_update"){
        console.log(`Received background update: ${msg.url}`);
        
        // Use direct paths for URLs starting with '/backgrounds/'
        const backgroundUrl = msg.url.startsWith('http') || msg.url.startsWith('/backgrounds/')
          ? msg.url
          : `${API_BASE}${msg.url}`;
        
        console.log(`Updated background image: ${backgroundUrl}`);
        
        // Update the dedicated background div
        const bgDiv = document.getElementById('background-container');
        if (bgDiv) {
          bgDiv.style.backgroundImage = `url(${backgroundUrl})`;
        } else {
          // Create a new background div if it doesn't exist
          const newBgDiv = document.createElement('div');
          newBgDiv.id = 'background-container';
          newBgDiv.style.position = 'fixed';
          newBgDiv.style.top = '0';
          newBgDiv.style.left = '0';
          newBgDiv.style.width = '100%';
          newBgDiv.style.height = '100%';
          newBgDiv.style.zIndex = '-1';
          newBgDiv.style.backgroundImage = `url(${backgroundUrl})`;
          newBgDiv.style.backgroundSize = 'contain';
          newBgDiv.style.backgroundPosition = 'center center';
          newBgDiv.style.backgroundRepeat = 'no-repeat';
          document.body.appendChild(newBgDiv);
        }
        
        // Apply the saved scale after updating the image
        const scale = localStorage.getItem('backgroundScale') || 1;
        updateBackgroundScale(parseFloat(scale));
      }
    };
    
    // Cleanup function
    return ()=>{
      ws.close();
      window.removeEventListener('resize', handleResize);
      const bgDiv = document.getElementById('background-container');
      if (bgDiv) {
        bgDiv.remove();
      }
      const scaleControls = document.getElementById('scale-controls');
      if (scaleControls) {
        scaleControls.remove();
      }
    };
  }, [updateBackgroundScale]);
  
  // Determine styles based on rank with balanced transparency
  const getUpdatedRankStyle = (rank) => {
    if (rank === 1) {
      return { 
        backgroundColor: 'rgba(255, 215, 0, 0.3)', 
        borderLeft: '4px solid gold',
        fontWeight: 'bold'
      };
    } else if (rank === 2) {
      return { 
        backgroundColor: 'rgba(192, 192, 192, 0.3)', 
        borderLeft: '4px solid silver',
        fontWeight: 'bold'
      };
    } else if (rank === 3) {
      return { 
        backgroundColor: 'rgba(205, 127, 50, 0.3)', 
        borderLeft: '4px solid #cd7f32',
        fontWeight: 'bold'
      };
    } else {
      return { 
        backgroundColor: rank % 2 === 0 ? 'rgba(20, 50, 50, 0.35)' : 'rgba(10, 35, 35, 0.3)',
        borderLeft: '4px solid transparent'
      };
    }
  };
  
  // Format the country with flag
  const formatCountry = (countryCode) => {
    if (!countryCode) return null;
    
    const flag = getFlag(countryCode);
    
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'flex-start', 
        gap: '12px',
        width: '100%'
      }}>
        <div style={{
          width: '65px',
          display: 'flex',
          justifyContent: 'center'
        }}>
          <img 
            src={flag.url} 
            alt={`${countryCode} flag`}
            style={{
              width: "65px",
              height: "auto",
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '4px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
        <div style={{
          minWidth: '80px',
          textAlign: 'left'
        }}>
          <span style={{
            fontSize: "2.2rem",
            fontWeight: "bold",
            textShadow: "1px 1px 2px rgba(0,0,0,0.8)"
          }}>{countryCode}</span>
        </div>
      </div>
    );
  };
  
  // Last skater indicator
  const LastSkaterIndicator = () => (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: '10px',
      backgroundColor: '#8e24aa', // Purple background
      borderRadius: '50%',
      width: 'min(34px, 8vw)',  // Larger circle
      height: 'min(34px, 8vw)',  // Larger circle
      fontSize: 'min(20px, 5vw)',  // Larger triangle
      fontWeight: 'bold',
      color: 'white',
      textShadow: '1px 1px 1px rgba(0,0,0,0.5)',
      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
      paddingRight: '2px',  // Adjust position of triangle
      paddingBottom: '2px'  // Adjust position of triangle
    }}>
      ◀
    </div>
  );
  
  // Medal indicator for top 3 ranks
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
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors[rank].bg,
        border: `3px solid ${colors[rank].border}`,
        borderRadius: '50%',
        width: 'min(40px, 8vw)',  // Slightly larger
        height: 'min(40px, 8vw)',  // Slightly larger
        fontSize: 'min(22px, 5vw)',  // Larger text
        fontWeight: 'bold',
        color: 'white',
        textShadow: '1px 1px 2px rgba(0,0,0,0.7)',
        boxShadow: '0 2px 5px rgba(0,0,0,0.4)',
        lineHeight: 1,  // Ensure vertical centering
        paddingBottom: '2px'  // Slight adjustment for visual centering
      }}>
        {rank}
      </div>
    );
  };
  
  return (
    <div style={{
      textAlign:"center",
      padding:"20px",
      maxWidth: "1600px",
      margin: "0 auto",
      position: "relative",
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
      fontFamily: "'Roboto', Arial, sans-serif"
    }}>
      {/* Header - Only displayed in results mode */}
      {state.display_mode === "results" && (
        <div style={{
          marginBottom: "20px",
          position: "relative",
          width: "100%",
          padding: "15px 0",
          borderRadius: "10px",
          background: "rgba(0,0,0,0.7)",
          boxShadow: "0 4px 30px rgba(0, 0, 0, 0.1)",
          backdropFilter: "blur(5px)"
        }}>
          {/* Category display - larger since it's the only heading now */}
          <h2 style={{
            fontSize: "4rem",
            margin: "10px 0",
            fontWeight: "bold",
            letterSpacing: "1px",
            textShadow: "2px 2px 4px rgba(0,0,0,0.5)",
            color: "#ffffff"
          }}>
            {state.category}
            {state.category_complete ? 
              <span style={{
                marginLeft: "15px", 
                color: "#ffcc00",
                fontSize: "0.8em",
                padding: "5px 10px",
                background: "rgba(25,25,25,0.7)",
                borderRadius: "5px"
              }}>
                FINAL
              </span> : ""}
          </h2>
        </div>
      )}
      
      {/* Message Display - Full screen message when in message mode */}
      {state.display_mode === "message" && state.message && (
        <div style={{
          width: "100%",
          maxWidth: "1000px",
          padding: "40px 20px",
          background: "rgba(20,60,60,0.75)",
          borderRadius: "10px",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.3)",
          backdropFilter: "blur(6px)",
          margin: "20px auto",
          animation: "fadeIn 0.5s ease-in-out"
        }}>
          <h2 style={{
            fontSize: "7rem",
            fontWeight: "bold",
            color: "#ffffff",
            textShadow: "1px 1px 3px rgba(0,0,0,0.8)",
            margin: "0 0 20px 0",
            lineHeight: "1.3"
          }}>
            {state.message}
          </h2>
        </div>
      )}
      
      {/* Results Table - Only shown in results mode */}
      {state.display_mode === "results" && (
        <div style={{
          width: "100%",
          overflowX: "auto",
          borderRadius: "10px",
          background: "rgba(10,35,35,0.65)", // Darker teal that complements mint
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.25)",
          backdropFilter: "blur(6px)" // Moderate blur
        }}>
          <table style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "1.8rem",
            textAlign: "center"
          }}>
            <thead>
              <tr style={{
                background: "rgba(5,30,30,0.75)", // Slightly darker teal for header
                height: "90px",
                borderBottom: "4px solid rgba(130,220,200,0.25)" // Light mint border
              }}>
                <th style={{ 
                  width: "6.5%", 
                  padding: "15px", 
                  borderTopLeftRadius: "10px",
                  fontSize: "2.5rem",
                  fontWeight: "bold",
                  textShadow: "1px 1px 2px rgba(0,0,0,0.8)"
                }}>Rank</th>
                <th style={{ 
                  width: "54%",
                  padding: "15px",
                  fontSize: "2.5rem",
                  fontWeight: "bold",
                  textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                  textAlign: "left"
                }}>Name</th>
                <th style={{ 
                  width: "16%",
                  padding: "15px",
                  fontSize: "2.5rem",
                  fontWeight: "bold",
                  textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                  textAlign: "left"
                }}>Country</th>
                <th style={{ 
                  width: "6%",
                  padding: "15px",
                  fontSize: "2.5rem",
                  fontWeight: "normal",
                  textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                  color: "#e65100"
                }}>PEN</th>
                <th style={{ 
                  width: "6%",
                  padding: "15px",
                  fontSize: "2.5rem",
                  fontWeight: "normal",
                  textShadow: "1px 1px 2px rgba(0,0,0,0.8)"
                }}>J1</th>
                <th style={{ 
                  width: "6%",
                  padding: "15px",
                  fontSize: "2.5rem",
                  fontWeight: "normal",
                  textShadow: "1px 1px 2px rgba(0,0,0,0.8)"
                }}>J2</th>
                <th style={{ 
                  width: "6%",
                  padding: "15px", 
                  borderTopRightRadius: "10px",
                  fontSize: "2.5rem",
                  fontWeight: "normal",
                  textShadow: "1px 1px 2px rgba(0,0,0,0.8)"
                }}>J3</th>
              </tr>
            </thead>
            <tbody>
              {state.competitors.slice(0, 8).map(c => (
                <tr key={c.rank} style={{
                  ...getUpdatedRankStyle(c.rank),
                  height: "85px",
                  transition: "all 0.2s ease"
                }}>
                  <td style={{ 
                    padding: "12px",
                    fontSize: c.rank <= 3 ? "3.5rem" : "3rem",
                    fontWeight: c.rank <= 3 ? "bold" : "bold",
                    textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                    textAlign: "center"  // Center all content in the cell
                  }}>
                    {state.category_complete && c.rank <= 3 ? 
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <MedalIcon rank={c.rank} />
                      </div> : 
                      c.rank
                    }
                  </td>
                  <td style={{ 
                    padding: "12px 20px",
                    textAlign: "left",
                    fontSize: c.rank <= 3 ? "3.2rem" : "3rem",
                    fontWeight: c.rank <= 3 ? "bold" : "bold",
                    textShadow: "1px 1px 2px rgba(0,0,0,0.8)",
                    wordBreak: "normal",
                    whiteSpace: "normal"
                  }}>
                    {c.name}
                    {c.last_skater && !state.category_complete && <LastSkaterIndicator />}
                  </td>
                  <td style={{ padding: "12px" }}>
                    {formatCountry(c.country)}
                  </td>
                  <td style={{ 
                    padding: "12px",
                    fontSize: c.rank <= 3 ? "3.2rem" : "3rem",
                    fontWeight: "bold",
                    textShadow: "1px 1px 3px rgba(0,0,0,0.9)",
                    color: "#e65100"
                  }}>
                    {c.penalty || '0'}
                  </td>
                  <td style={{ 
                    padding: "12px",
                    fontSize: c.rank <= 3 ? "3.2rem" : "3rem",
                    fontWeight: "normal",
                    textShadow: "1px 1px 2px rgba(0,0,0,0.8)"
                  }}>
                    {c.judge1}
                  </td>
                  <td style={{ 
                    padding: "12px",
                    fontSize: c.rank <= 3 ? "3.2rem" : "3rem",
                    fontWeight: "normal",
                    textShadow: "1px 1px 2px rgba(0,0,0,0.8)"
                  }}>
                    {c.judge2}
                  </td>
                  <td style={{ 
                    padding: "12px",
                    fontSize: c.rank <= 3 ? "3.2rem" : "3rem",
                    fontWeight: "normal",
                    textShadow: "1px 1px 2px rgba(0,0,0,0.8)"
                  }}>
                    {c.judge3}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default PublicPage;