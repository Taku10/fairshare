import { updatePassword } from "firebase/auth";
import { useEffect, useState } from "react";
import { apiGet, apiPut } from "../api";
import { useAuth } from "../AuthContext";

function ProfileSection({ onClose }) {
    const { currentUser, logout } = useAuth();
    const [profile, setProfile] = useState(null);
    const [displayName, setDisplayName] = useState("");
    const [bio, setBio] = useState("");
    const [profilePicture, setProfilePicture] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        loadProfile();
    }, []);

    async function loadProfile() {
        try {
            setLoading(true);
            const res = await apiGet("/roommates/me");
            setProfile(res.data);
            setDisplayName(res.data.displayName || "");
            setBio(res.data.bio || "");
            setProfilePicture(res.data.profilePicture || "");
            setError("");
        } catch (err) {
            console.error(err);
            setError("Failed to load profile");
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveProfile(e) {
        e.preventDefault();
        setError("");
        setSuccess("");

        // Validation
        if (displayName.trim() && displayName.trim().length > 50) {
            setError("Display name must be less than 50 characters");
            return;
        }

        if (bio.trim() && bio.trim().length > 500) {
            setError("Bio must be less than 500 characters");
            return;
        }

        try {
            setLoading(true);
            const res = await apiPut("/roommates/me", {
                displayName: displayName.trim() || undefined,
                bio: bio.trim() || undefined,
                profilePicture: profilePicture.trim() || undefined,
            });
            setProfile(res.data);
            setSuccess("Profile updated successfully!");
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || "Failed to update profile. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    async function handleChangePassword(e) {
        e.preventDefault();
        setError("");
        setSuccess("");

        if (!newPassword || !newPassword.trim()) {
            setError("New password is required");
            return;
        }

        if (newPassword.length < 6) {
            setError("Password must be at least 6 characters");
            return;
        }

        if (newPassword.length > 128) {
            setError("Password must be less than 128 characters");
            return;
        }

        if (!confirmPassword) {
            setError("Please confirm your password");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        try {
            setLoading(true);
            await updatePassword(currentUser, newPassword);
            setNewPassword("");
            setConfirmPassword("");
            setSuccess("Password changed successfully!");
            setTimeout(() => setSuccess(""), 3000);
        } catch (err) {
            console.error(err);
            if (err.code === "auth/requires-recent-login") {
                setError("Please log out and log back in before changing your password");
            } else if (err.code === "auth/weak-password") {
                setError("Password is too weak. Please use a stronger password");
            } else {
                setError("Failed to change password. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    }

    function handleImageChange(e) {
        const file = e.target.files?.[0];
        if (!file) return;

        setError("");

        // Check file type
        const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
        if (!allowedTypes.includes(file.type)) {
            setError("Please upload a valid image file (JPEG, PNG, GIF, or WebP)");
            e.target.value = ""; // Reset input
            return;
        }

        // Check file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            setError("Image must be less than 5MB");
            e.target.value = ""; // Reset input
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setProfilePicture(reader.result);
        };
        reader.onerror = () => {
            setError("Failed to read image file. Please try again.");
        };
        reader.readAsDataURL(file);
    }

    if (loading && !profile) {
        return (
            <div className="section">
                <div className="loading">
                    <span className="loading-spinner"></span> Loading profile...
                </div>
            </div>
        );
    }

    return (
        <div className="section">
            <div style={{ textAlign: "center", marginBottom: "2rem" }}>
                <h2 style={{ marginBottom: "0.5rem" }}>
                    {profile?.displayName || "Edit Profile"}
                </h2>
                <p style={{ color: "var(--text-light)", fontSize: "0.9rem" }}>
                    {profile?.email}
                </p>
            </div>
            <p style={{ color: "var(--text-light)", marginBottom: "2rem", textAlign: "center" }}>
                Update your profile information and settings
            </p>

            {error && <div className="message message-error">{error}</div>}
            {success && <div className="message message-success">{success}</div>}

            {/* Profile Picture */}
            <div style={{ marginBottom: "2rem", textAlign: "center" }}>
                <div style={{
                    width: "120px",
                    height: "120px",
                    borderRadius: "50%",
                    margin: "0 auto 1rem",
                    overflow: "hidden",
                    border: "3px solid var(--primary)",
                    boxShadow: "0 0 0 4px var(--color-primary-light)",
                    background: profilePicture ? `url(${profilePicture})` : "var(--color-primary-light)",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "3rem"
                }}>
                    {!profilePicture && "👤"}
                </div>
                <label htmlFor="profile-pic-upload" className="btn btn-secondary" style={{ cursor: "pointer" }}>
                    📷 Change Picture
                </label>
                <input
                    id="profile-pic-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ display: "none" }}
                />
            </div>

            {/* Profile Form */}
            <form onSubmit={handleSaveProfile} style={{ marginBottom: "2rem" }}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "var(--text-dark)" }}>
                    Profile Information
                </h3>
                <div className="form-group" style={{ flexDirection: "column" }}>
                    <div style={{ width: "100%" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-light)" }}>
                            Display Name
                        </label>
                        <input
                            type="text"
                            placeholder="Your name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            className="form-input"
                            style={{ width: "100%" }}
                        />
                    </div>
                    <div style={{ width: "100%" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-light)" }}>
                            Email (cannot be changed)
                        </label>
                        <input
                            type="email"
                            value={profile?.email || ""}
                            disabled
                            className="form-input"
                            style={{ width: "100%", opacity: 0.6, cursor: "not-allowed" }}
                        />
                    </div>
                    <div style={{ width: "100%" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-light)" }}>
                            Bio
                        </label>
                        <textarea
                            placeholder="Tell your roommates about yourself..."
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            className="form-textarea"
                            style={{ width: "100%", minHeight: "100px" }}
                            maxLength={200}
                        />
                        <div style={{ fontSize: "0.8rem", color: "var(--text-light)", textAlign: "right", marginTop: "0.25rem" }}>
                            {bio.length}/200
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? "Saving..." : "💾 Save Profile"}
                    </button>
                </div>
            </form>

            {/* Password Change Form */}
            <form onSubmit={handleChangePassword}>
                <h3 style={{ fontSize: "1.2rem", marginBottom: "1rem", color: "var(--text-dark)" }}>
                    Change Password
                </h3>
                <div className="form-group" style={{ flexDirection: "column" }}>
                    <div style={{ width: "100%" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-light)" }}>
                            New Password
                        </label>
                        <input
                            type="password"
                            placeholder="At least 6 characters"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="form-input"
                            style={{ width: "100%" }}
                        />
                    </div>
                    <div style={{ width: "100%" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.9rem", color: "var(--text-light)" }}>
                            Confirm New Password
                        </label>
                        <input
                            type="password"
                            placeholder="Re-enter your password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="form-input"
                            style={{ width: "100%" }}
                        />
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? "Changing..." : "🔐 Change Password"}
                    </button>
                </div>
            </form>

            {/* Logout Button */}
            <div style={{ 
                marginTop: "2rem", 
                paddingTop: "2rem", 
                borderTop: "1px solid var(--border)" 
            }}>
                <button
                    onClick={async () => {
                        await logout();
                        if (onClose) onClose();
                    }}
                    className="btn btn-danger"
                    style={{ width: "100%" }}
                >
                    🚪 Logout
                </button>
            </div>
        </div>
    );
}

export default ProfileSection;
