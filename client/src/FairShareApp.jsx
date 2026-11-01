import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { apiDelete, apiGet, apiPost } from "./api";
import CalendarSection from "./components/CalendarSection";
import ChatSection from "./components/ChatSection";
import ChoresSection from "./components/ChoresSection";
import ExpensesSection from "./components/ExpensesSection";
import Button from "./components/Button";
import Card from "./components/Card";
import EmptyState from "./components/EmptyState";
import PageHeader from "./components/PageHeader";
import ProfileSection from "./components/ProfileSection";
import RoommatesSection from "./components/RoommatesSection";
import StatusMessage from "./components/StatusMessage";

function FairShareApp() {
  const [activeTab, setActiveTab] = useState("chores");
  const [showProfile, setShowProfile] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [households, setHouseholds] = useState([]);
  const [activeHouseholdId, setActiveHouseholdId] = useState("");
  const [householdsLoading, setHouseholdsLoading] = useState(true);
  const [householdError, setHouseholdError] = useState("");
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [householdAction, setHouseholdAction] = useState("");
  const householdActionLoading = Boolean(householdAction);
  const [inviteMessage, setInviteMessage] = useState("");
  const { currentUser, logout } = useAuth();
  const householdStorageKey = `fairshare:active-household:${currentUser?.uid || ""}`;

  const loadProfile = useCallback(async () => {
    try {
      const res = await apiGet("/roommates/me");
      setProfile(res.data);
    } catch (err) {
      console.error("Failed to load profile", err);
    }
  }, []);

  const loadHouseholds = useCallback(async (preferredId) => {
    try {
      setHouseholdsLoading(true);
      const res = await apiGet("/households");
      const nextHouseholds = Array.isArray(res.data) ? res.data : [];
      setHouseholds(nextHouseholds);
      setActiveHouseholdId((currentId) => {
        const savedId = window.localStorage.getItem(householdStorageKey);
        const requestedId = preferredId || currentId || savedId;
        const nextId = nextHouseholds.some((household) => household._id === requestedId)
          ? requestedId
          : nextHouseholds[0]?._id || "";
        if (nextId) window.localStorage.setItem(householdStorageKey, nextId);
        else window.localStorage.removeItem(householdStorageKey);
        return nextId;
      });
      setHouseholdError("");
    } catch (err) {
      console.error("Failed to load households", err);
      setHouseholdError("Failed to load your households. Please try again.");
    } finally {
      setHouseholdsLoading(false);
    }
  }, [householdStorageKey]);

  useEffect(() => {
    loadProfile();
    loadHouseholds();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return undefined;
    function closeOnOutsideClick(event) {
      if (!profileMenuRef.current?.contains(event.target)) setProfileMenuOpen(false);
    }
    function closeOnEscape(event) {
      if (event.key === "Escape") setProfileMenuOpen(false);
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileMenuOpen]);

  const activeHousehold = useMemo(
    () => households.find((household) => household._id === activeHouseholdId) || null,
    [households, activeHouseholdId]
  );
  const isHouseholdOwner = Boolean(profile?._id) &&
    String(activeHousehold?.createdBy?._id || activeHousehold?.createdBy) === String(profile._id);

  function selectHousehold(householdId) {
    setActiveHouseholdId(householdId);
    setInviteMessage("");
    if (householdId) window.localStorage.setItem(householdStorageKey, householdId);
  }

  const handleHouseholdAccessError = useCallback(async () => {
    await loadHouseholds();
  }, [loadHouseholds]);

  async function handleCreateHousehold(event) {
    event.preventDefault();
    const name = newHouseholdName.trim();
    if (!name) return;
    try {
      setHouseholdAction("create");
      setHouseholdError("");
      const res = await apiPost("/households", { name });
      setNewHouseholdName("");
      await loadHouseholds(res.data._id);
    } catch (err) {
      console.error("Failed to create household", err);
      setHouseholdError(err.response?.data?.error || "Could not create household.");
    } finally {
      setHouseholdAction("");
    }
  }

  async function handleJoinHousehold(event) {
    event.preventDefault();
    const code = inviteCode.trim();
    if (!code) return;
    try {
      setHouseholdAction("join");
      setHouseholdError("");
      const res = await apiPost(`/households/join/${encodeURIComponent(code)}`);
      setInviteCode("");
      await loadHouseholds(res.data._id);
    } catch (err) {
      console.error("Failed to join household", err);
      setHouseholdError(err.response?.data?.error || "Could not join household. Check the invite code and try again.");
    } finally {
      setHouseholdAction("");
    }
  }

  async function handleRotateInvite() {
    try {
      setHouseholdAction("invite");
      setHouseholdError("");
      const res = await apiPost(`/households/${activeHouseholdId}/invite`);
      setHouseholds((current) =>
        current.map((household) => household._id === activeHouseholdId
          ? { ...household, ...res.data }
          : household)
      );
      setInviteMessage("New invite code created. The previous code no longer works.");
    } catch (err) {
      console.error("Failed to rotate invite code", err);
      setHouseholdError(err.response?.data?.error || "Could not create an invite code.");
    } finally {
      setHouseholdAction("");
    }
  }

  async function handleRevokeInvite() {
    try {
      setHouseholdAction("invite");
      setHouseholdError("");
      await apiDelete(`/households/${activeHouseholdId}/invite`);
      setHouseholds((current) =>
        current.map((household) => household._id === activeHouseholdId
          ? { ...household, codeExpiresAt: new Date().toISOString() }
          : household)
      );
      setInviteMessage("Invite code revoked.");
    } catch (err) {
      console.error("Failed to revoke invite code", err);
      setHouseholdError(err.response?.data?.error || "Could not revoke the invite code.");
    } finally {
      setHouseholdAction("");
    }
  }

  const handleProfileClose = () => {
    setShowProfile(false);
    loadProfile(); // Refresh profile data when modal closes
  };

  const activePage = {
    chores: { title: "Chores", description: "Keep household tasks moving." },
    expenses: { title: "Expenses", description: "Track shared costs and balances." },
    calendar: { title: "Calendar", description: "See household events and bill reminders." },
    roommates: { title: "Members", description: "Manage people in this household." },
    chat: { title: "Chat", description: "Keep in touch with your household." },
  }[activeTab];

  const navigationItems = [
    { id: "chores", label: "Chores" },
    { id: "expenses", label: "Expenses" },
    { id: "calendar", label: "Calendar" },
    { id: "roommates", label: "Members" },
    { id: "chat", label: "Chat" },
  ];

  return (
    <div className="app-container app-shell">
      <header className="app-header">
        <div className="header-content">
          <div className="app-header__inner">
            <PageHeader title="FairShare" description="Your household, perfectly balanced" />
            <div className="header-controls">
              <div className="header-household">
                <label htmlFor="active-household">Household</label>
                <select
                  id="active-household"
                  className="form-select"
                  value={activeHouseholdId}
                  onChange={(event) => selectHousehold(event.target.value)}
                  disabled={householdsLoading || households.length === 0}
                >
                  {households.length === 0 && <option value="">No households</option>}
                  {households.map((household) => (
                    <option key={household._id} value={household._id}>{household.name}</option>
                  ))}
                </select>
                <Button
                  variant="logout"
                  aria-label="Refresh households"
                  title="Refresh households"
                  onClick={() => loadHouseholds()}
                  disabled={householdsLoading}
                >
                  Refresh
                </Button>
              </div>
              <div className="profile-menu" ref={profileMenuRef}>
                <button
                  type="button"
                  className="profile-menu__trigger"
                  aria-expanded={profileMenuOpen}
                  aria-controls="profile-menu-panel"
                  onClick={() => setProfileMenuOpen((open) => !open)}
                >
                  <span className="profile-menu__avatar" aria-hidden="true">
                    {(profile?.displayName || currentUser?.displayName || currentUser?.email || "U").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="profile-menu__name">
                    {profile?.displayName || currentUser?.displayName || currentUser?.email?.split("@")[0]}
                  </span>
                  <span aria-hidden="true">⌄</span>
                </button>
                <div id="profile-menu-panel" className="profile-menu__panel" hidden={!profileMenuOpen}>
                    <div className="profile-menu__identity">
                      <strong>{profile?.displayName || currentUser?.displayName || "Your account"}</strong>
                      <span>{currentUser?.email}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setShowProfile(true);
                      }}
                    >
                      Edit profile
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        setProfileMenuOpen(false);
                        await logout();
                      }}
                    >
                      Sign out
                    </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="app-shell__body">
        <aside className="app-sidebar" aria-label="Application navigation">
          <nav className="tab-navigation" aria-label="Main navigation">
            {navigationItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`tab-button ${activeTab === item.id ? "active" : ""}`}
                aria-current={activeTab === item.id ? "page" : undefined}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </aside>
        <div className="app-shell__main">
      <Card as="section" className="household-actions" aria-label="Household actions">
        {householdError && <StatusMessage variant="error">{householdError}</StatusMessage>}
        {!householdsLoading && households.length === 0 && (
          <EmptyState
            title="Welcome to FairShare"
            description="Create a household or join one with an invite code to get started."
          />
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "0.75rem" }}>
          <form onSubmit={handleCreateHousehold} style={{ display: "flex", flex: "1 1 260px", gap: "0.5rem" }}>
            <input
              aria-label="New household name"
              className="form-input"
              maxLength={100}
              placeholder="New household name"
              value={newHouseholdName}
              onChange={(event) => setNewHouseholdName(event.target.value)}
            />
            <Button type="submit" loading={householdAction === "create"} loadingLabel="Creating household" disabled={householdActionLoading || !newHouseholdName.trim()}>
              Create
            </Button>
          </form>
          <form onSubmit={handleJoinHousehold} style={{ display: "flex", flex: "1 1 260px", gap: "0.5rem" }}>
            <input
              aria-label="Household invite code"
              className="form-input"
              maxLength={10}
              placeholder="Invite code"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
            />
            <Button type="submit" variant="secondary" loading={householdAction === "join"} loadingLabel="Joining household" disabled={householdActionLoading || !inviteCode.trim()}>
              Join
            </Button>
          </form>
        </div>
        {activeHousehold && isHouseholdOwner && (
          <div style={{ marginTop: "0.75rem" }}>
            <strong>Invite code: </strong>
            {activeHousehold.code && new Date(activeHousehold.codeExpiresAt) > new Date()
              ? <code>{activeHousehold.code}</code>
              : <span>No active invite code</span>}
            {activeHousehold.codeExpiresAt && (
              <span style={{ marginLeft: "0.5rem", color: "var(--text-light)" }}>
                Expires {new Date(activeHousehold.codeExpiresAt).toLocaleDateString()}
              </span>
            )}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
              <Button variant="secondary" onClick={handleRotateInvite} loading={householdAction === "invite"} loadingLabel="Updating invitation">
                Rotate code
              </Button>
              {activeHousehold.code && new Date(activeHousehold.codeExpiresAt) > new Date() && (
                <Button variant="secondary" onClick={handleRevokeInvite} disabled={householdActionLoading}>
                  Revoke code
                </Button>
              )}
            </div>
            {inviteMessage && <p role="status">{inviteMessage}</p>}
          </div>
        )}
      </Card>

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

      <main className="content">
        <PageHeader title={activePage.title} description={activePage.description} />
        {householdsLoading && <div className="loading">Loading households...</div>}
        {!householdsLoading && !activeHousehold && (
          <div className="empty-state">
            <p className="empty-state-text">Select or create a household to see its chores, expenses, members, and chat.</p>
          </div>
        )}
        {activeHousehold && activeTab === "chores" && (
          <ChoresSection
            key={`chores-${activeHouseholdId}`}
            householdId={activeHouseholdId}
            roommates={activeHousehold.members || []}
            onHouseholdAccessError={handleHouseholdAccessError}
          />
        )}
        {activeHousehold && activeTab === "expenses" && (
          <ExpensesSection
            key={`expenses-${activeHouseholdId}`}
            householdId={activeHouseholdId}
            roommates={activeHousehold.members || []}
            onHouseholdAccessError={handleHouseholdAccessError}
          />
        )}
        {activeHousehold && activeTab === "roommates" && (
          <RoommatesSection
            key={`members-${activeHouseholdId}`}
            householdId={activeHouseholdId}
            roommates={activeHousehold.members || []}
            currentUserId={profile?._id}
            isOwner={isHouseholdOwner}
            onHouseholdAccessError={handleHouseholdAccessError}
            onMembersChanged={() => loadHouseholds()}
          />
        )}
        {activeHousehold && activeTab === "chat" && (
          <ChatSection
            key={`chat-${activeHouseholdId}`}
            householdId={activeHouseholdId}
            household={activeHousehold}
            currentUser={currentUser}
            onHouseholdAccessError={handleHouseholdAccessError}
          />
        )}
        {activeHousehold && activeTab === "calendar" && (
          <CalendarSection
            key={`calendar-${activeHouseholdId}`}
            householdId={activeHouseholdId}
            roommates={activeHousehold.members || []}
            onHouseholdAccessError={handleHouseholdAccessError}
          />
        )}
      </main>
        </div>
      </div>
    </div>
  );
}
export default FairShareApp;
