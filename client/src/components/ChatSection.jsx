import { useEffect, useState } from "react";
import { apiGet, apiPost } from "../api";
import HouseholdChat from "./HouseholdChat";

function ChatSection({ currentUser }) {
  const [households, setHouseholds] = useState([]);
  const [selectedHouseholdId, setSelectedHouseholdId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newHouseholdName, setNewHouseholdName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [householdMessages, setHouseholdMessages] = useState({});

  useEffect(() => {
    fetchHouseholdsAndSelect(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadSelectedHouseholdMessages = async () => {
      if (!selectedHouseholdId) return;
      try {
        const res = await apiGet(`/chat/${selectedHouseholdId}/chat`);
        setHouseholdMessages((prev) => ({ ...prev, [selectedHouseholdId]: Array.isArray(res.data) ? res.data : [] }));
      } catch (err) {
        console.error("Failed to load messages for selected household", selectedHouseholdId, err);
      }
    };
    loadSelectedHouseholdMessages();
  }, [selectedHouseholdId]);

  async function fetchHouseholdsAndSelect(firstLoad = false) {
    try {
      setLoading(true);
      const res = await apiGet("/households");
      const nextHouseholds = Array.isArray(res.data) ? res.data : [];
      setHouseholds(nextHouseholds);
      if ((firstLoad || !selectedHouseholdId) && nextHouseholds.length > 0) {
        setSelectedHouseholdId(nextHouseholds[0]._id);
      }
      await fetchAllHouseholdMessages(nextHouseholds);
    } catch (err) {
      console.error(err);
      setError("Failed to load households for chat");
    } finally {
      setLoading(false);
    }
  }

  async function fetchAllHouseholdMessages(householdList) {
    if (!householdList || householdList.length === 0) return;
    try {
      const messagesMap = {};
      await Promise.all(
        householdList.map(async (household) => {
          try {
            const res = await apiGet(`/chat/${household._id}/chat`);
            messagesMap[household._id] = Array.isArray(res.data) ? res.data : [];
          } catch (err) {
            console.error("Failed to load messages for household", household._id, err);
            messagesMap[household._id] = [];
          }
        })
      );
      setHouseholdMessages(messagesMap);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleCreateHousehold(e) {
    e.preventDefault();
    if (!newHouseholdName.trim()) return;
    try {
      setLoading(true);
      setError("");
      const res = await apiPost("/households", { name: newHouseholdName.trim() });
      const updatedHouseholds = [res.data, ...households];
      setHouseholds(updatedHouseholds);
      setSelectedHouseholdId(res.data._id);
      setNewHouseholdName("");
      fetchHouseholdsAndSelect();
    } catch (err) {
      console.error(err);
      setError("Could not create household");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinHousehold(e) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    try {
      setLoading(true);
      setError("");
      const res = await apiPost(`/households/join/${joinCode.trim()}`);
      const existing = households.find((household) => household._id === res.data._id);
      const updatedHouseholds = existing ? households : [res.data, ...households];
      setHouseholds(updatedHouseholds);
      setSelectedHouseholdId(res.data._id);
      setJoinCode("");
      try {
        const msgRes = await apiGet(`/chat/${res.data._id}/chat`);
        setHouseholdMessages((prev) => ({ ...prev, [res.data._id]: Array.isArray(msgRes.data) ? msgRes.data : [] }));
      } catch (msgErr) {
        console.error("Failed to load messages for joined household:", msgErr);
      }
      await fetchHouseholdsAndSelect();
    } catch (err) {
      console.error(err);
      setError("Invalid household invite code or join failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="section">
      <h2>Chat</h2>
      <p style={{ color: "var(--text-light)", marginBottom: "1rem" }}>
        Chat with members of your household. Select a household to join its chat.
      </p>

      {error && <div className="message message-error">{error}</div>}

      <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1rem" }}>
        <label style={{ fontWeight: 600 }}>Household:</label>
        <select
          value={selectedHouseholdId}
          onChange={(e) => setSelectedHouseholdId(e.target.value)}
          className="form-select"
          style={{ minWidth: "200px" }}
        >
          {households.map((household) => (
            <option key={household._id} value={household._id}>
              {household.name || "Household"}
            </option>
          ))}
        </select>
        <button type="button" className="btn btn-secondary" onClick={() => fetchHouseholdsAndSelect(true)}>
          Refresh
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        <form
          onSubmit={handleCreateHousehold}
          style={{ display: "flex", gap: "0.5rem", alignItems: "center", background: "var(--bg-light)", padding: "0.75rem", borderRadius: 8 }}
        >
          <input
            type="text"
            placeholder="New household name"
            value={newHouseholdName}
            onChange={(e) => setNewHouseholdName(e.target.value)}
            className="form-input"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary">
            Create
          </button>
        </form>
        <form
          onSubmit={handleJoinHousehold}
          style={{ display: "flex", gap: "0.5rem", alignItems: "center", background: "var(--bg-light)", padding: "0.75rem", borderRadius: 8 }}
        >
          <input
            type="text"
            placeholder="Enter household invite code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            className="form-input"
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-secondary">
            Join
          </button>
        </form>
      </div>

      {loading && (
        <div className="loading">
          <span className="loading-spinner"></span> Loading households...
        </div>
      )}

      {!loading && households.length === 0 && (
        <div className="empty-state">
          <p className="empty-state-text">No households yet. Create or join one to start chatting.</p>
        </div>
      )}

      {selectedHouseholdId && currentUser && (
        <HouseholdChat
          key={selectedHouseholdId}
          householdId={selectedHouseholdId}
          currentUser={currentUser}
          initialMessages={Array.isArray(householdMessages[selectedHouseholdId]) ? householdMessages[selectedHouseholdId] : []}
          household={households.find((item) => item._id === selectedHouseholdId)}
        />
      )}
    </div>
  );
}

export default ChatSection;
