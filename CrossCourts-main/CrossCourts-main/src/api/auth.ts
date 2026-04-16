import axios from "axios";
import { StoredUser, clearStoredAuth } from "../utils/auth";

const API_BASE_URL = "http://localhost:5000/api";

// ✅ Define Types for API Responses
interface AuthResponse {
  token: string;
  user: StoredUser & { role: "admin" | "operator" | "customer" };
}

interface RegisterResponse {
    message: string;
}

// ✅ Login API
export const login = async (email: string, password: string): Promise<AuthResponse> => {
    const response = await axios.post<AuthResponse>(`${API_BASE_URL}/auth/login`, { email, password });
    return response.data; // Returns { token }
};

// ✅ Register API
export const register = async (name: string, email: string, password: string): Promise<RegisterResponse> => {
    const response = await axios.post<RegisterResponse>(`${API_BASE_URL}/auth/register`, { name, email, password });
    return response.data; // Returns { message: "User registered successfully" }
};

// ✅ Logout (Clear Token)
export const logout = (): void => {
  clearStoredAuth();
};

// ✅ Check Authentication
export const isAuthenticated = (): boolean => {
    return localStorage.getItem("token") !== null;
};
