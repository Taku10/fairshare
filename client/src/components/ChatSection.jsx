import { useEffect, useState } from "react";
import { apiGet } from "../api";
import HouseholdChat from "./HouseholdChat";

function ChatSection({ householdId, household, currentUser, onHouseholdAccessError }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadMessages() {
      try {
        setLoading(true);
        const res = await apiGet(`/households/${householdId}/messages`);
        if (active) {
          setMessages(Array.isArray(res.data) ? res.data : []);
          setError("");
        }
      } catch (err) {
        console.error("Failed to load household messages", err);
        if (active) {
          setError("Failed to load messages for this household.");
          if (err.response?.status === 404) onHouseholdAccessError?.();
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadMessages();
    return () => {
      active = false;
    };
  }, [householdId, onHouseholdAccessError]);

  return (
    <div className="section">
      <h2>Chat</h2>
      {error && <div className="message message-error" role="alert">{error}</div>}
      {loading && <div className="loading">Loading messages...</div>}
      {currentUser && (
        <HouseholdChat
          key={householdId}
          householdId={householdId}
          currentUser={currentUser}
          initialMessages={messages}
          household={household}
          onHouseholdAccessError={onHouseholdAccessError}
        />
      )}
    </div>
  );
}

export default ChatSection;
