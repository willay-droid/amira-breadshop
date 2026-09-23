import { useState, useEffect, useContext } from "react";
import ThemeToggle from "../components/ThemeToggle";
import { AuthContext } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function LaporanDetail() {
  const { logout } = useContext(AuthContext);

  const [ledgerData, setLedgerData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // State untuk Fitur Filter, Sort, & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "tanggal",
    direction: "desc",
  });
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchLedger = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from("detail_transaksi").select(`
            id, qty, harga_jual_saat_ini, hpp_bahan_saat_ini, hpp_kemasan_saat_ini,
            transaksi ( kode_trx, created_at ),
            produk ( nama )
          `);

        if (error) throw error;

        if (data) {
          const formatted = data.map((item) => {
            const hppPerPcs =
              item.hpp_bahan_saat_ini + item.hpp_kemasan_saat_ini;
            const omset = item.harga_jual_saat_ini * item.qty;
            const hppTotal = hppPerPcs * item.qty;
            const labaKotor = omset - hppTotal;
            const overhead = labaKotor * 0.2;
            const labaBersih = labaKotor - overhead;

            return {
              id: item.id,
              kode_trx: item.transaksi?.kode_trx || "-",
              tanggal: new Date(item.transaksi?.created_at || 0),
              nama_produk: item.produk?.nama || "Produk Dihapus",
              qty: item.qty,
              harga_jual: item.harga_jual_saat_ini,
              hpp_bahan: item.hpp_bahan_saat_ini,
              hpp_kemasan: item.hpp_kemasan_saat_ini,
              omset,
              hppTotal,
              labaKotor,
              overhead,
              labaBersih,
            };
          });

          setLedgerData(formatted);
        }
      } catch (error) {
        console.error("Gagal menarik data buku besar:", error.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLedger();
  }, []);

  // Kembalikan ke halaman 1 setiap kali filter atau search berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, startDate, endDate, rowsPerPage]);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key) => {
    if (sortConfig.key !== key)
      return <span className="text-gray-300 dark:text-zinc-600 ml-1">↕</span>;
    return sortConfig.direction === "asc" ? (
      <span className="text-amber-500 ml-1">↑</span>
    ) : (
      <span className="text-amber-500 ml-1">↓</span>
    );
  };

  // 1. Logika Filter (Search & Tanggal)
  const filteredData = ledgerData.filter((item) => {
    const matchSearch =
      item.kode_trx.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nama_produk.toLowerCase().includes(searchTerm.toLowerCase());

    let matchStartDate = true;
    let matchEndDate = true;

    if (startDate) {
      matchStartDate = item.tanggal >= new Date(`${startDate}T00:00:00`);
    }
    if (endDate) {
      matchEndDate = item.tanggal <= new Date(`${endDate}T23:59:59`);
    }

    return matchSearch && matchStartDate && matchEndDate;
  });

  // 2. Logika Sort
  const sortedData = [...filteredData].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key])
      return sortConfig.direction === "asc" ? -1 : 1;
    if (a[sortConfig.key] > b[sortConfig.key])
      return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  // 3. Logika Pagination
  const limit = rowsPerPage === "all" ? sortedData.length : Number(rowsPerPage);
  const totalPages = Math.ceil(sortedData.length / limit) || 1;
  const paginatedData = sortedData.slice(
    (currentPage - 1) * limit,
    currentPage * limit,
  );

  // Ekspor mengekspor data yang sudah difilter (bukan hanya halaman saat ini)
  const exportToCSV = () => {
    if (sortedData.length === 0) return alert("Tidak ada data untuk diekspor!");

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent +=
      "No TRX,Tanggal,Produk,Qty,Omset,HPP Total,Laba Kotor,Overhead,Laba Bersih\n";

    sortedData.forEach((row) => {
      const tanggalFormat = row.tanggal
        .toLocaleString("id-ID")
        .replace(/,/g, "");
      const baris = `${row.kode_trx},${tanggalFormat},${row.nama_produk},${row.qty},${row.omset},${row.hppTotal},${row.labaKotor},${row.overhead},${row.labaBersih}`;
      csvContent += baris + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Buku_Besar_Amira_${new Date().getTime()}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] dark:bg-zinc-900">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] dark:bg-zinc-900 transition-colors duration-300 pb-10">
      {/* Header */}
      <nav className="bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 px-4 md:px-6 py-3 flex justify-between items-center sticky top-0 z-10 gap-2">
        <h1 className="ml-12 lg:ml-0 text-lg md:text-2xl font-bold text-amber-900 dark:text-amber-400 truncate">
          Toko Roti Amira
          <span className="hidden sm:inline text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
            | Buku Besar Laporan
          </span>
        </h1>
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <ThemeToggle />
          <button
            onClick={logout}
            className="p-2 w-10 h-10 flex items-center justify-center text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-all shadow-sm"
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

      {/* Konten Utama */}
      <main className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 pt-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            Buku Besar Transaksi
          </h2>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors shadow-md text-sm whitespace-nowrap"
          >
            📥 Ekspor {sortedData.length} Data
          </button>
        </div>

        {/* Panel Filter Kontrol */}
        <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Cari Data
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                🔍
              </span>
              <input
                type="text"
                placeholder="ID Transaksi atau Produk..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-amber-500 outline-none text-gray-800 dark:text-gray-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Dari Tanggal
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-amber-500 outline-none text-gray-800 dark:text-gray-200"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Sampai Tanggal
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-amber-500 outline-none text-gray-800 dark:text-gray-200"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Tampilkan
            </label>
            <select
              value={rowsPerPage}
              onChange={(e) => setRowsPerPage(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-amber-500 outline-none text-gray-800 dark:text-gray-200"
            >
              <option value={10}>10 Baris</option>
              <option value={100}>100 Baris</option>
              <option value={1000}>1000 Baris</option>
              <option value="all">Semua Data</option>
            </select>
          </div>

          {(startDate || endDate || searchTerm) && (
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setSearchTerm("");
              }}
              className="px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Reset Filter
            </button>
          )}
        </div>

        {/* Tabel Data */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1000px] select-none">
              <thead>
                <tr className="bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-zinc-700 text-gray-500 dark:text-gray-400 text-sm">
                  <th
                    onClick={() => handleSort("tanggal")}
                    className="p-4 font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    No. TRX & Waktu {renderSortIcon("tanggal")}
                  </th>
                  <th
                    onClick={() => handleSort("nama_produk")}
                    className="p-4 font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Produk & Qty {renderSortIcon("nama_produk")}
                  </th>
                  <th
                    onClick={() => handleSort("omset")}
                    className="p-4 font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Omset Kotor {renderSortIcon("omset")}
                  </th>
                  <th
                    onClick={() => handleSort("hppTotal")}
                    className="p-4 font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Detail HPP {renderSortIcon("hppTotal")}
                  </th>
                  <th
                    onClick={() => handleSort("labaKotor")}
                    className="p-4 font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Laba Kotor {renderSortIcon("labaKotor")}
                  </th>
                  <th
                    onClick={() => handleSort("overhead")}
                    className="p-4 font-medium text-amber-600 dark:text-amber-500 cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Overhead (20%) {renderSortIcon("overhead")}
                  </th>
                  <th
                    onClick={() => handleSort("labaBersih")}
                    className="p-4 font-medium text-emerald-600 dark:text-emerald-500 cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Laba Bersih {renderSortIcon("labaBersih")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                {paginatedData.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-500">
                      Data tidak ditemukan.
                    </td>
                  </tr>
                ) : (
                  paginatedData.map((trx) => (
                    <tr
                      key={trx.id}
                      className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <td className="p-4">
                        <p className="font-bold text-gray-800 dark:text-gray-100">
                          {trx.kode_trx}
                        </p>
                        <p className="text-xs text-gray-500">
                          {trx.tanggal.toLocaleString("id-ID", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </td>
                      <td className="p-4">
                        <p className="font-semibold text-gray-800 dark:text-gray-100">
                          {trx.nama_produk}
                        </p>
                        <p className="text-xs text-gray-500">
                          {trx.qty} pcs x Rp{" "}
                          {trx.harga_jual.toLocaleString("id-ID")}
                        </p>
                      </td>
                      <td className="p-4 font-bold text-gray-800 dark:text-gray-100">
                        Rp {trx.omset.toLocaleString("id-ID")}
                      </td>
                      <td className="p-4">
                        <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                          Rp {trx.hppTotal.toLocaleString("id-ID")}
                        </p>
                        <p className="text-xs text-gray-500">
                          Bhn:{" "}
                          {(trx.hpp_bahan * trx.qty).toLocaleString("id-ID")} |
                          Kms:{" "}
                          {(trx.hpp_kemasan * trx.qty).toLocaleString("id-ID")}
                        </p>
                      </td>
                      <td className="p-4 font-semibold text-gray-700 dark:text-gray-300">
                        Rp {trx.labaKotor.toLocaleString("id-ID")}
                      </td>
                      <td className="p-4 font-semibold text-amber-600 dark:text-amber-500">
                        - Rp {trx.overhead.toLocaleString("id-ID")}
                      </td>
                      <td className="p-4 font-bold text-emerald-600 dark:text-emerald-400">
                        Rp {trx.labaBersih.toLocaleString("id-ID")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Navigasi Pagination */}
          <div className="p-4 border-t border-gray-100 dark:border-zinc-700 flex justify-between items-center bg-gray-50 dark:bg-zinc-800">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Menampilkan{" "}
              {paginatedData.length > 0 ? (currentPage - 1) * limit + 1 : 0} -{" "}
              {Math.min(currentPage * limit, sortedData.length)} dari{" "}
              {sortedData.length} data
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-zinc-600 transition-colors"
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
                className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-zinc-600 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
