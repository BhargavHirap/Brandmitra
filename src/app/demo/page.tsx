import { redirect } from "next/navigation";
import { DEMO_SLUG, ensureDemoStore } from "@/lib/demo-store";

/**
 * ENTRY POINT FOR THE DEMO SHOP.
 *
 * The landing page links here because the shop must exist before it is opened.
 * This page creates it if needed and hands over to the ordinary storefront, so
 * the visitor's cart, checkout and receipt are the same ones a real customer
 * gets. It renders nothing itself, so it is never cached.
 */

export const dynamic = "force-dynamic";

export default async function DemoShopEntry() {
  await ensureDemoStore();
  redirect(`/b/${DEMO_SLUG}`);
}
