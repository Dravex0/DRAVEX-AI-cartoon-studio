const clean = (value, max) => String(value ?? "").trim().slice(0, max);
const SUPPORTED_LANGUAGES = new Set(["en", "ru", "uk", "es"]);

/**
 * Parse the scene editor's one-speaker-per-line format.
 * Lines without a speaker prefix are preserved as Narrator lines rather than discarded.
 */
export function parseDialogueLines(input, language = "en") {
  const locale = SUPPORTED_LANGUAGES.has(String(language)) ? String(language) : "en";
  return String(input ?? "")
    .split(/\r?\n/u)
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map(line => {
      const match = line.match(/^([^:—–]{1,120}?)\s*(?::|—|–)\s*(.{1,2000})$/u);
      return {
        characterId: match ? clean(match[1], 120) : "Narrator",
        text: clean(match ? match[2] : line, 2000),
        language: locale
      };
    })
    .filter(line => line.text);
}

export function formatDialogueLines(dialogue) {
  if (!Array.isArray(dialogue)) return "";
  return dialogue
    .filter(line => line && typeof line === "object" && clean(line.text, 2000))
    .slice(0, 30)
    .map(line => (clean(line.characterId, 120) || "Narrator") + ": " + clean(line.text, 2000))
    .join("\n");
}
