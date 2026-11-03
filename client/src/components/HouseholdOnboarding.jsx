import { useState } from "react";
import { apiGet, apiPost } from "../api";
import Button from "./Button";
import Card from "./Card";
import StatusMessage from "./StatusMessage";

const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{10}$/;

function HouseholdOnboarding({ onComplete }) {
  const [mode, setMode] = useState("choose");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [created, setCreated] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  function reset(nextMode) {
    setMode(nextMode);
    setError("");
    setPreview(null);
    setCreated(null);
    setCopied(false);
  }

  async function handleCreate(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      setBusy(true);
      setError("");
      const res = await apiPost("/households", { name: trimmed });
      setCreated(res.data);
    } catch (err) {
      setError(err.response?.data?.error || "Could not create household.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(created.code);
      setCopied(true);
    } catch {
      setError("Could not copy the code. Select it and copy it manually.");
    }
  }

  async function handleLookup(event) {
    event.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!CODE_PATTERN.test(trimmed)) {
      setError("Enter the 10-character invitation code.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const res = await apiGet(`/households/join/${encodeURIComponent(trimmed)}`);
      setPreview(res.data);
    } catch (err) {
      setPreview(null);
      setError(err.response?.data?.error || "Could not check that code. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmJoin() {
    try {
      setBusy(true);
      setError("");
      const res = await apiPost(`/households/join/${encodeURIComponent(code.trim().toUpperCase())}`);
      onComplete(res.data._id);
    } catch (err) {
      setError(err.response?.data?.error || "Could not join household. Try again.");
      setBusy(false);
    }
  }

  return (
    <section className="onboarding" aria-labelledby="onboarding-title">
      <div className="onboarding__intro">
        <h2 id="onboarding-title" className="onboarding__title">Welcome to FairShare</h2>
        <p className="onboarding__lead">Set up your household to start sharing chores, expenses and plans.</p>
      </div>

      {error && <StatusMessage variant="error">{error}</StatusMessage>}

      {mode === "choose" && (
        <div className="onboarding__choices">
          <Card className="onboarding__choice">
            <h3>Create a household</h3>
            <p>Start a new household and invite others.</p>
            <Button onClick={() => reset("create")}>Create a household</Button>
          </Card>
          <Card className="onboarding__choice">
            <h3>Join a household</h3>
            <p>Enter an invitation code from another member.</p>
            <Button variant="secondary" onClick={() => reset("join")}>Join a household</Button>
          </Card>
        </div>
      )}

      {mode === "create" && !created && (
        <Card className="onboarding__panel">
          <form onSubmit={handleCreate} className="onboarding__form">
            <h3>Name your household</h3>
            <label htmlFor="onboarding-name" className="visually-hidden">Household name</label>
            <input
              id="onboarding-name"
              className="form-input"
              maxLength={100}
              placeholder="e.g. 12 Oak Street"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
            <div className="onboarding__actions">
              <Button variant="secondary" onClick={() => reset("choose")} disabled={busy}>Back</Button>
              <Button type="submit" loading={busy} loadingLabel="Creating household" disabled={!name.trim()}>
                Create household
              </Button>
            </div>
          </form>
        </Card>
      )}

      {mode === "create" && created && (
        <Card className="onboarding__panel">
          <h3>{created.name} is ready</h3>
          <p>Share this code with the people you live with. It expires on {new Date(created.codeExpiresAt).toLocaleDateString()}.</p>
          <div className="onboarding__code">
            <code aria-label="Invitation code">{created.code}</code>
            <Button variant="secondary" onClick={handleCopy}>{copied ? "Copied" : "Copy code"}</Button>
          </div>
          <p role="status" className="visually-hidden">{copied ? "Invitation code copied" : ""}</p>
          <div className="onboarding__actions">
            <Button onClick={() => onComplete(created._id)}>Continue to overview</Button>
          </div>
        </Card>
      )}

      {mode === "join" && !preview && (
        <Card className="onboarding__panel">
          <form onSubmit={handleLookup} className="onboarding__form">
            <h3>Enter your invitation code</h3>
            <label htmlFor="onboarding-code" className="visually-hidden">Invitation code</label>
            <input
              id="onboarding-code"
              className="form-input onboarding__code-input"
              maxLength={10}
              placeholder="Invitation code"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              autoComplete="off"
              autoFocus
            />
            <div className="onboarding__actions">
              <Button variant="secondary" onClick={() => reset("choose")} disabled={busy}>Back</Button>
              <Button type="submit" loading={busy} loadingLabel="Checking code" disabled={!code.trim()}>
                Continue
              </Button>
            </div>
          </form>
        </Card>
      )}

      {mode === "join" && preview && (
        <Card className="onboarding__panel">
          <h3>Join {preview.name}?</h3>
          <p>
            {preview.memberCount} {preview.memberCount === 1 ? "member" : "members"} already in this household.
          </p>
          <div className="onboarding__actions">
            <Button variant="secondary" onClick={() => { setPreview(null); setError(""); }} disabled={busy}>
              Use a different code
            </Button>
            <Button onClick={handleConfirmJoin} loading={busy} loadingLabel="Joining household">
              Join household
            </Button>
          </div>
        </Card>
      )}
    </section>
  );
}

export default HouseholdOnboarding;
