export const groups = {
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lower: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{}:,.?",
};
function random(max: number) {
  const values = new Uint32Array(1),
    limit = 4294967296 - (4294967296 % max);
  do {
    crypto.getRandomValues(values);
  } while (values[0] >= limit);
  return values[0] % max;
}
export function generate(length: number, selected: (keyof typeof groups)[]) {
  if (
    length < 12 ||
    length > 64 ||
    !Number.isInteger(length) ||
    !selected.length
  )
    throw new Error(
      "Choose at least one character group and a length from 12 to 64.",
    );
  const alphabet = selected.map((k) => groups[k]).join("");
  const result = selected.map((k) => groups[k][random(groups[k].length)]);
  while (result.length < length) result.push(alphabet[random(alphabet.length)]);
  for (let i = result.length - 1; i > 0; i--) {
    const j = random(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result.join("");
}
// Compact uniform word list. Entropy is 8 * log2(words.length) bits before user changes.
export const words =
  "acorn actor adapt adobe agile aisle album alert amber angel angle apple apron arena argon arrow atlas audio autumn badge baker bamboo basic basil beach berry birch bloom board bonus brave bread brick brook brush cabin cable camel candy canoe cedar charm chess cider city civic cloud coast coral craft crane crisp crown daisy dance dawn delta denim disco diver dizzy donor drama dream drift eagle early earth ebony echo elder elm ember enjoy entry equal event extra fable fairy fancy fern field fiery finch flame fleet flora flute focus forge frame fresh frost fruit fuzzy gamma garden giant ginger glass globe glory grain grape grass green grove guest guide habit happy harbor hazel heart hedge hello honey honor house human humor ideal image index indie ivory"
    .split(" ")
    .slice(0, 128);
export function passphrase() {
  return Array.from({ length: 8 }, () => words[random(words.length)]).join("-");
}
