import { NextResponse } from "next/server";
import { listOrders, summarize } from "@/lib/orders";
import { fail } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orders = await listOrders(50);
    return NextResponse.json({ orders: orders.map(summarize) });
  } catch (e) {
    return fail(e);
  }
}
