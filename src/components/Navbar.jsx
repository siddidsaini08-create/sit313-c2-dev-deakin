import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase/firebase.js';
import { useAuth } from '../context/AuthContext.jsx';

const sectionLinks = [
  { label: 'About', id: 'about' },
  { label: 'Work', id: 'work' },
  { label: 'Gallery', id: 'gallery' },
  { label: 'Contact', id: 'contact' },
  { label: 'Subscribe', id: 'subscribe' },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, plan, checkingAuth, checkingProfile } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (!auth || loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut(auth);
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
      window.alert('Could not log out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleSearch = (event) => {
    // Preserve the original P5 navbar search placeholder.
    event.preventDefault();
  };

  return (
    <header className="site-header">
      <nav className="site-nav" aria-label="Main navigation">
        <Link className="brand" to="/" aria-label="DEV@Deakin home">
          <span className="brand-mark">DEV</span><span className="brand-at">@</span><span className="brand-name">Deakin</span>
        </Link>

        {location.pathname === '/' ? (
          <div className="nav-section-links" aria-label="Portfolio sections">
            {sectionLinks.map((item) => (
              <a href={`/#${item.id}`} key={item.id}>{item.label}</a>
            ))}
          </div>
        ) : (
          <Link className="nav-back-home" to="/">Back to home</Link>
        )}

        <div className="nav-actions">
          <form className="nav-search" role="search" onSubmit={handleSearch}>
            <input type="search" placeholder="Search" aria-label="Search (coming in a future task)" />
            <button type="submit" aria-label="Search" title="Search will be implemented in a future task">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></svg>
            </button>
          </form>
          <button className="nav-post" type="button" onClick={() => navigate('/posts')}>Post</button>
          <Link className={`nav-pricing ${location.pathname === '/pricing' ? 'is-current' : ''}`} to="/pricing">Pricing</Link>
          {!checkingAuth && user && !checkingProfile && (
            <span className={`nav-plan-badge ${plan === 'Paid' ? 'is-paid' : ''}`} title="Your current subscription">{plan} plan</span>
          )}
          {!checkingAuth && (user ? (
            <button className="nav-register" type="button" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? 'Logging out…' : 'Log out'}
            </button>
          ) : (
            <>
              <Link className={`nav-login ${location.pathname === '/login' ? 'is-current' : ''}`} to="/login">Log in</Link>
              <Link className={`nav-register ${location.pathname === '/register' ? 'is-current' : ''}`} to="/register">Create account</Link>
            </>
          ))}
        </div>
      </nav>
    </header>
  );
}
