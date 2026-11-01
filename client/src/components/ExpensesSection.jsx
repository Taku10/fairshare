import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost, apiPut } from "../api";
import ConfirmDialog from "./ConfirmDialog";

function ExpensesSection({ householdId, roommates, onHouseholdAccessError }) {
    const [expenses, setExpenses] = useState([]);
    const [balances, setBalances] = useState([]);

    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [paidBy, setPaidBy] = useState("");
    const [splitBetween, setSplitBetween] = useState([]);
    const [error, setError] = useState("");
    const [editingExpenseId, setEditingExpenseId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 5;
    const [confirmDelete, setConfirmDelete] = useState(null);

    const fetchExpenses = useCallback(async () => {
        const res = await apiGet(`/households/${householdId}/expenses`);
        setExpenses(Array.isArray(res.data) ? res.data : []);
    }, [householdId]);

    const fetchBalances = useCallback(async () => {
        const res = await apiGet(`/households/${householdId}/expenses/balances/summary`);
        setBalances(Array.isArray(res.data) ? res.data : []);
    }, [householdId]);

    useEffect(() => {
        const load = async () => {
            try {
                await Promise.all([fetchExpenses(), fetchBalances()]);
            } catch (err) {
                console.error(err);
                setError("Failed to load expenses data");
                if (err.response?.status === 404) onHouseholdAccessError?.();
            }
        };
        load();
    }, [fetchBalances, fetchExpenses, householdId, onHouseholdAccessError]);

    async function handleAddExpense(e) {
        e.preventDefault();
        setError("");

        // Validation
        if (!description.trim()) {
            setError("Description is required");
            return;
        }

        if (description.trim().length > 100) {
            setError("Description must be less than 100 characters");
            return;
        }

        if (!amount || amount.trim() === "") {
            setError("Amount is required");
            return;
        }

        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount)) {
            setError("Amount must be a valid number");
            return;
        }

        if (parsedAmount <= 0) {
            setError("Amount must be greater than 0");
            return;
        }

        if (parsedAmount > 1000000) {
            setError("Amount must be less than $1,000,000");
            return;
        }

        if (!paidBy) {
            setError("Please select who paid");
            return;
        }

        if (splitBetween.length === 0) {
            setError("Please select at least one roommate to split between");
            return;
        }

        try {
            const payload = {
                description: description.trim(),
                amount: parsedAmount,
                paidBy,
                splitBetween,
            };

            let res;
            if (editingExpenseId) {
                res = await apiPut(`/households/${householdId}/expenses/${editingExpenseId}`, payload);
                setExpenses((prev) => prev.map((e) => (e._id === editingExpenseId ? res.data : e)));
            } else {
                res = await apiPost(`/households/${householdId}/expenses`, payload);
                setExpenses((prev) => [res.data, ...prev]);
            }

            setDescription("");
            setAmount("");
            setPaidBy("");
            setSplitBetween([]);
            setEditingExpenseId(null);
            setError("");
            fetchBalances();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Failed to save expense. Please try again.");
            if (err.response?.status === 404) onHouseholdAccessError?.();
        }
    }

    async function handleDeleteExpense(id) {
        setConfirmDelete(id);
    }

    async function confirmDeleteExpense() {
        const id = confirmDelete;
        setConfirmDelete(null);

        try {
            setError("");
            await apiDelete(`/households/${householdId}/expenses/${id}`);
            setExpenses((prev) => prev.filter((e) => e._id !== id));
            fetchBalances();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Failed to delete expense. Please try again.");
            if (err.response?.status === 404) onHouseholdAccessError?.();
        }
    }

    return (
        <div className="section">
            <ConfirmDialog
                isOpen={confirmDelete !== null}
                title="Delete Expense"
                message="Are you sure you want to delete this expense? This action cannot be undone."
                onConfirm={confirmDeleteExpense}
                onCancel={() => setConfirmDelete(null)}
            />
            <h2>Expenses</h2>
            <p style={{ color: "var(--text-light)", marginBottom: "1.5rem" }}>
                Add roommates in the Roommates tab first, then log expenses here and see who owes who.
            </p>

            <form onSubmit={handleAddExpense} className="form-group" style={{ flexDirection: "column" }}>
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    <input
                        type="text"
                        placeholder="Description (e.g. Rent, Wi-Fi)"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="form-input"
                        style={{ flex: 1, minWidth: "200px" }}
                    />
                    <input
                        type="number"
                        placeholder="$"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="form-input"
                        style={{ flex: 0, minWidth: "120px" }}
                        step="0.01"
                    />
                    <select
                        value={paidBy}
                        onChange={(e) => setPaidBy(e.target.value)}
                        className="form-select"
                        style={{ flex: 0, minWidth: "150px" }}
                    >
                        <option value="">Paid by...</option>
                        {roommates.map((rm) => (
                            <option key={rm._id} value={rm._id}>
                                {rm.displayName || (rm.email ? rm.email.split("@")[0] : "Roommate")}
                            </option>
                        ))}
                    </select>
                    <button type="submit" className="btn btn-primary">
                        {editingExpenseId ? "💾 Save" : "➕ Add"}
                    </button>
                    {editingExpenseId && (
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => {
                                setEditingExpenseId(null);
                                setDescription("");
                                setAmount("");
                                setPaidBy("");
                                setSplitBetween([]);
                            }}
                        >
                            ✖️ Cancel
                        </button>
                    )}
                </div>

                <div style={{ marginTop: "1rem" }}>
                    <strong style={{ display: "block", marginBottom: "0.5rem" }}>Split between:</strong>
                    <select
                        value=""
                        onChange={(e) => {
                            const id = e.target.value;
                            if (id && !splitBetween.includes(id)) {
                                setSplitBetween([...splitBetween, id]);
                            }
                        }}
                        className="form-select"
                    >
                        <option value="">Add roommate...</option>
                        {roommates
                            .filter(rm => !splitBetween.includes(rm._id))
                            .map((rm) => (
                                <option key={rm._id} value={rm._id}>
                                    {rm.displayName || (rm.email ? rm.email.split("@")[0] : "Roommate")}
                                </option>
                            ))
                        }
                    </select>
                    {splitBetween.length > 0 && (
                        <div style={{ 
                            marginTop: "0.75rem", 
                            display: "flex", 
                            flexWrap: "wrap", 
                            gap: "0.5rem" 
                        }}>
                            {splitBetween.map((id) => {
                                const rm = roommates.find(r => r._id === id);
                                if (!rm) return null;
                                return (
                                    <span
                                        key={id}
                                        style={{
                                            display: "inline-flex",
                                            alignItems: "center",
                                            gap: "0.5rem",
                                            background: "rgba(99, 102, 241, 0.12)",
                                            color: "var(--primary)",
                                            padding: "0.5rem 0.75rem",
                                            borderRadius: "999px",
                                            fontSize: "0.9rem",
                                            fontWeight: 600,
                                            border: "1px solid rgba(99, 102, 241, 0.2)"
                                        }}
                                    >
                                        {rm.displayName || (rm.email ? rm.email.split("@")[0] : "Roommate")}
                                        <button
                                            type="button"
                                            onClick={() => setSplitBetween(splitBetween.filter(x => x !== id))}
                                            style={{
                                                background: "none",
                                                border: "none",
                                                color: "var(--primary)",
                                                cursor: "pointer",
                                                fontSize: "1.1rem",
                                                lineHeight: 1,
                                                padding: 0,
                                                display: "flex",
                                                alignItems: "center"
                                            }}
                                        >
                                            ×
                                        </button>
                                    </span>
                                );
                            })}
                        </div>
                    )}
                </div>
            </form>

            {error && <div className="message message-error">{error}</div>}

            <div style={{ marginTop: "2rem" }}>
                <h3 style={{ fontSize: "1.3rem", marginBottom: "1rem", color: "var(--text-dark)" }}>Balances</h3>
                {balances.length === 0 ? (
                    <div className="empty-state">
                        <p className="empty-state-text">No expenses recorded yet</p>
                    </div>
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
                        {balances.map((b) => {
                            const positive = b.balance > 0;
                            const negative = b.balance < 0;
                            return (
                                <div
                                    key={b.roommateId}
                                    style={{
                                        padding: "0.85rem 1rem",
                                        borderRadius: "12px",
                                        border: "1px solid rgba(102, 126, 234, 0.2)",
                                        background: "rgba(255, 255, 255, 0.03)",
                                        backdropFilter: "blur(20px)",
                                        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "space-between",
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 700, color: "var(--text-dark)" }}>{b.name}</div>
                                        <div style={{ fontSize: "0.85rem", color: "var(--text-light)" }}>
                                            {negative ? "owes" : positive ? "is owed" : "settled"}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            fontSize: "1.1rem",
                                            fontWeight: 800,
                                            color: negative ? "#fca5a5" : positive ? "#86efac" : "var(--text-dark)",
                                            background: negative ? "rgba(248, 113, 113, 0.15)" : positive ? "rgba(34, 197, 94, 0.15)" : "rgba(255, 255, 255, 0.05)",
                                            border: negative ? "1px solid rgba(248, 113, 113, 0.3)" : positive ? "1px solid rgba(34, 197, 94, 0.3)" : "1px solid rgba(102, 126, 234, 0.2)",
                                            padding: "0.5rem 0.9rem",
                                            borderRadius: "8px",
                                            minWidth: "90px",
                                            textAlign: "right",
                                            backdropFilter: "blur(10px)"
                                        }}
                                    >
                                        {negative ? "−" : positive ? "+" : ""}${Math.abs(b.balance).toFixed(2)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div style={{ marginTop: "2rem" }}>
                <h3 style={{ fontSize: "1.3rem", marginBottom: "1rem", color: "var(--text-dark)" }}>All Expenses</h3>
                {expenses.length === 0 ? (
                    <div className="empty-state">
                        <div className="empty-state-icon">💰</div>
                        <p className="empty-state-text">No expenses yet. Add one to get started!</p>
                    </div>
                ) : (
                    <>
                        <ul className="list">
                            {(() => {
                                const startIndex = (currentPage - 1) * itemsPerPage;
                                const endIndex = startIndex + itemsPerPage;
                                const paginatedExpenses = expenses.slice(startIndex, endIndex);

                                return paginatedExpenses.map((exp) => (
                            <li key={exp._id} className="list-item">
                                <div className="list-item-content">
                                    <div className="list-item-title">
                                        {exp.description} <span style={{ color: "var(--primary)", fontWeight: "700" }}>
                                            ${Number(exp.amount).toFixed(2)}
                                        </span>
                                    </div>
                                    <div className="list-item-meta">
                                        <span>👤 Paid by: {exp.paidBy?.displayName || (exp.paidBy?.email ? exp.paidBy.email.split("@")[0] : "Unknown")}</span>
                                        <span>🔀 Split: {exp.splitBetween?.map((rm) => rm.displayName || (rm.email ? rm.email.split("@")[0] : "Roommate")).join(", ")}</span>
                                    </div>
                                </div>
                                <div className="list-item-actions">
                                    <button
                                        onClick={() => {
                                            setEditingExpenseId(exp._id);
                                            setDescription(exp.description || "");
                                            setAmount(String(exp.amount || ""));
                                            setPaidBy(exp.paidBy?._id || exp.paidBy || "");
                                            setSplitBetween(exp.splitBetween?.map((rm) => rm._id || rm) || []);
                                        }}
                                        className="btn btn-secondary"
                                    >
                                        Edit
                                    </button>
                                    <button onClick={() => handleDeleteExpense(exp._id)} className="btn btn-danger">
                                        Delete
                                    </button>
                                </div>
                            </li>
                                ));
                            })()}
                        </ul>
                        {(() => {
                            const totalPages = Math.ceil(expenses.length / itemsPerPage);
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
        </div>
    );
}

export default ExpensesSection;
