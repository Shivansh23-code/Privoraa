// src/pages/userApi.js

// Dummy: Simulates user registration
export const signUp = async (userData) => {
  console.log("Dummy signUp called with:", userData);
  return { token: "dummy-token", user: { name: userData.name, email: userData.email } };
};

// Dummy: Simulates user login
export const login = async (credentials) => {
  console.log("Dummy login called with:", credentials);
  return { token: "dummy-token", user: { name: "Demo User", email: credentials.email } };
};

// Dummy: Simulates user profile fetch
export const getUserProfile = async () => {
  return {
    data: {
      name: "Demo User",
      email: "demo@example.com",
      role: "user"
    }
  };
};

export default {};
