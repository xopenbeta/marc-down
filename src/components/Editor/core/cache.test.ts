import { describe, expect, it } from "vitest";
import {
  hashBlock,
  hashBlockId,
  setContainerWidth,
  getContainerWidth,
  getCachedImageDim,
  cacheImageDim,
} from "./cache";

describe("cache", () => {
  // ── hashBlock ──
  it("returns a non-empty base36 string", () => {
    const h = hashBlock("hello");
    expect(h).toBeTruthy();
    expect(typeof h).toBe("string");
    expect(/^[0-9a-z]+$/.test(h)).toBe(true);
  });

  it("returns the same hash for identical content", () => {
    expect(hashBlock("abc")).toBe(hashBlock("abc"));
  });

  it("returns different hashes for different content", () => {
    expect(hashBlock("abc")).not.toBe(hashBlock("abd"));
  });

  it("returns different hashes for different casing", () => {
    expect(hashBlock("Abc")).not.toBe(hashBlock("abc"));
  });

  it("handles empty string", () => {
    const h = hashBlock("");
    expect(h).toBeTruthy();
    expect(typeof h).toBe("string");
  });

  // ── hashBlockId ──
  it("hashBlockId includes container width in the hash", () => {
    setContainerWidth(800);
    const h1 = hashBlockId("hello");
    setContainerWidth(1200);
    const h2 = hashBlockId("hello");
    expect(h1).not.toBe(h2);
  });

  it("same content + same width produces same hashBlockId", () => {
    setContainerWidth(1000);
    expect(hashBlockId("test")).toBe(hashBlockId("test"));
  });

  // ── container width ──
  it("getContainerWidth returns default 800", () => {
    setContainerWidth(800);
    expect(getContainerWidth()).toBe(800);
  });

  it("setContainerWidth updates the stored width", () => {
    setContainerWidth(500);
    expect(getContainerWidth()).toBe(500);
    setContainerWidth(800); // reset
  });

  it("setContainerWidth accepts zero", () => {
    setContainerWidth(0);
    expect(getContainerWidth()).toBe(0);
    setContainerWidth(800); // reset
  });

  // ── image dim cache ──
  it("getCachedImageDim returns undefined for uncached URL", () => {
    expect(getCachedImageDim("https://example.com/img.png")).toBeUndefined();
  });

  it("cacheImageDim stores and getCachedImageDim retrieves dimensions", () => {
    cacheImageDim("https://example.com/a.png", 100, 200);
    const dim = getCachedImageDim("https://example.com/a.png");
    expect(dim).toEqual({ width: 100, height: 200 });
  });

  it("overwrites cached dimensions for the same URL", () => {
    cacheImageDim("url", 50, 50);
    cacheImageDim("url", 300, 400);
    expect(getCachedImageDim("url")).toEqual({ width: 300, height: 400 });
  });

  it("caches multiple URLs independently", () => {
    cacheImageDim("a", 10, 20);
    cacheImageDim("b", 30, 40);
    expect(getCachedImageDim("a")).toEqual({ width: 10, height: 20 });
    expect(getCachedImageDim("b")).toEqual({ width: 30, height: 40 });
  });
});
