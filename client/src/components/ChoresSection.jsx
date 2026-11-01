import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../api";
import ConfirmDialog from "./ConfirmDialog";

function ChoresSection({ householdId, roommates, onHouseholdAccessError }) {
    const [chores, setChores] = useState([]);
    const [title, setTitle] = useState("");
    const [assignedTo, setAssignedTo] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [editingChoreId, setEditingChoreId] = useState(null);
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");
    const [filterAssignee, setFilterAssignee] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const [confirmDelete, setConfirmDelete] = useState(null);

    const fetchChores = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiGet(`/households/${householdId}/chores`);
            setChores(Array.isArray(res.data) ? res.data : []);
            setError("");
        } catch (err) {
            console.error(err);
            setError("Failed to load chores");
            if (err.response?.status === 404) onHouseholdAccessError?.();
        } finally {
            setLoading(false);
        }
    }, [householdId, onHouseholdAccessError]);

    useEffect(() => {
        fetchChores();
    }, [fetchChores]);

    async function handleAddChore(e) {
        e.preventDefault();
        setError("");

        // Validation
        if (!title.trim()) {
            setError("Chore title is required");
            return;
        }

        if (title.trim().length > 100) {
            setError("Chore title must be less than 100 characters");
            return;
        }

        try {
            const payload = { title: title.trim(), assignedTo: assignedTo || undefined };
            let res;
            if (editingChoreId) {
                res = await apiPut(`/households/${householdId}/chores/${editingChoreId}`, payload);
                setChores((prev) => prev.map((c) => (c._id === editingChoreId ? res.data : c)));
            } else {
                res = await apiPost(`/households/${householdId}/chores`, payload);
                setChores((prev) => [res.data, ...prev]);
            }

            setTitle("");
            setAssignedTo("");
            setEditingChoreId(null);
            setError("");
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Failed to save chore. Please try again.");
        }
    }

    async function handleDeleteChore(id) {
        setConfirmDelete(id);
    }

    async function confirmDeleteChore() {
        const id = confirmDelete;
        setConfirmDelete(null);

        try {
            setError("");
            await apiDelete(`/households/${householdId}/chores/${id}`);
            setChores((prev) => prev.filter((c) => c._id !== id));
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Failed to delete chore. Please try again.");
        }
    }

    async function toggleComplete(chore) {
        try {
            const res = await apiPut(`/households/${householdId}/chores/${chore._id}`, { completed: !chore.completed });
            setChores((prev) => prev.map((c) => (c._id === chore._id ? res.data : c)));
        } catch (err) {
            console.error(err);
            setError("Failed to update chore");
        }
    }

    return (
        <div className="section">
            <ConfirmDialog
                isOpen={confirmDelete !== null}
                title="Delete Chore"
                message="Are you sure you want to delete this chore? This action cannot be undone."
                onConfirm={confirmDeleteChore}
                onCancel={() => setConfirmDelete(null)}
            />
            <h2>Chores</h2>

            <form onSubmit={handleAddChore} className="form-group">
                <input
                    type="text"
                    placeholder="Enter chore title..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="form-input"
                />
                <select
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    className="form-select"
                >
                    <option value="">Unassigned</option>
                    {roommates.map((rm) => (
                        <option key={rm._id} value={rm._id}>
                            {rm.displayName || rm.email?.split("@")[0] || "Roommate"}
                        </option>
                    ))}
                </select>
                <button type="submit" className="btn btn-primary">
                    {editingChoreId ? "💾 Save" : "➕ Add"}
                </button>
                {editingChoreId && (
                    <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                            setEditingChoreId(null);
                            setTitle("");
                            setAssignedTo("");
                        }}
                    >
                        ✖️ Cancel
                    </button>
                )}
            </form>

            <div className="form-group" style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <input
                    type="text"
                    placeholder="Search chores by title..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="form-input"
                    style={{ flex: 1, minWidth: "200px" }}
                />
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: "0.9rem", color: "var(--text-light)" }}>Status:</span>
                    {["all", "open", "completed"].map((s) => (
                        <button
                            key={s}
                            type="button"
                            className={`btn ${filterStatus === s ? "btn-primary" : "btn-secondary"}`}
                            onClick={() => setFilterStatus(s)}
                        >
                            {s === "all" ? "All" : s === "open" ? "Open" : "Completed"}
                        </button>
                    ))}
                </div>
                <select
                    value={filterAssignee}
                    onChange={(e) => setFilterAssignee(e.target.value)}
                    className="form-select"
                    style={{ minWidth: "150px" }}
                >
                    <option value="all">All Assignees</option>
                    <option value="unassigned">Unassigned</option>
                    {roommates.map((rm) => (
                        <option key={rm._id} value={rm._id}>
                            {rm.displayName || rm.email?.split("@")[0] || "Roommate"}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                        setSearch("");
                        setFilterStatus("all");
                        setFilterAssignee("all");
                    }}
                >
                    Reset
                </button>
            </div>

            {loading && (
                <div className="loading">
                    <span className="loading-spinner"></span> Loading chores...
                </div>
            )}
            {error && <div className="message message-error">{error}</div>}

            {chores.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <p className="empty-state-text">No chores yet. Add one to get started!</p>
                </div>
            ) : (
                <>
                    <ul className="list">
                        {(() => {
                            const filtered = chores.filter((chore) => {
                                const q = search.trim().toLowerCase();
                                const matchesSearch = !q || chore.title?.toLowerCase().includes(q);
                                const matchesStatus =
                                    filterStatus === "all"
                                        ? true
                                        : filterStatus === "completed"
                                            ? !!chore.completed
                                            : !chore.completed;
                                const matchesAssignee =
                                    filterAssignee === "all"
                                        ? true
                                        : filterAssignee === "unassigned"
                                            ? !chore.assignedTo
                                            : chore.assignedTo?._id === filterAssignee || chore.assignedTo === filterAssignee;

                                return matchesSearch && matchesStatus && matchesAssignee;
                            });
                            const startIndex = (currentPage - 1) * itemsPerPage;
                            const endIndex = startIndex + itemsPerPage;
                            const paginatedChores = filtered.slice(startIndex, endIndex);

                            return paginatedChores.map((chore) => (
                            <li key={chore._id} className={`list-item ${chore.completed ? "completed" : ""}`}>
                                <div className="list-item-content">
                                    <div className={`list-item-title ${chore.completed ? "list-item-completed" : ""}`}>
                                        {chore.title}
                                    </div>
                                    <div className="list-item-meta">
                                        {chore.assignedTo ? (
                                            <span className="list-item-badge">
                                                👤 {chore.assignedTo.displayName || (chore.assignedTo.email ? chore.assignedTo.email.split("@")[0] : "Roommate")}
                                            </span>
                                        ) : (
                                            <span className="list-item-badge" style={{ opacity: 0.6 }}>Unassigned</span>
                                        )}
                                        {chore.completed && <span style={{ color: "var(--success)" }}>✓ Completed</span>}
                                    </div>
                                </div>
                                <div className="list-item-actions">
                                    <button onClick={() => toggleComplete(chore)} className={`btn ${chore.completed ? "btn-secondary" : "btn-success"}`}>
                                        {chore.completed ? "Undo" : "Done"}
                                    </button>
                                    <button
                                        onClick={() => {
                                            setEditingChoreId(chore._id);
                                            setTitle(chore.title);
                                            setAssignedTo(chore.assignedTo?._id || chore.assignedTo || "");
                                        }}
                                        className="btn btn-secondary"
                                    >
                                        Edit
                                    </button>
                                    <button onClick={() => handleDeleteChore(chore._id)} className="btn btn-danger">
                                        Delete
                                    </button>
                                </div>
                            </li>
                            ));
                        })()}
                    </ul>
                    {(() => {
                        const filtered = chores.filter((chore) => {
                            const q = search.trim().toLowerCase();
                            const matchesSearch = !q || chore.title?.toLowerCase().includes(q);
                            const matchesStatus =
                                filterStatus === "all" ? true : filterStatus === "completed" ? !!chore.completed : !chore.completed;
                            const matchesAssignee =
                                filterAssignee === "all"
                                    ? true
                                    : filterAssignee === "unassigned"
                                        ? !chore.assignedTo
                                        : chore.assignedTo?._id === filterAssignee || chore.assignedTo === filterAssignee;
                            return matchesSearch && matchesStatus && matchesAssignee;
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

export default ChoresSection;
