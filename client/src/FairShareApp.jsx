import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { apiGet } from "./api";
import CalendarSection from "./components/CalendarSection";
import ChatSection from "./components/ChatSection";
import ChoresSection from "./components/ChoresSection";
import ExpensesSection from "./components/ExpensesSection";
import ProfileSection from "./components/ProfileSection";
import RoommatesSection from "./components/RoommatesSection";

function FairShareApp() {
  const [activeTab, setActiveTab] = useState("chores");
  const [showProfile, setShowProfile] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [profile, setProfile] = useState(null);
  const { currentUser } = useAuth();

  const loadProfile = useCallback(async () => {
    try {
      const res = await apiGet("/roommates/me");
      setProfile(res.data);
    } catch (err) {
      console.error("Failed to load profile", err);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleProfileClose = () => {
    setShowProfile(false);
    loadProfile(); // Refresh profile data when modal closes
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: '1 1 200px' }}>
              <div>
                <h1 className="app-title">FairShare</h1>
                <p className="app-subtitle">
                  Your household, perfectly balanced
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: '0 0 auto', position: 'relative' }}>
              <button
                onClick={() => setShowCalendar(true)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '12px',
                  padding: '0.6rem',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.3rem',
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
                title="Calendar"
              >
                📅
              </button>
              <button
                onClick={() => setShowProfile(!showProfile)}
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '999px',
                  padding: '0.5rem 1rem',
                  color: 'white',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  transition: 'all 0.3s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <span style={{ fontSize: '1.2rem' }}>👤</span>
                {profile?.displayName || currentUser?.displayName || currentUser?.email?.split("@")[0] || currentUser?.email}
                <span style={{ fontSize: '0.7rem' }}>{showProfile ? '▲' : '▼'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Profile Modal */}
      {showProfile && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(5px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            animation: 'fadeIn 0.3s ease'
          }}
          onClick={() => setShowProfile(false)}
        >
          <div 
            style={{
              maxWidth: '600px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              position: 'relative'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleProfileClose}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '1.5rem',
                color: 'var(--text-dark)',
                zIndex: 10,
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                e.currentTarget.style.transform = 'rotate(90deg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'rotate(0deg)';
              }}
            >
              ×
            </button>
            <ProfileSection onClose={handleProfileClose} />
          </div>
        </div>
      )}

      <div className="tab-navigation">
        <button
          onClick={() => setActiveTab("chores")}
          className={`tab-button ${activeTab === "chores" ? "active" : ""}`}
        >
          Chores
        </button>
        <button
          onClick={() => setActiveTab("expenses")}
          className={`tab-button ${activeTab === "expenses" ? "active" : ""}`}
        >
          Expenses
        </button>
        <button
          onClick={() => setActiveTab("roommates")}
          className={`tab-button ${activeTab === "roommates" ? "active" : ""}`}
        >
          Roommates
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`tab-button ${activeTab === "chat" ? "active" : ""}`}
        >
          Chat
        </button>
      </div>

      <main className="content">
        {activeTab === "chores" && <ChoresSection />}
        {activeTab === "expenses" && <ExpensesSection />}
        {activeTab === "roommates" && <RoommatesSection />}
        {activeTab === "chat" && <ChatSection currentUser={currentUser} />}
      </main>

      {/* Calendar Modal */}
      {showCalendar && (
        <div 
          className="calendar-modal-overlay"
          onClick={() => setShowCalendar(false)}
        >
          <div 
            className="calendar-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowCalendar(false)}
              className="calendar-modal-close"
            >
              ×
            </button>
            <CalendarSection />
          </div>
        </div>
      )}
    </div>
  );
}
export default FairShareApp;
