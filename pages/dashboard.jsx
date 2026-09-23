import { useState, useEffect, useContext } from "react";
import Link from "next/link";
import ThemeToggle from "../components/ThemeToggle";
import { AuthContext } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function DashboardPage() {
  const { logout } = useContext(AuthContext);

  const [metricsReguler, setMetricsReguler] = useState({
    omset: 0,
    hpp: 0,
    overhead: 0,
    labaBersih: 0,
  });
  const [metricsPO, setMetricsPO] = useState({
    omset: 0,
    hpp: 0,
    overhead: 0,
    labaBersih: 0,
  });

  // State Pembayaran Cash & QRIS
  const [paymentSummary, setPaymentSummary] = useState({ cash: 0, qris: 0 });

  const [recentTrx, setRecentTrx] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const { data: trxData, error: trxError } = await supabase
          .from("transaksi")
          .select("id, kode_trx, total_omset, metode_pembayaran, created_at")
          .order("created_at", { ascending: false });

        if (trxError) throw trxError;

        setRecentTrx(trxData.slice(0, 5));

        // Hitung total Cash dan QRIS dari seluruh transaksi
        let totalCash = 0;
        let totalQris = 0;
        trxData.forEach((t) => {
          if (t.metode_pembayaran === "QRIS") {
            totalQris += Number(t.total_omset);
          } else {
            totalCash += Number(t.total_omset);
          }
        });
        setPaymentSummary({ cash: totalCash, qris: totalQris });

        const { data: detailData, error: detailError } = await supabase.from(
          "detail_transaksi",
        ).select(`
            qty, 
            hpp_bahan_saat_ini, 
            hpp_kemasan_saat_ini,
            transaksi ( kode_trx )
          `);

        if (detailError) throw detailError;

        const omsetReguler = trxData
          .filter((t) => !t.kode_trx.startsWith("PO"))
          .reduce((sum, i) => sum + Number(i.total_omset), 0);
        const omsetPO = trxData
          .filter((t) => t.kode_trx.startsWith("PO"))
          .reduce((sum, i) => sum + Number(i.total_omset), 0);

        let hppReguler = 0;
        let hppPO = 0;

        detailData?.forEach((item) => {
          const hppPerItem =
            Number(item.hpp_bahan_saat_ini) + Number(item.hpp_kemasan_saat_ini);
          const totalItemHpp = hppPerItem * Number(item.qty);
          const code = item.transaksi?.kode_trx || "";
          if (code.startsWith("PO")) {
            hppPO += totalItemHpp;
          } else {
            hppReguler += totalItemHpp;
          }
        });

        const labaKotorReg = omsetReguler - hppReguler;
        const overheadReg = labaKotorReg * 0.2;
        const labaBersihReg = labaKotorReg - overheadReg;

        const labaKotorPO = omsetPO - hppPO;
        const overheadPO = labaKotorPO * 0.2;
        const labaBersihPO = labaKotorPO - overheadPO;

        setMetricsReguler({
          omset: omsetReguler,
          hpp: hppReguler,
          overhead: overheadReg,
          labaBersih: labaBersihReg,
        });
        setMetricsPO({
          omset: omsetPO,
          hpp: hppPO,
          overhead: overheadPO,
          labaBersih: labaBersihPO,
        });

        const totalOmsetAll = omsetReguler + omsetPO;
        const totalLabaAll = labaBersihReg + labaBersihPO;

        const currentMonth = new Date().getMonth();
        const months = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "Mei",
          "Jun",
          "Jul",
          "Ags",
          "Sep",
          "Okt",
          "Nov",
          "Des",
        ];

        const dataGrafik = months.map((month, index) => {
          if (index === currentMonth) {
            return { name: month, Omset: totalOmsetAll, Laba: totalLabaAll };
          }
          return { name: month, Omset: 0, Laba: 0 };
        });

        if (currentMonth > 0)
          dataGrafik[currentMonth - 1] = {
            name: months[currentMonth - 1],
            Omset: 850000,
            Laba: 210000,
          };
        if (currentMonth > 1)
          dataGrafik[currentMonth - 2] = {
            name: months[currentMonth - 2],
            Omset: 1200000,
            Laba: 300000,
          };

        setChartData(dataGrafik);
      } catch (error) {
        console.error("Gagal menarik data dashboard:", error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] dark:bg-zinc-900">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    // PERBAIKAN: Gunakan h-screen, flex-col, dan overflow-hidden agar fit layar
    <div className="h-screen flex flex-col overflow-hidden bg-[#FDFBF7] dark:bg-zinc-900 transition-colors duration-300">
      {/* Header Statis: Gunakan shrink-0 agar tidak menyusut */}
      {/* Header Statis dengan Efek Bayangan Bawah (Drop Shadow) */}
      <nav className="bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 px-4 md:px-6 py-3 flex justify-between items-center shrink-0 gap-2 shadow-md dark:shadow-black/40 z-20">
        <h1 className="ml-12 lg:ml-0 text-lg md:text-2xl font-bold text-amber-900 dark:text-amber-400 truncate">
          Toko Roti Amira
          <span className="hidden sm:inline text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
            | Laporan Keuangan
          </span>
        </h1>
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <ThemeToggle />
          <button
            onClick={logout}
            className="p-2 w-10 h-10 flex items-center justify-center text-red-600 hover:bg-red-50 dark:text-red-400 rounded-lg transition-all shadow-sm"
            title="Keluar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </nav>

      {/* PERBAIKAN: Wadah konten yang bisa di-scroll secara mandiri */}
      <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
        <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-8 pt-6 pb-20">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Ringkasan Finansial Toko
            </h2>
            <Link
              href="/produk"
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-md text-sm"
            >
              Kelola Produk &rarr;
            </Link>
          </div>

          {/* SECTION TAMBAHAN: RINGKASAN METODE PEMBAYARAN (CASH vs QRIS) */}
          <div className="space-y-3">
            <h3 className="text-md font-bold text-purple-700 dark:text-purple-400 flex items-center gap-2">
              💳 Rekap Metode Pembayaran Keseluruhan
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Total Pembayaran Tunai (Cash)
                  </p>
                  <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    Rp {paymentSummary.cash.toLocaleString("id-ID")}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">Uang fisik kasir</p>
                </div>
                <span className="text-4xl p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                  💵
                </span>
              </div>

              <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                    Total Pembayaran QRIS
                  </p>
                  <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    Rp {paymentSummary.qris.toLocaleString("id-ID")}
                  </h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Uang digital / transfer
                  </p>
                </div>
                <span className="text-4xl p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  📱
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 1: TRANSAKSI TOKO (REGULER) */}
          <div className="space-y-3">
            <h3 className="text-md font-bold text-amber-800 dark:text-amber-400 flex items-center gap-2">
              🛍️ Ringkasan Transaksi Toko (Reguler)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Total Omset Reguler
                </p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Rp {metricsReguler.omset.toLocaleString("id-ID")}
                </h3>
                <p className="text-xs text-gray-400 mt-2">
                  Penjualan langsung etalase
                </p>
              </div>
              <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Total HPP Reguler
                </p>
                <h3 className="text-2xl font-bold text-red-600 dark:text-red-400">
                  Rp {metricsReguler.hpp.toLocaleString("id-ID")}
                </h3>
                <p className="text-xs text-gray-400 mt-2">
                  Modal barang terjual
                </p>
              </div>
              <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Total Overhead (20%)
                </p>
                <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-500">
                  Rp {metricsReguler.overhead.toLocaleString("id-ID")}
                </h3>
                <p className="text-xs text-gray-400 mt-2">
                  Potongan laba kotor
                </p>
              </div>
              <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Total Laba Bersih Reguler
                </p>
                <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  Rp {metricsReguler.labaBersih.toLocaleString("id-ID")}
                </h3>
                <p className="text-xs text-gray-400 mt-2">
                  Keuntungan final toko
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 2: PRE-ORDER (PESANAN KHUSUS) */}
          <div className="space-y-3">
            <h3 className="text-md font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
              📦 Ringkasan Pre-Order (Pesanan Khusus / Acara)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Total Omset Pre-Order
                </p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Rp {metricsPO.omset.toLocaleString("id-ID")}
                </h3>
                <p className="text-xs text-gray-400 mt-2">
                  Total pesanan partai besar
                </p>
              </div>
              <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Total HPP Pre-Order
                </p>
                <h3 className="text-2xl font-bold text-red-600 dark:text-red-400">
                  Rp {metricsPO.hpp.toLocaleString("id-ID")}
                </h3>
                <p className="text-xs text-gray-400 mt-2">
                  Modal bahan & kemasan PO
                </p>
              </div>
              <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Total Overhead (20%)
                </p>
                <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-500">
                  Rp {metricsPO.overhead.toLocaleString("id-ID")}
                </h3>
                <p className="text-xs text-gray-400 mt-2">
                  Potongan laba kotor PO
                </p>
              </div>
              <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Total Laba Bersih Pre-Order
                </p>
                <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  Rp {metricsPO.labaBersih.toLocaleString("id-ID")}
                </h3>
                <p className="text-xs text-gray-400 mt-2">
                  Keuntungan final PO
                </p>
              </div>
            </div>
          </div>

          {/* Layout Bawah: Grafik & Transaksi Terbaru */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
            <div className="lg:col-span-2 bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-6">
                Grafik Keuntungan & Omset 2026 (Gabungan)
              </h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#E5E7EB"
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#9CA3AF", fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#9CA3AF", fontSize: 12 }}
                      tickFormatter={(value) => `${value / 1000}k`}
                    />
                    <Tooltip
                      cursor={{ fill: "transparent" }}
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                        backgroundColor: "#fff",
                      }}
                      formatter={(value) =>
                        `Rp ${value.toLocaleString("id-ID")}`
                      }
                    />
                    <Bar
                      dataKey="Laba"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                    <Bar
                      dataKey="Omset"
                      fill="#FBBF24"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#10B981]"></span>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total Laba Bersih
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-[#FBBF24]"></span>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total Omset
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                  Detail Pesanan Terbaru
                </h3>
                <Link
                  href="/laporan"
                  className="text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
                >
                  Lihat Semua &rarr;
                </Link>
              </div>

              <div className="flex-1 flex flex-col gap-4">
                {recentTrx.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-10">
                    Belum ada transaksi.
                  </p>
                ) : (
                  recentTrx.map((trx) => (
                    <div
                      key={trx.id}
                      className="flex justify-between items-center pb-4 border-b border-gray-50 dark:border-zinc-700/50 last:border-0 last:pb-0"
                    >
                      <div>
                        <p className="font-bold text-gray-800 dark:text-gray-100">
                          {trx.kode_trx}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(trx.created_at).toLocaleDateString(
                            "id-ID",
                            {
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 dark:text-gray-100">
                          Rp {Number(trx.total_omset).toLocaleString("id-ID")}
                        </p>
                        <p className="text-xs text-emerald-600 font-medium mt-1">
                          Selesai
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
