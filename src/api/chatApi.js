// src/pages/chatApi.js

// Dummy: Returns fake chat history
export const getHistory = async (userId) => {
  return {
    data: [
      { id: 1, sender: "user", message: "Hi, I need help!" },
      { id: 2, sender: "ai", message: "Sure! How can I assist you today?" }
    ]
  };
};

// Dummy: Simulates AI answer
export const askQuestion = async (payload) => {
  console.log("Dummy askQuestion called with:", payload);
  return {
    data: {
      answer: "This is a dummy AI response. No backend is connected."
    }
  };
};

export default {};
