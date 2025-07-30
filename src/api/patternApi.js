// src/pages/patternApi.js

// Dummy: Simulates pattern list
export const getPatterns = async () => {
  return [
    { id: 1, name: "Pattern A", description: "Dummy pattern A" },
    { id: 2, name: "Pattern B", description: "Dummy pattern B" }
  ];
};

// Dummy: Logs new pattern creation
export const createPattern = async (pattern) => {
  console.log("Dummy createPattern called with:", pattern);
  return { id: Date.now(), ...pattern };
};

// Dummy: Logs pattern update
export const updatePattern = async (id, pattern) => {
  console.log(`Dummy updatePattern for ID ${id}:`, pattern);
  return { id, ...pattern };
};

// Dummy: Logs deletion
export const deletePattern = async (id) => {
  console.log(`Dummy deletePattern called for ID ${id}`);
};
