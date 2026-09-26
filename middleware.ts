import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  try {
    const response = await fetch(
      `https://api.vercel.com/v1/edge-config/${process.env.EDGE_CONFIG_ID}/items`,
      {
        headers: {
          Authorization: `Bearer ${process.env.VERCEL_ACCESS_TOKEN}`,
        },
        cache: "no-store",
      },
    );

    if (response.ok) {
      const data = await response.json();

      // PERBAIKAN: Cari data di dalam Array persis seperti di dashboard
      const amiraItem = data.find(
        (item: any) => item.key === "maintenance_amira",
      );

      // Jika status value = true, blokir pengunjung
      if (
        amiraItem &&
        (amiraItem.value === true || amiraItem.value === "true")
      ) {
        return new NextResponse(
          `
          <html>
            <body style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif; text-align:center; background-color:#f9fafb;">
              <div>
                <h1 style="font-size:2rem; color:#1f2937;">🚧 Sedang Maintenance 🚧</h1>
                <p style="color:#4b5563;">Toko Roti Amira sedang dalam perbaikan sistem. Silakan kembali beberapa saat lagi.</p>
              </div>
            </body>
          </html>
        `,
          {
            status: 503,
            headers: { "Content-Type": "text/html" },
          },
        );
      }
    }

    return NextResponse.next();
  } catch (error) {
    return NextResponse.next();
  }
}

export const config = {
  matcher: "/((?!api|_next/static|_next/image|favicon.ico).*)",
};
