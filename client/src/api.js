// client/src/api.js
import axios from "axios";
import { auth } from "./firebase";

const DEFAULT_API_BASE =
  typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
    ? "http://localhost:5000/api"
    : `${window.location.origin}/api`;

const API_BASE = import.meta.env.VITE_API_BASE || DEFAULT_API_BASE;

// Helper to get token from current user
async function getAuthToken() {
  try {
    const user = auth.currentUser;
    if (!user) {
      const err = new Error("No authenticated user");
      console.warn(err.message);
      throw err;
    }
    const token = await user.getIdToken(true); // Force refresh of the 
    return token;
  } catch (error) {
    console.error("Failed to get auth token:", error);
    throw error;
  }
}

export async function apiGet(path) {
  try {
    const token = await getAuthToken();
    return await axios.get(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.error('apiGet error:', path, err);
    throw err;
  }
}

export async function apiPost(path, data) {
  try {
    const token = await getAuthToken();
    return await axios.post(`${API_BASE}${path}`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.error('apiPost error:', path, data, err);
    throw err;
  }
}

export async function apiPut(path, data) {
  try {
    const token = await getAuthToken();
    return await axios.put(`${API_BASE}${path}`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.error('apiPut error:', path, data, err);
    throw err;
  }
}

export async function apiPatch(path, data) {
  try {
    const token = await getAuthToken();
    return await axios.patch(`${API_BASE}${path}`, data, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.error('apiPatch error:', path, data, err);
    throw err;
  }
}

export async function apiDelete(path) {
  try {
    const token = await getAuthToken();
    return await axios.delete(`${API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.error('apiDelete error:', path, err);
    throw err;
  }
}
