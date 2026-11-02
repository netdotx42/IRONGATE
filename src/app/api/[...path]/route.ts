import { api } from "@/lib/api";
export const runtime = "nodejs";
export const maxDuration = 300;
type Context = { params: Promise<{ path: string[] }> };
async function handler(request: Request, ctx: Context) {
  return api(request, (await ctx.params).path);
}
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
