// Ejecuta los endpoints que Uber exige para validar la app de prueba.
// POST { action, store?, item?, price? }
import { NextRequest, NextResponse } from "next/server";
import {
  deletePosData,
  deliveryStore,
  deliveryStores,
  getPosData,
  postPosData,
  setItemPrice,
  setItemSoldOut,
  uploadMenu,
} from "@/lib/uber";
import { fail } from "@/lib/http";
import menu from "@/data/menu.json";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { action, store, item, price } = await req.json().catch(() => ({}));
  const s: string | null = store || null;
  const itemId: string = item || menu.items[0]?.id || "";
  try {
    let result: unknown;
    switch (action) {
      case "delivery_stores":
        result = await deliveryStores();
        break;
      case "delivery_store":
        result = await deliveryStore(s);
        break;
      case "get_pos_data":
        result = await getPosData(s);
        break;
      case "post_pos_data":
        result = await postPosData(s);
        break;
      case "delete_pos_data":
        result = await deletePosData(s);
        break;
      case "upload_menu":
        result = await uploadMenu(menu, s);
        break;
      case "item_sold_out":
        result = await setItemSoldOut(itemId, true, s);
        break;
      case "item_available":
        result = await setItemSoldOut(itemId, false, s);
        break;
      case "item_price":
        result = await setItemPrice(itemId, Math.max(1, Math.round(Number(price) || 1)), s);
        break;
      default:
        return NextResponse.json({ error: "Acción desconocida" }, { status: 400 });
    }
    return NextResponse.json({ ok: true, action, result: result ?? "OK (sin contenido)" });
  } catch (e) {
    return fail(e);
  }
}
