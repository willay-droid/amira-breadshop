import { useState, useEffect, useContext } from "react";
import Head from "next/head";
import ThemeToggle from "../components/ThemeToggle";
import { AuthContext } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function LaporanPage() {
  const { logout } = useContext(AuthContext);
  const [reportData, setReportData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // States untuk Filter
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [trxType, setTrxType] = useState("all"); // 'all', 'TRX', 'PO'
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Ambil data detail transaksi di-join dengan transaksi dan produk
  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.from("detail_transaksi").select(`
          id,
          qty,
          harga_jual_saat_ini,
          hpp_bahan_saat_ini,
          hpp_kemasan_saat_ini,
          transaksi:transaksi_id (kode_trx, created_at, metode_pembayaran, status_pembayaran, dp_dibayar, sisa_tagihan),
          produk:produk_id (nama, jenis, harga_awal)
        `);

      if (error) throw error;

      if (data) {
        // Format dan hitung kalkulasi laba
        const formatted = data.map((item) => {
          const t = item.transaksi;
          const p = item.produk || {};

          const isUMKM = p.jenis === "Titipan UMKM";
          const omsetKotor = item.qty * item.harga_jual_saat_ini;

          let totalHPP, hppBahan, hppKemasan, labaKotor, overhead, labaBersih;

          if (isUMKM) {
            // Produk Titipan: HPP diambil dari harga awal (modal titipan)
            totalHPP = item.qty * (p.harga_awal || 0);
            hppBahan = 0;
            hppKemasan = 0;
            labaKotor = omsetKotor - totalHPP;
            overhead = 0; // Tidak kena overhead operasional toko
            labaBersih = labaKotor;
          } else {
            // Produk Sendiri
            hppBahan = item.qty * item.hpp_bahan_saat_ini;
            hppKemasan = item.qty * item.hpp_kemasan_saat_ini;
            totalHPP = hppBahan + hppKemasan;
            labaKotor = omsetKotor - totalHPP;
            overhead = labaKotor * 0.2; // Overhead 20% dari Laba Kotor
            labaBersih = labaKotor - overhead;
          }

          return {
            id: item.id,
            kode_trx: t.kode_trx,
            tanggal: new Date(t.created_at),
            metode: t.metode_pembayaran,
            status_bayar: t.status_pembayaran,
            nama_produk: p.nama || "Produk Dihapus",
            jenis_produk: p.jenis || "Produksi Sendiri",
            qty: item.qty,
            harga_jual: item.harga_jual_saat_ini,
            omsetKotor,
            hppBahan,
            hppKemasan,
            totalHPP,
            labaKotor,
            overhead,
            labaBersih,
            isUMKM,
          };
        });

        // Urutkan dari yang terbaru
        formatted.sort((a, b) => b.tanggal - a.tanggal);
        setReportData(formatted);
      }
    } catch (error) {
      alert("Gagal memuat laporan: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Logika Filter Data
  const filteredData = reportData.filter((item) => {
    // 1. Filter Pencarian (Kode TRX atau Nama Produk)
    const matchSearch =
      item.kode_trx.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nama_produk.toLowerCase().includes(searchTerm.toLowerCase());

    // 2. Filter Jenis Transaksi (PO / Reguler)
    let matchType = true;
    if (trxType === "TRX") matchType = item.kode_trx.startsWith("TRX-");
    if (trxType === "PO") matchType = item.kode_trx.startsWith("PO-");

    // 3. Filter Rentang Tanggal
    let matchDate = true;
    if (startDate || endDate) {
      const itemDate = new Date(item.tanggal).setHours(0, 0, 0, 0);
      const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
      const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;

      if (start && end) matchDate = itemDate >= start && itemDate <= end;
      else if (start) matchDate = itemDate >= start;
      else if (end) matchDate = itemDate <= end;
    }

    return matchSearch && matchType && matchDate;
  });

  // Logika Pagination
  const limit =
    rowsPerPage === "all" ? filteredData.length : Number(rowsPerPage);
  const totalPages = Math.ceil(filteredData.length / limit) || 1;
  const paginatedData = filteredData.slice(
    (currentPage - 1) * limit,
    currentPage * limit,
  );

  // Fungsi Ekspor ke CSV
  const exportToCSV = () => {
    if (filteredData.length === 0)
      return alert("Tidak ada data untuk diekspor!");
    const headers = [
      "No. TRX",
      "Waktu",
      "Pembayaran",
      "Status Bayar",
      "Produk",
      "Jenis",
      "Qty",
      "Harga Satuan",
      "Omset Kotor",
      "HPP Bahan",
      "HPP Kemasan",
      "Total HPP",
      "Laba Kotor",
      "Overhead 20%",
      "Laba Bersih",
    ];
    const csvRows = [headers.join(",")];

    filteredData.forEach((row) => {
      const formattedDate = row.tanggal
        .toLocaleString("id-ID")
        .replace(/,/g, "");
      csvRows.push(
        [
          row.kode_trx,
          formattedDate,
          row.metode,
          row.status_bayar,
          `"${row.nama_produk}"`,
          row.jenis_produk,
          row.qty,
          row.harga_jual,
          row.omsetKotor,
          row.hppBahan,
          row.hppKemasan,
          row.totalHPP,
          row.labaKotor,
          row.overhead,
          row.labaBersih,
        ].join(","),
      );
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("hidden", "");
    a.setAttribute("href", url);
    a.setAttribute("download", `Laporan_Amira_${new Date().getTime()}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#FDFBF7] dark:bg-zinc-900 transition-colors duration-300">
      <Head>
        <title>Buku Besar - Toko Roti Amira</title>
      </Head>

      <nav className="bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 px-4 md:px-6 py-3 flex justify-between items-center shrink-0 shadow-sm dark:shadow-black/20 z-20 gap-2">
        <h1 className="ml-12 lg:ml-0 text-lg md:text-2xl font-bold text-amber-900 dark:text-amber-400 truncate">
          Toko Roti Amira{" "}
          <span className="hidden sm:inline text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
            | Buku Besar Laporan
          </span>
        </h1>
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <ThemeToggle />
          <button
            onClick={logout}
            className="p-2 w-10 h-10 flex items-center justify-center text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-all shadow-sm"
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

      <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
        <main className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6 pt-6 pb-20">
          {/* Header Action */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Buku Besar Transaksi
            </h2>
            <button
              onClick={exportToCSV}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm text-sm flex items-center gap-2 transition-colors"
            >
              <span>📥</span> Ekspor {filteredData.length} Data
            </button>
          </div>

          {/* Area Filter */}
          <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
            <div className="lg:col-span-1">
              <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                Cari Data
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="ID Transaksi / Produk..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-amber-500 outline-none text-gray-800 dark:text-gray-200"
                />
              </div>
            </div>

            {/* FITUR BARU: Filter Jenis Transaksi */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                Jenis Transaksi
              </label>
              <select
                value={trxType}
                onChange={(e) => {
                  setTrxType(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-amber-500 outline-none text-gray-800 dark:text-gray-200 font-semibold"
              >
                <option value="all">📝 Semua Transaksi</option>
                <option value="TRX">🏪 Reguler Toko (TRX)</option>
                <option value="PO">📦 Pre-Order (PO)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                Dari Tanggal
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-amber-500 outline-none text-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                Sampai Tanggal
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-amber-500 outline-none text-gray-800 dark:text-gray-200"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase tracking-wider">
                Tampilkan
              </label>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-amber-500 outline-none text-gray-800 dark:text-gray-200"
              >
                <option value={10}>10 Baris</option>
                <option value={50}>50 Baris</option>
                <option value="all">Semua Data</option>
              </select>
            </div>
          </div>

          {/* Tabel Buku Besar */}
          {isLoading ? (
            <div className="flex justify-center p-10">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-zinc-700 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                      <th className="p-4 font-bold">No. TRX & Waktu</th>
                      <th className="p-4 font-bold">Pembayaran</th>
                      <th className="p-4 font-bold">Produk & Qty</th>
                      <th className="p-4 font-bold">Omset Kotor</th>
                      <th className="p-4 font-bold">Detail HPP</th>
                      <th className="p-4 font-bold">Laba Kotor</th>
                      <th className="p-4 font-bold text-amber-600 dark:text-amber-500">
                        Overhead (20%)
                      </th>
                      <th className="p-4 font-bold text-emerald-600 dark:text-emerald-500">
                        Laba Bersih
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                    {paginatedData.length === 0 ? (
                      <tr>
                        <td
                          colSpan="8"
                          className="p-8 text-center text-gray-500"
                        >
                          Data laporan tidak ditemukan.
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((row) => (
                        <tr
                          key={row.id}
                          className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                          <td className="p-4">
                            <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">
                              {row.kode_trx}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {row.tanggal.toLocaleString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col items-start gap-1">
                              <span
                                className={`px-2 py-1 text-[10px] font-bold uppercase rounded-full ${row.metode === "QRIS" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}
                              >
                                {row.metode}
                              </span>
                              {row.kode_trx.startsWith("PO-") && (
                                <span
                                  className={`text-[10px] font-bold ${row.status_bayar === "Lunas" ? "text-emerald-600" : "text-red-500"}`}
                                >
                                  {row.status_bayar}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <p className="font-bold text-gray-800 dark:text-gray-100 text-sm">
                              {row.nama_produk}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {row.qty} pcs x Rp{" "}
                              {row.harga_jual.toLocaleString("id-ID")}
                            </p>
                          </td>
                          <td className="p-4 font-black text-gray-800 dark:text-gray-100">
                            Rp {row.omsetKotor.toLocaleString("id-ID")}
                          </td>
                          <td className="p-4">
                            <p className="font-bold text-red-600 dark:text-red-400 text-sm">
                              Rp {row.totalHPP.toLocaleString("id-ID")}
                            </p>
                            {row.isUMKM ? (
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                Modal UMKM
                              </p>
                            ) : (
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                Bhn: {(row.hppBahan / 1000).toFixed(0)}k | Kms:{" "}
                                {(row.hppKemasan / 1000).toFixed(1)}k
                              </p>
                            )}
                          </td>
                          <td className="p-4 font-semibold text-gray-700 dark:text-gray-300 text-sm">
                            Rp {row.labaKotor.toLocaleString("id-ID")}
                          </td>
                          <td className="p-4 font-semibold text-amber-600 dark:text-amber-500 text-sm">
                            {row.isUMKM
                              ? "-"
                              : `- Rp ${row.overhead.toLocaleString("id-ID")}`}
                          </td>
                          <td className="p-4 font-black text-emerald-600 dark:text-emerald-400">
                            Rp {row.labaBersih.toLocaleString("id-ID")}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-4 border-t border-gray-100 dark:border-zinc-700 flex justify-between items-center bg-gray-50 dark:bg-zinc-800">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Menampilkan{" "}
                  {paginatedData.length > 0 ? (currentPage - 1) * limit + 1 : 0}{" "}
                  - {Math.min(currentPage * limit, filteredData.length)} dari{" "}
                  {filteredData.length} data
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-sm font-medium disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <span className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Hal {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-sm font-medium disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
