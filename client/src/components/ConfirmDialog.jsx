function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }) {
    if (!isOpen) return null;

    return (
        <div 
            className="confirm-dialog-overlay"
            style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(20, 19, 18, 0.58)",
                backdropFilter: "blur(3px)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1000,
            }}
            onClick={onCancel}
        >
            <div 
                className="confirm-dialog"
                style={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "var(--radius-xl)",
                    padding: "2rem",
                    maxWidth: "400px",
                    width: "90%",
                    boxShadow: "var(--shadow-overlay)",
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <h3 style={{ 
                    margin: "0 0 1rem 0", 
                    color: "var(--text-dark)",
                    fontSize: "1.25rem"
                }}>
                    {title}
                </h3>
                <p style={{ 
                    margin: "0 0 1.5rem 0", 
                    color: "var(--text-light)",
                    lineHeight: "1.6"
                }}>
                    {message}
                </p>
                <div style={{ 
                    display: "flex", 
                    gap: "0.75rem", 
                    justifyContent: "flex-end" 
                }}>
                    <button 
                        onClick={onCancel}
                        className="btn btn-secondary"
                        style={{ minWidth: "80px" }}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={onConfirm}
                        className="btn btn-danger"
                        style={{ minWidth: "80px" }}
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ConfirmDialog;
