// POST { type?, start, end } pide un reporte a Uber. Uber lo genera de forma asíncrona y avisa
// por webhook (eats.report.success) con los links de descarga. GET lista los reportes recibidos.
import { NextRequest, NextResponse } from "next/server";
import { requestReport } from "@/lib/uber";
import { getJSON, listIds } from "@/lib/db";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ids = await listIds("reports", 30);
    const reports = await Promise.all(ids.map((id) => getJSON<any>(`report:${id}`)));
    return NextResponse.json({
      reports: reports.filter(Boolean).map((r) => ({
        received_at: r.received_at,
        type: r.event?.event_type,
        // Uber entrega los links dentro de report_metadata o meta según versión
        links: findUrls(r.event),
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  const { type = "ORDERS_AND_ITEMS_REPORT", start, end } = await req.json().catch(() => ({}));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(end ?? "")) {
    return NextResponse.json({ error: "start y end deben ser AAAA-MM-DD" }, { status: 400 });
  }
  try {
    return NextResponse.json(await requestReport(type, start, end));
  } catch (e) {
    return fail(e);
  }
}

function findUrls(obj: unknown, out: string[] = []): string[] {
  if (typeof obj === "string" && /^https?:\/\//.test(obj)) out.push(obj);
  else if (obj && typeof obj === "object") for (const v of Object.values(obj)) findUrls(v, out);
  return out;
}
