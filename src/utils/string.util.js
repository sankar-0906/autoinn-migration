/**
 * Converts a string to Title Case.
 * @param {string} str 
 * @returns {Promise<string>}
 */
export default function titleCase(str) {
  return new Promise((resolve, reject) => {
    try {
      if (!str) return resolve("");
      const trimmed = str.trim();
      if (trimmed === "") return resolve("");
      
      const result = trimmed
        .split(" ")
        .map(([firstChar, ...rest]) => 
          firstChar.toUpperCase() + rest.join("").toLowerCase()
        )
        .join(" ");
      
      resolve(result);
    } catch (err) {
      reject("error while parsing to title case");
    }
  });
}
