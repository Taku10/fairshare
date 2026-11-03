import { useEffect, useState } from "react";
import { apiGet } from "../api";
import Button from "./Button";
import Card from "./Card";
import StatusMessage from "./StatusMessage";

function formatMoney(amount) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(Math.abs(amount));
}

function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function OverviewSection({ householdId, household, currentUserId, isOwner, onNavigate, onHouseholdAccessError }) {
  const [chores, setChores] = useState([]);
  const [balance, setBalance] = useState(0);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const [choresRes, balanceRes, eventsRes] = await Promise.all([
          apiGet(`/households/${householdId}/chores`),
          apiGet(`/households/${householdId}/expenses/balances/summary`),
          apiGet(`/households/${householdId}/events/upcoming`),
        ]);
        if (cancelled) return;
        setChores(Array.isArray(choresRes.data) ? choresRes.data : []);
        setBalance(balanceRes.data?.[0]?.balance || 0);
        setEvents(Array.isArray(eventsRes.data) ? eventsRes.data : []);
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load overview", err);
        setError("Could not load your overview. Please try again.");
        if (err.response?.status === 404) onHouseholdAccessError?.();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [householdId, onHouseholdAccessError]);

  if (loading) return <div className="loading">Loading overview...</div>;

  const myOpenChores = chores.filter(
    (chore) => !chore.completed && String(chore.assignedTo?._id || chore.assignedTo) === String(currentUserId)
  );
  const now = new Date();
  const overdueCount = myOpenChores.filter((chore) => chore.dueDate && new Date(chore.dueDate) < now).length;

  let balanceText = "You are all settled up.";
  let balanceClass = "";
  if (balance > 0.005) {
    balanceText = `You are owed ${formatMoney(balance)}`;
    balanceClass = "overview__amount--positive";
  } else if (balance < -0.005) {
    balanceText = `You owe ${formatMoney(balance)}`;
    balanceClass = "overview__amount--negative";
  }

  return (
    <div className="overview">
      {error && <StatusMessage variant="error">{error}</StatusMessage>}

      <div className="overview__actions" aria-label="Quick actions">
        <Button onClick={() => onNavigate("chores")}>Add chore</Button>
        <Button variant="secondary" onClick={() => onNavigate("expenses")}>Add expense</Button>
        {isOwner && (
          <Button variant="secondary" onClick={() => onNavigate("roommates")}>Invite member</Button>
        )}
      </div>

      <div className="overview__grid">
        <Card as="section" className="overview__card" aria-labelledby="overview-chores">
          <h3 id="overview-chores">My open chores</h3>
          {myOpenChores.length === 0 ? (
            <p className="overview__empty">Nothing assigned to you. Nice work!</p>
          ) : (
            <>
              {overdueCount > 0 && (
                <p className="overview__warning">{overdueCount} overdue</p>
              )}
              <ul className="overview__list">
                {myOpenChores.slice(0, 5).map((chore) => (
                  <li key={chore._id}>
                    <span>{chore.title}</span>
                    {chore.dueDate && <span className="overview__meta">Due {formatDate(chore.dueDate)}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
          <Button variant="secondary" onClick={() => onNavigate("chores")}>View all chores</Button>
        </Card>

        <Card as="section" className="overview__card" aria-labelledby="overview-balance">
          <h3 id="overview-balance">Current balance</h3>
          <p className={`overview__amount ${balanceClass}`}>{balanceText}</p>
          <Button variant="secondary" onClick={() => onNavigate("expenses")}>View expenses</Button>
        </Card>

        <Card as="section" className="overview__card" aria-labelledby="overview-events">
          <h3 id="overview-events">Upcoming events</h3>
          {events.length === 0 ? (
            <p className="overview__empty">No upcoming events.</p>
          ) : (
            <ul className="overview__list">
              {events.slice(0, 5).map((event) => (
                <li key={event._id}>
                  <span>{event.title}</span>
                  <span className="overview__meta">{formatDate(event.startDate)}</span>
                </li>
              ))}
            </ul>
          )}
          <Button variant="secondary" onClick={() => onNavigate("calendar")}>Open calendar</Button>
        </Card>

        <Card as="section" className="overview__card" aria-labelledby="overview-members">
          <h3 id="overview-members">{household.name}</h3>
          <p className="overview__empty">
            {household.members?.length || 0} {household.members?.length === 1 ? "member" : "members"}
          </p>
          <Button variant="secondary" onClick={() => onNavigate("roommates")}>View members</Button>
        </Card>
      </div>
    </div>
  );
}

export default OverviewSection;
