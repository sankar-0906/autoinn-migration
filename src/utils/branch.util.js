/**
 * Normalizes branch IDs from various input formats (single string, array of strings, array of objects).
 * @param {any} branchInput - The branch input to normalize.
 * @param {string[]} fallbackBranches - Fallback branches (e.g., from req.user.branch).
 * @returns {string[]} An array of branch ID strings.
 */
export const normalizeBranchIds = (branchInput, fallbackBranches = []) => {
  const input = branchInput || fallbackBranches || [];
  const arrayInput = Array.isArray(input) ? input : [input];
  return arrayInput
    .map(b => (typeof b === 'object' && b !== null) ? b.id : b)
    .filter(b => typeof b === 'string' && b.length > 0);
};
