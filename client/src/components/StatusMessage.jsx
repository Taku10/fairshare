const STATUS_ROLES = {
  error: "alert",
  success: "status",
  warning: "status",
  info: "status",
};

function StatusMessage({ variant = "info", children, className = "", ...props }) {
  const classes = ["message", `message-${variant}`, className].filter(Boolean).join(" ");
  return (
    <div {...props} className={classes} role={STATUS_ROLES[variant] || "status"}>
      {children}
    </div>
  );
}

export default StatusMessage;
