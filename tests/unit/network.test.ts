import { describe, it, expect, vi, afterEach } from "vitest";
import dns from "node:dns/promises";
import https from "node:https";
import { EventEmitter } from "node:events";
import {
  parseURL,
  publicIP,
  destination,
  safeRequest,
} from "../../src/lib/security/network";
afterEach(() => vi.restoreAllMocks());
describe("URL boundary", () => {
  it.each([
    "http://127.0.0.1",
    "http://2130706433",
    "http://0x7f000001",
    "http://0177.0.0.1",
    "http://[::1]",
    "http://localhost",
    "http://metadata.google.internal",
    "http://user:pass@example.com",
    "file:///etc/passwd",
    "http://example.com:8080",
    "http://example.com\\@localhost",
    "http://example.com\n",
    "http://%31%32%37.0.0.1",
    "http://example.com.",
    "https://foo.local",
  ])("rejects %s", (u) => expect(() => parseURL(u)).toThrow());
  it("defaults to HTTPS and preserves path", () =>
    expect(parseURL("example.com/path").href).toBe("https://example.com/path"));
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "168.63.129.16",
    "100.64.0.1",
    "0.0.0.0",
    "192.0.0.1",
    "224.0.0.1",
    "255.255.255.255",
    "::1",
    "::",
    "fe80::1",
    "fc00::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "2001:db8::1",
  ])("rejects nonpublic %s", (ip) => expect(publicIP(ip)).toBe(false));
  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "allows global unicast %s",
    (ip) => expect(publicIP(ip)).toBe(true),
  );
  it("rejects mixed public and private DNS", async () => {
    vi.spyOn(dns, "lookup").mockResolvedValue([
      { address: "8.8.8.8", family: 4 },
      { address: "10.0.0.1", family: 4 },
    ] as never);
    await expect(destination(new URL("https://example.com"))).rejects.toThrow(
      "BLOCKED_DESTINATION",
    );
  });
  it("pins the resolved address and rejects a private redirect before the second connection", async () => {
    vi.spyOn(dns, "lookup").mockImplementation(
      async () => [{ address: "8.8.8.8", family: 4 }] as never,
    );
    const request = vi
      .spyOn(https, "request")
      .mockImplementation((url: unknown, options: unknown, cb: unknown) => {
        const o = options as {
          lookup: (
            h: string,
            o: object,
            c: (error: unknown, a: string, f: number) => void,
          ) => void;
        };
        o.lookup("example.com", {}, (err, address, family) => {
          expect(err).toBeNull();
          expect(address).toBe("8.8.8.8");
          expect(family).toBe(4);
        });
        const emitter = new EventEmitter() as EventEmitter & {
          end: () => void;
          destroy: () => void;
        };
        emitter.destroy = () => emitter.emit("close");
        emitter.end = () => {
          const res = {
            socket: {},
            statusCode: 302,
            headers: { location: "http://127.0.0.1" },
            destroy: () => emitter.emit("close"),
          };
          (cb as (r: unknown) => void)(res);
        };
        return emitter as never;
      });
    await expect(safeRequest("https://example.com")).rejects.toThrow(
      "INSECURE_REDIRECT",
    );
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("revalidates DNS for every redirect hop", async () => {
    const lookup = vi
      .spyOn(dns, "lookup")
      .mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }] as never)
      .mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }] as never);
    vi.spyOn(https, "request").mockImplementation(
      (_u: unknown, _o: unknown, cb: unknown) => {
        const e = new EventEmitter() as EventEmitter & {
          end: () => void;
          destroy: () => void;
        };
        e.destroy = () => e.emit("close");
        e.end = () => {
          (cb as (r: unknown) => void)({
            socket: {},
            statusCode: 302,
            headers: { location: "https://example.com/next" },
            destroy: () => e.emit("close"),
          });
        };
        return e as never;
      },
    );
    await expect(safeRequest("https://example.com")).rejects.toThrow(
      "BLOCKED_DESTINATION",
    );
    expect(lookup).toHaveBeenCalledTimes(2);
  });
  it("bounds redirect count before networking", async () =>
    await expect(
      safeRequest("https://example.com", Date.now() + 1000, 4),
    ).rejects.toThrow("REQUEST_LIMIT"));
});
