import { describe, expect, it } from "vitest";
import { distanceM, findWardByName, nearestWard } from "@/lib/geo";
import type { Ward } from "@/lib/types";

const ward = (id: string, name: string, lat: number, lng: number): Ward => ({
  id,
  name,
  lat,
  lng,
  zone: "West Zone",
  office: `${name} office`,
  zonalOfficer: "Deputy Commissioner, West Zone",
});
const wards = [ward("navrangpura", "Navrangpura", 23.0365, 72.5611), ward("paldi", "Paldi", 23.0124, 72.5626)];

describe("distanceM", () => {
  it("is zero for the same point", () => {
    expect(distanceM(23.03, 72.56, 23.03, 72.56)).toBe(0);
  });

  it("is about 111 km per degree of latitude", () => {
    const d = distanceM(23, 72.5, 24, 72.5);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it("is symmetric", () => {
    expect(distanceM(23.0365, 72.5611, 23.0124, 72.5626)).toBeCloseTo(distanceM(23.0124, 72.5626, 23.0365, 72.5611));
  });
});

describe("nearestWard", () => {
  it("picks the ward whose centre is closest", () => {
    expect(nearestWard(wards, 23.013, 72.563).ward.id).toBe("paldi");
    expect(nearestWard(wards, 23.035, 72.561).ward.id).toBe("navrangpura");
  });

  it("returns a rounded distance in metres", () => {
    expect(nearestWard(wards, 23.0124, 72.5626).distanceM).toBe(0);
    expect(Number.isInteger(nearestWard(wards, 23.02, 72.56).distanceM)).toBe(true);
  });
});

describe("findWardByName", () => {
  it("matches case-insensitively on part of the name", () => {
    expect(findWardByName(wards, "paldi")?.id).toBe("paldi");
    expect(findWardByName(wards, "NAVRANG")?.id).toBe("navrangpura");
  });

  it("matches when the query contains the ward name", () => {
    expect(findWardByName(wards, "near Paldi cross roads")?.id).toBe("paldi");
  });

  it("returns undefined for unknown areas", () => {
    expect(findWardByName(wards, "Mumbai")).toBeUndefined();
  });
});
