import { it, expect } from "vitest";
import { generate, groups, passphrase, words } from "../../src/lib/password";
it("generates configured lengths and required character groups", () => {
  for (const length of [12, 20, 64]) {
    const value = generate(length, ["upper", "lower", "numbers", "symbols"]);
    expect(value.length).toBe(length);
    for (const group of Object.values(groups))
      expect([...value].some((c) => group.includes(c))).toBe(true);
  }
});
it("supports a single selected alphabet", () =>
  expect(generate(64, ["numbers"])).toMatch(/^\d{64}$/));
it("rejects impossible options", () => {
  expect(() => generate(11, ["upper"])).toThrow();
  expect(() => generate(65, ["lower"])).toThrow();
  expect(() => generate(20, [])).toThrow();
});
it("generates eight words from the local dictionary", () => {
  const phrase = passphrase().split("-");
  expect(phrase).toHaveLength(8);
  for (const word of phrase) expect(words).toContain(word);
  expect(new Set(words).size).toBe(words.length);
});
