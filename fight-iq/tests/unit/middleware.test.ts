import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const req = (auth?: string) => new NextRequest("http://127.0.0.1/", { headers: auth ? { authorization: auth } : {} });
const basic = (u: string, p: string) => "Basic " + Buffer.from(`${u}:${p}`).toString("base64");

describe("middleware (Basic Auth opcional)", () => {
  afterEach(() => {
    delete process.env.APP_BASIC_AUTH_USER;
    delete process.env.APP_BASIC_AUTH_PASSWORD;
  });

  it("sem variáveis configuradas, deixa passar", () => {
    expect(middleware(req()).status).toBe(200);
  });

  it("com variáveis, exige credenciais corretas", () => {
    process.env.APP_BASIC_AUTH_USER = "admin";
    process.env.APP_BASIC_AUTH_PASSWORD = "a:b:c";
    expect(middleware(req()).status).toBe(401);
    expect(middleware(req(basic("admin", "errada"))).status).toBe(401);
    expect(middleware(req("Basic !!!invalido"))).toHaveProperty("status", 401);
    expect(middleware(req(basic("admin", "a:b:c"))).status).toBe(200);
  });
});
