import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, MAX_IMAGE_SIDE, fitWithin, foodImagePath, foodImageUrl, isJpeg, stripJpegMetadata, validateImageUpload } from "../images";

// Builds a tiny synthetic JPEG: SOI, APP0 (JFIF), APP1 (EXIF with a fake GPS payload), a COMMENT,
// DQT, SOF0, DHT, SOS + scan data + EOI.
const seg = (marker: number, payload: number[]) => {
  const len = payload.length + 2;
  return [0xff, marker, (len >> 8) & 0xff, len & 0xff, ...payload];
};
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));
const EXIF = seg(0xe1, [...ascii("Exif\0\0"), ...ascii("GPSLatitude=40.7128;GPSLongitude=-74.0060")]);
const XMP = seg(0xe1, ascii("http://ns.adobe.com/xap/1.0/\0<x:xmpmeta>geo</x:xmpmeta>"));
const IPTC = seg(0xed, ascii("Photoshop 3.0\0city=Brooklyn"));
const COMMENT = seg(0xfe, ascii("shot at home"));
const APP0 = seg(0xe0, [...ascii("JFIF\0"), 1, 1, 0, 0, 1, 0, 1, 0, 0]);
const DQT = seg(0xdb, [0, ...new Array(64).fill(8)]);
const SOF0 = seg(0xc0, [8, 0, 1, 0, 1, 1, 1, 0x11, 0]);
const DHT = seg(0xc4, [0, ...new Array(16).fill(0)]);
const SOS_HEADER = seg(0xda, [1, 1, 0, 0, 63, 0]);
const SCAN = [0x12, 0x34, 0xff, 0x00, 0x56, 0x78]; // includes a stuffed 0xFF00, which is not a marker
const EOI = [0xff, 0xd9];
const jpeg = (...parts: number[][]) => new Uint8Array([0xff, 0xd8, ...parts.flat(), ...SOS_HEADER, ...SCAN, ...EOI]);

const contains = (hay: Uint8Array, needle: string) => Buffer.from(hay).includes(Buffer.from(needle));

describe("isJpeg", () => {
  it("recognizes the JPEG signature", () => {
    expect(isJpeg(jpeg(APP0, DQT))).toBe(true);
  });
  it("rejects other formats and short input", () => {
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false); // PNG
    expect(isJpeg(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe(false); // WebP
    expect(isJpeg(new Uint8Array([0xff, 0xd8]))).toBe(false);
    expect(isJpeg(new Uint8Array())).toBe(false);
  });
});

describe("stripJpegMetadata (privacy: no location data may be stored)", () => {
  const dirty = jpeg(APP0, EXIF, XMP, IPTC, COMMENT, DQT, SOF0, DHT);

  it("removes EXIF/GPS, XMP, IPTC and comment segments", () => {
    expect(contains(dirty, "GPSLatitude")).toBe(true); // sanity: the fixture really contains it
    const clean = stripJpegMetadata(dirty);
    for (const secret of ["GPSLatitude", "GPSLongitude", "Exif", "xmpmeta", "Photoshop", "Brooklyn", "shot at home"]) {
      expect(contains(clean, secret), secret).toBe(false);
    }
  });

  it("keeps everything needed to display the picture, byte for byte", () => {
    const clean = stripJpegMetadata(dirty);
    expect([...clean]).toEqual([...jpeg(APP0, DQT, SOF0, DHT)]);
    expect(isJpeg(clean)).toBe(true);
  });

  it("does not touch the entropy-coded scan data (stuffed 0xFF00 bytes stay)", () => {
    const clean = stripJpegMetadata(dirty);
    const tail = [...clean].slice(-(SCAN.length + EOI.length));
    expect(tail).toEqual([...SCAN, ...EOI]);
  });

  it("leaves an already clean JPEG unchanged", () => {
    const clean = jpeg(APP0, DQT, SOF0, DHT);
    expect([...stripJpegMetadata(clean)]).toEqual([...clean]);
  });

  it("rejects truncated or non-JPEG input", () => {
    expect(() => stripJpegMetadata(new Uint8Array([1, 2, 3]))).toThrow(/Invalid JPEG/);
    expect(() => stripJpegMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00]))).toThrow(/Invalid JPEG/); // cut off
    expect(() => stripJpegMetadata(new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff, 1, 2]))).toThrow(/Invalid JPEG/); // length past end
  });
});

describe("validateImageUpload", () => {
  const ok = jpeg(APP0, DQT);
  it("accepts a small JPEG", () => {
    expect(validateImageUpload({ size: ok.length, type: "image/jpeg" }, ok)).toBeNull();
  });
  it("rejects wrong type, wrong content (a renamed file), empty and oversized files", () => {
    expect(validateImageUpload({ size: 10, type: "image/png" }, ok)).toBe("imageType");
    expect(validateImageUpload({ size: 10, type: "image/jpeg" }, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]))).toBe("imageInvalid");
    expect(validateImageUpload({ size: 0, type: "image/jpeg" }, new Uint8Array())).toBe("imageInvalid");
    expect(validateImageUpload({ size: MAX_IMAGE_BYTES + 1, type: "image/jpeg" }, ok)).toBe("imageTooLarge");
  });
});

describe("paths and URLs", () => {
  it("stores photos under the merchant's folder with a unique, URL-safe name", () => {
    const p = foodImagePath("11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222", "ab12cd34");
    expect(p).toBe("11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222-ab12cd34.jpg");
    expect(p).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}-[a-z0-9]+\.jpg$/);
  });
  it("builds the public URL from the project URL and path", () => {
    expect(foodImageUrl("https://abc.supabase.co", "m/f.jpg")).toBe("https://abc.supabase.co/storage/v1/object/public/food-images/m/f.jpg");
    expect(foodImageUrl("https://abc.supabase.co/", "m/f.jpg")).toBe("https://abc.supabase.co/storage/v1/object/public/food-images/m/f.jpg");
  });
  it("returns null when there is no photo or no project URL", () => {
    expect(foodImageUrl("https://abc.supabase.co", null)).toBeNull();
    expect(foodImageUrl("", "m/f.jpg")).toBeNull();
    expect(foodImageUrl(undefined, "m/f.jpg")).toBeNull();
  });
});

describe("fitWithin (browser-side resize target)", () => {
  it("scales the long side down to the maximum, keeping the aspect ratio", () => {
    expect(fitWithin(4000, 3000, 1200)).toEqual({ width: 1200, height: 900 });
    expect(fitWithin(3000, 4000, 1200)).toEqual({ width: 900, height: 1200 });
    expect(fitWithin(MAX_IMAGE_SIDE * 2, MAX_IMAGE_SIDE, MAX_IMAGE_SIDE)).toEqual({ width: MAX_IMAGE_SIDE, height: MAX_IMAGE_SIDE / 2 });
  });
  it("never upscales", () => {
    expect(fitWithin(800, 600, 1200)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(1200, 1200, 1200)).toEqual({ width: 1200, height: 1200 });
  });
  it("never returns a zero-size image", () => {
    expect(fitWithin(10000, 1, 1200)).toEqual({ width: 1200, height: 1 });
  });
});
