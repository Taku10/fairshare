import { useState } from "react";
import { apiDelete } from "../api";
import ConfirmDialog from "./ConfirmDialog";

function RoommatesSection({
  householdId,
  roommates,
  currentUserId,
  isOwner,
  onHouseholdAccessError,
  onMembersChanged,
}) {
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [confirmDelete, setConfirmDelete] = useState(null);
  const visibleRoommates = (roommates || []).filter(
    (roommate) => !isOwner || String(roommate._id) !== String(currentUserId)
  );

  async function handleDeleteRoommate(id) {
    setConfirmDelete(id);
  }

  async function confirmDeleteRoommate() {
    const id = confirmDelete;
    setConfirmDelete(null);

    try {
      setError("");
      await apiDelete(`/households/${householdId}/members/${id}`);
      await onMembersChanged?.();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to update household membership. Please try again.");
      if (err.response?.status === 404) onHouseholdAccessError?.();
    }
  }

  return (
    <div className="section">
      <ConfirmDialog
        isOpen={confirmDelete !== null}
        title={String(confirmDelete) === String(currentUserId) ? "Leave Household" : "Remove Member"}
        message={String(confirmDelete) === String(currentUserId)
          ? "Are you sure you want to leave this household?"
          : "Are you sure you want to remove this member from the household?"}
        onConfirm={confirmDeleteRoommate}
        onCancel={() => setConfirmDelete(null)}
      />
      <h2>Roommates</h2>
      <p style={{ color: "var(--text-light)", marginBottom: "1.5rem" }}>
        Members are listed only for the active household.
      </p>

      {error && <div className="message message-error">{error}</div>}

      {/* Search Bar */}
      <div className="form-group" style={{ marginBottom: "1.5rem" }}>
        <input
          type="text"
          placeholder="Search roommates by name or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="form-input"
          style={{ flex: 1 }}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="btn btn-secondary"
          >
            Clear
          </button>
        )}
      </div>

      {visibleRoommates.length === 0 ? (
        <div className="empty-state">
          <p className="empty-state-text">No other members in this household yet.</p>
        </div>
      ) : (
        <>
          <ul className="list">
            {(() => {
              const filtered = visibleRoommates.filter((rm) => {
                const q = search.trim().toLowerCase();
                if (!q) return true;
                const name = (rm.displayName || "").toLowerCase();
                const email = (rm.email || "").toLowerCase();
                return name.includes(q) || email.includes(q);
              });
              const startIndex = (currentPage - 1) * itemsPerPage;
              const endIndex = startIndex + itemsPerPage;
              const paginatedRoommates = filtered.slice(startIndex, endIndex);

              if (filtered.length === 0) {
                return (
                  <div className="empty-state" style={{ margin: "2rem 0" }}>
                    <p className="empty-state-text">No roommates found matching "{search}"</p>
                  </div>
                );
              }

              return paginatedRoommates.map((rm) => {
                const name = rm.displayName || "Roommate";
                const initials = name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase();
                return (
                  <li key={rm._id} className="list-item">
                    <div className="list-item-content" style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div
                        aria-label="profile-avatar"
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: "var(--bg-light)",
                          border: "1px solid #e5e7eb",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 700,
                          color: "var(--text-dark)",
                        }}
                      >
                        {initials}
                      </div>
                      <div className="list-item-title" style={{ fontWeight: 600 }}>{name}</div>
                    </div>
                    {isOwner && String(rm._id) !== String(currentUserId) && (
                      <div className="list-item-actions">
                        <button onClick={() => handleDeleteRoommate(rm._id)} className="btn btn-danger">
                          Remove
                        </button>
                      </div>
                    )}
                    {!isOwner && String(rm._id) === String(currentUserId) && (
                      <div className="list-item-actions">
                        <button onClick={() => handleDeleteRoommate(rm._id)} className="btn btn-secondary">
                          Leave household
                        </button>
                      </div>
                    )}
                  </li>
                );
              });
            })()}
          </ul>
          {(() => {
            const filtered = visibleRoommates.filter((rm) => {
              const q = search.trim().toLowerCase();
              if (!q) return true;
              const name = (rm.displayName || "").toLowerCase();
              const email = (rm.email || "").toLowerCase();
              return name.includes(q) || email.includes(q);
            });
            const totalPages = Math.ceil(filtered.length / itemsPerPage);
            if (totalPages <= 1) return null;

            return (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem", marginTop: "1.5rem" }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="btn btn-secondary"
                  style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? "not-allowed" : "pointer" }}
                >
                  ← Prev
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`btn ${currentPage === page ? "btn-primary" : "btn-secondary"}`}
                    style={{ minWidth: "40px" }}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="btn btn-secondary"
                  style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? "not-allowed" : "pointer" }}
                >
                  Next →
                </button>
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}

export default RoommatesSection;
