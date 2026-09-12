// client/src/App.jsx
import { useState } from "react";
import { useAuth } from "./AuthContext.jsx";
import AuthPage from "./AuthPage.jsx"; // login/register screen
import LandingPage from "./LandingPage.jsx";
import FairShareApp from "./FairShareApp.jsx";

function App() {
  const [showAuth, setShowAuth] = useState(false);
  const { currentUser, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        Loading authentication...
      </div>
    );
  }

  if (!currentUser) {
    if (!showAuth) {
      return <LandingPage onGetStarted={() => setShowAuth(true)} />;
    }

    // Not logged in -> show Firebase login/register page
    return <AuthPage onBack={() => setShowAuth(false)} />;
  }

  // Logged in -> show the real app
  return <FairShareApp currentUser={currentUser} />;
}

export default App;
