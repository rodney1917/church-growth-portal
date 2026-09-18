import{describe,expect,it}from"vitest";import{formatRegistrationNumber,hashToken,makeQrToken,normalizePhone,safeEqual}from"./security";
describe("critical identity and registration rules",()=>{
 it("normalizes a local Zambian phone",()=>expect(normalizePhone("097 123 4567")).toBe("260971234567"));
 it("keeps an international Zambian phone",()=>expect(normalizePhone("+260 971 234 567")).toBe("260971234567"));
 it("makes duplicate phone inputs identical",()=>expect(normalizePhone("0971234567")).toBe(normalizePhone("+260971234567")));
 it("generates the Night of a Thousand first number",()=>expect(formatRegistrationNumber("NOT1000",1)).toBe("NOT1000-0001"));
 it("continues beyond four digits safely",()=>expect(formatRegistrationNumber("EVT",10000)).toBe("EVT-10000"));
 it("creates opaque QR tokens",()=>{const token=makeQrToken();expect(token.length).toBeGreaterThan(32);expect(token).not.toContain("097")});
 it("hashes QR tokens deterministically",()=>expect(hashToken("token")).toBe(hashToken("token")));
 it("does not accept a different API key",()=>expect(safeEqual("same-length-a","same-length-b")).toBe(false));
 it("accepts the same API key",()=>expect(safeEqual("secure-key","secure-key")).toBe(true));
});
