/**
 * Converts a string to Title Case.
 * Example: "hello world" -> "Hello World"
 */
export default function titleCase(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
