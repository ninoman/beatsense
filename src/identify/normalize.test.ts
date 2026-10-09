import { describe, expect, it } from "vitest";
import { normalizeArtist, normalizeTitle } from "./normalize";

describe("normalizeTitle", () => {
  it.each([
    ["Around the World", "Around the World"],
    ["Get Lucky (feat. Pharrell Williams)", "Get Lucky"],
    ["Get Lucky [feat. Pharrell Williams & Nile Rodgers]", "Get Lucky"],
    ["Song ft. Someone", "Song"],
    ["Bohemian Rhapsody - Remastered 2011", "Bohemian Rhapsody"],
    ["Bohemian Rhapsody (2011 Remaster)", "Bohemian Rhapsody"],
    ["Strobe (Radio Edit)", "Strobe"],
    ["Opus - Original Mix", "Opus"],
    ["One More Time (Live)", "One More Time"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });

  it("keeps remixes, which are separate Discogs releases", () => {
    expect(normalizeTitle("Ghosts 'n' Stuff (Nero Remix)")).toBe("Ghosts 'n' Stuff (Nero Remix)");
  });

  it("keeps hyphenated titles without version words", () => {
    expect(normalizeTitle("Self-Control")).toBe("Self-Control");
    expect(normalizeTitle("Song - Part 2")).toBe("Song - Part 2");
  });

  it("never returns an empty string", () => {
    expect(normalizeTitle("(Live)")).toBe("(Live)");
  });
});

describe("normalizeArtist", () => {
  it.each([
    ["Daft Punk", "Daft Punk"],
    ["Daft Punk feat. Pharrell Williams", "Daft Punk"],
    ["Calvin Harris ft. Rihanna", "Calvin Harris"],
    ["Simon & Garfunkel", "Simon & Garfunkel"],
    ["Earth, Wind & Fire", "Earth, Wind & Fire"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizeArtist(input)).toBe(expected);
  });
});
