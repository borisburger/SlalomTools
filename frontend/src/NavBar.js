import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/reg', label: 'Registration & Starting Lists' },
  { path: '/operator', label: 'TV Operator' },
  { path: '/rankings', label: 'World Skate Databases' },
];

function NavBar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '8px 12px',
      marginBottom: '16px',
      backgroundColor: '#1a1a1a',
      borderRadius: '6px',
      borderBottom: '2px solid #333',
    }}>
      {NAV_ITEMS.map(({ path, label }) => {
        const isActive = location.pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              padding: '8px 16px',
              backgroundColor: isActive ? '#444' : 'transparent',
              color: isActive ? '#fff' : '#aaa',
              border: 'none',
              borderRadius: '4px',
              cursor: isActive ? 'default' : 'pointer',
              fontSize: '0.95rem',
              fontWeight: isActive ? 'bold' : 'normal',
              transition: 'background-color 0.2s, color 0.2s',
            }}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}

export default NavBar;
