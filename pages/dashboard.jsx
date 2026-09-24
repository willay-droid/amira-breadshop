import { useState, useEffect, useContext } from "react";
import Head from "next/head";
import ThemeToggle from "../components/ThemeToggle";
import { AuthContext } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function DashboardPage() {
  const { logout } = useContext(AuthContext);
  const [rawData, setRawData] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // State Filter Waktu: 'hari', 'bulan', 'tahun', 'semua'
  const [timeFilter, setTimeFilter] = useState("bulan");

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const { data: detailData, error: detailError } = await supabase.from(
        "detail_transaksi",
      ).select(`
          qty, harga_jual_saat_ini, hpp_bahan_saat_ini, hpp_kemasan_saat_ini,
          transaksi:transaksi_id (id, kode_trx, created_at, metode_pembayaran),
          produk:produk_id (jenis, harga_awal)
        `);

      if (detailError) throw detailError;

      const { data: trxData, error: trxError } = await supabase
        .from("transaksi")
        .select("kode_trx, total_omset, created_at")
        .order("created_at", { ascending: false })
        .limit(5);

      if (trxError) throw trxError;

      if (detailData) setRawData(detailData);
      if (trxData) setRecentTransactions(trxData);
    } catch (error) {
      console.error("Gagal load data dashboard:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // --- LOGIKA FILTER WAKTU ---
  const now = new Date();
  const startOfDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const startOfYear = new Date(now.getFullYear(), 0, 1).getTime();

  const filteredData = rawData.filter((item) => {
    if (!item.transaksi?.created_at) return false;
    const trxTime = new Date(item.transaksi.created_at).getTime();

    if (timeFilter === "hari") return trxTime >= startOfDay;
    if (timeFilter === "bulan") return trxTime >= startOfMonth;
    if (timeFilter === "tahun") return trxTime >= startOfYear;
    return true;
  });

  // --- LOGIKA AGREGASI ANGKA DASHBOARD ---
  let tunai = 0,
    qris = 0;
  let regOmset = 0,
    regHpp = 0,
    regOverhead = 0,
    regLabaBersih = 0;
  let poOmset = 0,
    poHpp = 0,
    poOverhead = 0,
    poLabaBersih = 0;

  // Persiapan Struktur Data Grafik Dinamis
  let chartLabels = [];
  let chartDataValues = [];

  if (timeFilter === "hari") {
    // Menampilkan 1 bar dengan nama hari dan tanggal
    const namaHariTanggal = now.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
    chartLabels = [namaHariTanggal];
    chartDataValues = [0];
  } else if (timeFilter === "bulan") {
    // Menampilkan tanggal 1 sampai 30/31
    const daysInMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    chartLabels = Array.from({ length: daysInMonth }, (_, i) =>
      (i + 1).toString(),
    );
    chartDataValues = Array(daysInMonth).fill(0);
  } else if (timeFilter === "tahun") {
    // Menampilkan 12 bulan
    chartLabels = [
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
    chartDataValues = Array(12).fill(0);
  } else {
    // Semua waktu (dikumpulkan per tahun) - disiapkan secara dinamis nanti
  }

  const tahunSemuaWaktu = {};

  filteredData.forEach((item) => {
    const t = item.transaksi;
    const p = item.produk || {};

    const isPO = t.kode_trx.startsWith("PO-");
    const isUMKM = p.jenis === "Titipan UMKM";
    const omsetKotor = item.qty * item.harga_jual_saat_ini;

    let totalHPP, labaKotor, overhead, labaBersih;

    if (isUMKM) {
      totalHPP = item.qty * (p.harga_awal || 0);
      labaKotor = omsetKotor - totalHPP;
      overhead = 0;
      labaBersih = labaKotor;
    } else {
      totalHPP =
        item.qty * (item.hpp_bahan_saat_ini + item.hpp_kemasan_saat_ini);
      labaKotor = omsetKotor - totalHPP;
      overhead = labaKotor * 0.2;
      labaBersih = labaKotor - overhead;
    }

    if (t.metode_pembayaran === "Cash") tunai += omsetKotor;
    if (t.metode_pembayaran === "QRIS") qris += omsetKotor;

    if (isPO) {
      poOmset += omsetKotor;
      poHpp += totalHPP;
      poOverhead += overhead;
      poLabaBersih += labaBersih;
    } else {
      regOmset += omsetKotor;
      regHpp += totalHPP;
      regOverhead += overhead;
      regLabaBersih += labaBersih;
    }

    // Mengisi Data Grafik
    const trxDate = new Date(t.created_at);
    if (timeFilter === "hari") {
      chartDataValues[0] += omsetKotor;
    } else if (timeFilter === "bulan") {
      const day = trxDate.getDate();
      chartDataValues[day - 1] += omsetKotor;
    } else if (timeFilter === "tahun") {
      const month = trxDate.getMonth();
      chartDataValues[month] += omsetKotor;
    } else {
      const year = trxDate.getFullYear();
      if (!tahunSemuaWaktu[year]) tahunSemuaWaktu[year] = 0;
      tahunSemuaWaktu[year] += omsetKotor;
    }
  });

  if (timeFilter === "semua") {
    chartLabels = Object.keys(tahunSemuaWaktu).sort();
    chartDataValues = chartLabels.map((y) => tahunSemuaWaktu[y]);
    if (chartLabels.length === 0) {
      chartLabels = [now.getFullYear().toString()];
      chartDataValues = [0];
    }
  }

  // Teks Bantuan Filter
  const filterText = {
    hari: "Hari Ini",
    bulan: "Bulan Ini",
    tahun: "Tahun Ini",
    semua: "Sepanjang Waktu",
  }[timeFilter];

  // Logic Tinggi Bar Chart
  const maxChartValue = Math.max(...chartDataValues, 1000);

  // Logic Donut Chart (Pie Chart) Reguler vs PO
  const totalOmsetPie = regOmset + poOmset;
  const regPct = totalOmsetPie === 0 ? 50 : (regOmset / totalOmsetPie) * 100;
  // CSS Conic Gradient untuk Pie Chart
  const pieGradient = `conic-gradient( #f59e0b 0% ${regPct}%, #3b82f6 ${regPct}% 100% )`;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#FDFBF7] dark:bg-zinc-900 transition-colors duration-300 font-sans">
      <Head>
        <title>Dashboard - Toko Roti Amira</title>
      </Head>

      <nav className="bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 px-3 md:px-6 h-[68px] flex justify-between items-center z-20 shrink-0 shadow-sm gap-2">
        <div>
          <h1 className="text-sm sm:text-lg md:text-2xl font-bold text-amber-900 dark:text-amber-400 truncate">
            {/* Sembunyikan teks utama di layar HP kecil, tampilkan kembali dari ukuran sm ke atas */}
            <span className="hidden sm:inline">Toko Roti Amira </span>
            <span className="text-xs sm:text-sm font-normal text-gray-500 dark:text-gray-400">
              | Laporan Keuangan
            </span>
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="px-2 sm:px-3 py-1.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg text-xs sm:text-sm font-bold text-gray-700 dark:text-gray-200 outline-none focus:ring-2 focus:ring-amber-500 shadow-sm cursor-pointer"
          >
            <option value="hari">📅 Hari Ini</option>
            <option value="bulan">🗓️ Bulan Ini</option>
            <option value="tahun">📆 Tahun Ini</option>
            <option value="semua">📈 Semua</option>
          </select>
          <div className="h-5 w-px bg-gray-300 dark:bg-zinc-600 mx-0.5"></div>
          <ThemeToggle />
          <button
            onClick={logout}
            className="p-2 w-9 h-9 flex items-center justify-center text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-all shadow-sm"
            title="Keluar"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-5 h-5"
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

      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 custom-scrollbar">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="max-w-[1400px] mx-auto space-y-6 animate-fadeIn pb-10">
            {/* SECTION 1: GRAFIK VISUAL (DIPINDAH KE ATAS) */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* GRAFIK BAR DINAMIS */}
              <div className="lg:col-span-2 bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-gray-100 dark:border-zinc-700 shadow-sm flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
                  <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
                    Grafik Tren Omset ({filterText})
                  </h3>
                  <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded">
                    Total: Rp {(regOmset + poOmset).toLocaleString("id-ID")}
                  </span>
                </div>

                {/* Bungkus dengan overflow-x auto agar aman di layar HP jika harinya banyak */}
                <div className="w-full overflow-x-auto custom-scrollbar pb-2">
                  <div
                    className={`h-48 flex items-end justify-between gap-1 sm:gap-2 relative px-2 ${timeFilter === "bulan" ? "min-w-[600px]" : "min-w-full"}`}
                  >
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6 px-2">
                      <div className="border-t border-dashed border-gray-200 dark:border-zinc-700 w-full h-0"></div>
                      <div className="border-t border-dashed border-gray-200 dark:border-zinc-700 w-full h-0"></div>
                      <div className="border-t border-dashed border-gray-200 dark:border-zinc-700 w-full h-0"></div>
                    </div>

                    {chartLabels.map((label, i) => {
                      const omset = chartDataValues[i];
                      const heightPercent =
                        omset > 0
                          ? Math.max((omset / maxChartValue) * 100, 2)
                          : 0;
                      return (
                        <div
                          key={i}
                          className="flex flex-col items-center flex-1 z-10 group relative h-full justify-end"
                        >
                          <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 text-white text-[10px] py-1 px-2 rounded whitespace-nowrap z-20 shadow-lg">
                            Rp {omset.toLocaleString("id-ID")}
                          </div>
                          <div
                            className={`w-full max-w-[28px] bg-amber-400 hover:bg-amber-500 dark:bg-amber-500 dark:hover:bg-amber-400 rounded-t-sm transition-all duration-500 ease-out`}
                            style={{ height: `${heightPercent}%` }}
                          ></div>
                          <span className="text-[9px] font-semibold text-gray-500 mt-2 text-center whitespace-nowrap">
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* PIE CHART (DONUT) SUMBER OMSET */}
              <div className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-gray-100 dark:border-zinc-700 shadow-sm flex flex-col justify-between items-center text-center">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 w-full text-left mb-4">
                  Distribusi Omset
                </h3>

                {/* Visual Donut Chart Menggunakan CSS Biasa */}
                <div
                  className="relative w-36 h-36 rounded-full flex items-center justify-center shadow-inner"
                  style={{ background: pieGradient }}
                >
                  {/* Lubang Donut di Tengah */}
                  <div className="w-24 h-24 bg-white dark:bg-zinc-800 rounded-full flex flex-col items-center justify-center shadow-[inset_0_0_10px_rgba(0,0,0,0.1)]">
                    <span className="text-xs text-gray-500 font-bold">
                      Total Omset
                    </span>
                    <span className="text-[10px] font-black text-gray-800 dark:text-gray-200">
                      100%
                    </span>
                  </div>
                </div>

                <div className="w-full mt-6 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2 font-semibold text-gray-700 dark:text-gray-300">
                      <span className="w-3 h-3 rounded-full bg-amber-500"></span>{" "}
                      Toko (Reguler)
                    </div>
                    <span className="font-bold text-amber-600 dark:text-amber-500">
                      {totalOmsetPie === 0 ? "0%" : regPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2 font-semibold text-gray-700 dark:text-gray-300">
                      <span className="w-3 h-3 rounded-full bg-blue-500"></span>{" "}
                      Pre-Order (PO)
                    </div>
                    <span className="font-bold text-blue-600 dark:text-blue-500">
                      {totalOmsetPie === 0 ? "0%" : (100 - regPct).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 2: METODE PEMBAYARAN */}
            <section>
              <h2 className="text-[13px] font-black text-purple-700 dark:text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                <span>💳</span> Rekap Pembayaran Keseluruhan
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-gray-100 dark:border-zinc-700 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                      Tunai (Cash)
                    </p>
                    <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                      Rp {tunai.toLocaleString("id-ID")}
                    </h3>
                  </div>
                  <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 flex items-center justify-center rounded-xl text-2xl">
                    💵
                  </div>
                </div>
                <div className="bg-white dark:bg-zinc-800 p-5 rounded-2xl border border-gray-100 dark:border-zinc-700 shadow-sm flex justify-between items-center">
                  <div>
                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                      QRIS / Transfer
                    </p>
                    <h3 className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                      Rp {qris.toLocaleString("id-ID")}
                    </h3>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center rounded-xl text-2xl">
                    📱
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 3: RINGKASAN REGULER & PO */}
            <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* REGULER */}
              <div>
                <h2 className="text-[13px] font-black text-amber-700 dark:text-amber-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span>🛍️</span> Omset Toko (Reguler)
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700 shadow-sm">
                    <p className="text-[11px] font-semibold text-gray-500">
                      Omset Kotor
                    </p>
                    <h3 className="text-lg font-black text-gray-800 dark:text-gray-100">
                      Rp {regOmset.toLocaleString("id-ID")}
                    </h3>
                  </div>
                  <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700 shadow-sm">
                    <p className="text-[11px] font-semibold text-gray-500">
                      HPP (Modal)
                    </p>
                    <h3 className="text-lg font-black text-red-600 dark:text-red-400">
                      Rp {regHpp.toLocaleString("id-ID")}
                    </h3>
                  </div>
                  <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700 shadow-sm">
                    <p className="text-[11px] font-semibold text-gray-500">
                      Overhead 20%
                    </p>
                    <h3 className="text-lg font-black text-amber-600 dark:text-amber-500">
                      Rp {regOverhead.toLocaleString("id-ID")}
                    </h3>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
                    <p className="text-[11px] font-bold text-emerald-800 dark:text-emerald-400">
                      Laba Bersih
                    </p>
                    <h3 className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                      Rp {regLabaBersih.toLocaleString("id-ID")}
                    </h3>
                  </div>
                </div>
              </div>

              {/* PRE-ORDER */}
              <div>
                <h2 className="text-[13px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span>📦</span> Omset Pre-Order (PO)
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700 shadow-sm">
                    <p className="text-[11px] font-semibold text-gray-500">
                      Omset Kotor
                    </p>
                    <h3 className="text-lg font-black text-gray-800 dark:text-gray-100">
                      Rp {poOmset.toLocaleString("id-ID")}
                    </h3>
                  </div>
                  <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700 shadow-sm">
                    <p className="text-[11px] font-semibold text-gray-500">
                      HPP (Modal)
                    </p>
                    <h3 className="text-lg font-black text-red-600 dark:text-red-400">
                      Rp {poHpp.toLocaleString("id-ID")}
                    </h3>
                  </div>
                  <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-gray-100 dark:border-zinc-700 shadow-sm">
                    <p className="text-[11px] font-semibold text-gray-500">
                      Overhead 20%
                    </p>
                    <h3 className="text-lg font-black text-amber-600 dark:text-amber-500">
                      Rp {poOverhead.toLocaleString("id-ID")}
                    </h3>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-100 dark:border-blue-800/50 shadow-sm">
                    <p className="text-[11px] font-bold text-blue-800 dark:text-blue-400">
                      Laba Bersih
                    </p>
                    <h3 className="text-lg font-black text-blue-600 dark:text-blue-500">
                      Rp {poLabaBersih.toLocaleString("id-ID")}
                    </h3>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 4: TRX TERBARU */}
            <section className="bg-white dark:bg-zinc-800 p-6 rounded-2xl border border-gray-100 dark:border-zinc-700 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
                  5 Transaksi Terakhir
                </h3>
                <a
                  href="/laporan"
                  className="text-[11px] font-bold text-amber-600 hover:text-amber-700"
                >
                  Lihat Semua di Buku Besar &rarr;
                </a>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {recentTransactions.length === 0 ? (
                  <p className="text-xs text-gray-500 col-span-5 text-center py-4">
                    Belum ada transaksi.
                  </p>
                ) : (
                  recentTransactions.map((trx, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col justify-center p-3 bg-gray-50 dark:bg-zinc-900/50 rounded-xl border border-gray-100 dark:border-zinc-700"
                    >
                      <p className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        {trx.kode_trx}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {new Date(trx.created_at).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-sm mt-2 font-black text-emerald-600 dark:text-emerald-400">
                        Rp {trx.total_omset.toLocaleString("id-ID")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
