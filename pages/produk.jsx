import { useState, useEffect, useContext } from "react";
import ThemeToggle from "../components/ThemeToggle";
import { supabase } from "../lib/supabase";
import { AuthContext } from "../context/AuthContext";
import { ProductContext } from "../context/ProductContext";

export default function ProdukPage() {
  const { logout } = useContext(AuthContext);
  const { products, fetchProducts, isLoading } = useContext(ProductContext);

  // === STATE KATEGORI & PENJUALAN ===
  const [categories, setCategories] = useState([]);
  const [salesData, setSalesData] = useState({});
  const [expandedCategories, setExpandedCategories] = useState([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ id: null, nama: "" });

  // === STATE PRODUK ===
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    stock: "",
    modalBahan: "",
    biayaKemasan: "",
    foto: "",
    jenis: "Produksi Sendiri",
    hargaAwal: "",
    kategori_id: "",
  });
  const [searchTerm, setSearchTerm] = useState("");

  // --- FUNGSI AMBIL DATA KATEGORI & PENJUALAN ---
  const fetchDashboardData = async () => {
    try {
      // 1. Ambil Kategori
      const { data: catData, error: catError } = await supabase
        .from("kategori")
        .select("*")
        .order("nama");
      if (catError) throw catError;
      if (catData) setCategories(catData);

      // 2. Ambil Detail Transaksi untuk hitung Laba & Terjual
      const { data: trxData, error: trxError } = await supabase
        .from("detail_transaksi")
        .select("*");
      if (trxError) throw trxError;

      const salesMap = {};
      if (trxData && products.length > 0) {
        trxData.forEach((trx) => {
          if (!salesMap[trx.produk_id])
            salesMap[trx.produk_id] = { qty: 0, profit: 0 };
          const p = products.find((prod) => prod.id === trx.produk_id);

          if (p) {
            salesMap[trx.produk_id].qty += trx.qty;
            if (p.jenis === "Titipan UMKM") {
              // Laba UMKM = Harga Jual - Harga Awal (Modal Titipan)
              salesMap[trx.produk_id].profit +=
                (trx.harga_jual_saat_ini - (p.harga_awal || 0)) * trx.qty;
            } else {
              // Laba Produksi Sendiri = (Harga Jual - HPP) potong Overhead 20%
              const labaKotor =
                (trx.harga_jual_saat_ini -
                  trx.hpp_bahan_saat_ini -
                  trx.hpp_kemasan_saat_ini) *
                trx.qty;
              salesMap[trx.produk_id].profit += labaKotor * 0.8;
            }
          }
        });
      }
      setSalesData(salesMap);
    } catch (error) {
      console.error("Gagal load data analitik:", error.message);
    }
  };

  // Panggil fetchDashboardData setiap kali products berubah (selesai diload)
  useEffect(() => {
    if (products.length > 0) {
      fetchDashboardData();
    }
  }, [products]);

  const toggleCategory = (catId) => {
    setExpandedCategories((prev) =>
      prev.includes(catId)
        ? prev.filter((id) => id !== catId)
        : [...prev, catId],
    );
  };

  // --- CRUD KATEGORI ---
  const handleSaveCategory = async (e) => {
    e.preventDefault();
    try {
      if (categoryForm.id) {
        await supabase
          .from("kategori")
          .update({ nama: categoryForm.nama })
          .eq("id", categoryForm.id);
      } else {
        await supabase.from("kategori").insert([{ nama: categoryForm.nama }]);
      }
      setCategoryForm({ id: null, nama: "" });
      fetchDashboardData();
    } catch (error) {
      alert("Gagal simpan kategori.");
    }
  };

  const handleDeleteCategory = async (id) => {
    if (
      window.confirm(
        "Yakin hapus kategori ini? Produk akan menjadi 'Tanpa Kategori'.",
      )
    ) {
      try {
        await supabase.from("kategori").delete().eq("id", id);
        fetchDashboardData();
        fetchProducts();
      } catch (error) {
        alert("Gagal hapus kategori.");
      }
    }
  };

  // --- CRUD PRODUK ---
  const openModal = (product = null) => {
    if (product) {
      setEditId(product.id);
      setFormData({
        name: product.name || product.nama,
        price: product.price || product.harga_jual,
        stock: product.stock || product.stok,
        modalBahan: product.modalBahan || product.modal_bahan || "",
        biayaKemasan: product.biayaKemasan || product.biaya_kemasan || "",
        foto: product.foto || "",
        jenis: product.jenis || "Produksi Sendiri",
        hargaAwal: product.harga_awal || "",
        kategori_id: product.kategori_id || "",
      });
    } else {
      setEditId(null);
      setFormData({
        name: "",
        price: "",
        stock: "",
        modalBahan: "",
        biayaKemasan: "",
        foto: "",
        jenis: "Produksi Sendiri",
        hargaAwal: "",
        kategori_id: "",
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        nama: formData.name,
        harga_jual: Number(formData.price),
        stok: Number(formData.stock),
        foto: formData.foto,
        jenis: formData.jenis,
        kategori_id: formData.kategori_id ? Number(formData.kategori_id) : null,
      };
      if (formData.jenis === "Titipan UMKM") {
        payload.harga_awal = Number(formData.hargaAwal);
        payload.modal_bahan = 0;
        payload.biaya_kemasan = 0;
      } else {
        payload.harga_awal = 0;
        payload.modal_bahan = Number(formData.modalBahan);
        payload.biaya_kemasan = Number(formData.biayaKemasan);
      }

      if (editId) {
        await supabase.from("produk").update(payload).eq("id", editId);
      } else {
        await supabase.from("produk").insert([payload]);
      }

      setIsModalOpen(false);
      fetchProducts();
    } catch (error) {
      alert("Gagal menyimpan produk.");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Yakin mau hapus produk ini?")) {
      await supabase.from("produk").delete().eq("id", id);
      fetchProducts();
    }
  };

  // --- PEMROSESAN DATA UNTUK RENDER ---
  const normalizedProducts = products.map((p) => ({
    ...p,
    normalizedName: p.name || p.nama || "",
    normalizedPrice: p.price || p.harga_jual || 0,
    normalizedStock: p.stock || p.stok || 0,
    terjual: salesData[p.id]?.qty || 0,
    labaBersih: salesData[p.id]?.profit || 0,
  }));

  const filteredProducts = normalizedProducts.filter((item) =>
    item.normalizedName.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Mengelompokkan produk ke dalam kategori
  const groupedData = [
    ...categories.map((cat) => ({
      id: cat.id,
      nama: cat.nama,
      products: filteredProducts.filter(
        (p) => String(p.kategori_id) === String(cat.id),
      ),
    })),
    {
      id: "uncategorized",
      nama: "Tanpa Kategori",
      products: filteredProducts.filter((p) => !p.kategori_id),
    },
  ].filter((group) => group.products.length > 0); // Sembunyikan kategori yang kosong/tidak cocok pencarian

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-[#FDFBF7] dark:bg-zinc-900 transition-colors duration-300">
      <nav className="bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 px-4 md:px-6 py-3 flex justify-between items-center shrink-0 shadow-sm dark:shadow-black/20 z-20 gap-2">
        <h1 className="ml-12 lg:ml-0 text-lg md:text-2xl font-bold text-amber-900 dark:text-amber-400 truncate">
          Toko Roti Amira
          <span className="hidden sm:inline text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
            | Analitik & Kelola Produk
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

      <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
        <main className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 pt-6 pb-20">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Performa Kategori & Produk
            </h2>
            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="flex-1 md:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm text-sm"
              >
                🗂️ Kelola Kategori
              </button>
              <button
                onClick={() => openModal()}
                className="flex-1 md:flex-none px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-sm text-sm"
              >
                + Tambah Produk
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700">
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                🔍
              </span>
              <input
                type="text"
                placeholder="Cari nama produk..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-amber-500 outline-none text-gray-800 dark:text-gray-200"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center p-10">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedData.length === 0 ? (
                <div className="p-8 text-center bg-white dark:bg-zinc-800 rounded-xl border border-gray-100 dark:border-zinc-700 text-gray-500">
                  Tidak ada produk yang cocok dengan pencarian.
                </div>
              ) : (
                groupedData.map((group) => {
                  const totalQty = group.products.reduce(
                    (sum, p) => sum + p.terjual,
                    0,
                  );
                  const totalProfit = group.products.reduce(
                    (sum, p) => sum + p.labaBersih,
                    0,
                  );
                  const isExpanded = expandedCategories.includes(group.id);

                  return (
                    <div
                      key={group.id}
                      className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 overflow-hidden"
                    >
                      {/* HEADER KATEGORI */}
                      <button
                        onClick={() => toggleCategory(group.id)}
                        className="w-full flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-gray-50 dark:bg-zinc-800/80 hover:bg-gray-100 dark:hover:bg-zinc-700/80 transition-colors text-left gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">
                            {isExpanded ? "📂" : "📁"}
                          </span>
                          <div>
                            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-lg">
                              {group.nama}
                            </h3>
                            <p className="text-xs text-gray-500">
                              {group.products.length} macam produk
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto bg-white dark:bg-zinc-900 px-4 py-2 rounded-xl border border-gray-200 dark:border-zinc-700">
                          <div>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                              Total Terjual
                            </p>
                            <p className="text-sm font-black text-gray-700 dark:text-gray-200">
                              {totalQty} pcs
                            </p>
                          </div>
                          <div className="w-px h-8 bg-gray-200 dark:bg-zinc-700"></div>
                          <div>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">
                              Total Laba Bersih
                            </p>
                            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                              Rp {totalProfit.toLocaleString("id-ID")}
                            </p>
                          </div>
                        </div>
                      </button>

                      {/* DAFTAR PRODUK (EXPANDED) */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 dark:border-zinc-700 overflow-x-auto">
                          <table className="w-full text-left border-collapse min-w-[900px] select-none">
                            <thead>
                              <tr className="bg-white dark:bg-zinc-900/30 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                                <th className="p-3 font-medium">Foto</th>
                                <th className="p-3 font-medium">Nama Produk</th>
                                <th className="p-3 font-medium">Harga Jual</th>
                                <th className="p-3 font-medium">Stok</th>
                                <th className="p-3 font-medium bg-emerald-50 dark:bg-emerald-900/10">
                                  Laku (pcs)
                                </th>
                                <th className="p-3 font-medium bg-emerald-50 dark:bg-emerald-900/10">
                                  Laba Bersih
                                </th>
                                <th className="p-3 font-medium text-center">
                                  Aksi
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                              {group.products.map((p) => (
                                <tr
                                  key={p.id}
                                  className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                                >
                                  <td className="p-3">
                                    {p.foto ? (
                                      <img
                                        src={p.foto}
                                        alt={p.normalizedName}
                                        className="w-10 h-10 object-cover rounded-lg border border-gray-200 dark:border-zinc-700 shadow-sm"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 bg-amber-50 dark:bg-zinc-700 rounded-lg flex items-center justify-center text-lg">
                                        🍞
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <p className="text-gray-800 dark:text-gray-100 font-bold text-sm">
                                      {p.normalizedName}
                                    </p>
                                    <span
                                      className={`inline-block mt-1 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-gray-300`}
                                    >
                                      {p.jenis || "Produksi Sendiri"}
                                    </span>
                                  </td>
                                  <td className="p-3 font-semibold text-gray-700 dark:text-gray-300 text-sm">
                                    Rp{" "}
                                    {p.normalizedPrice.toLocaleString("id-ID")}
                                  </td>
                                  <td className="p-3">
                                    <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400 text-xs font-bold rounded">
                                      {p.normalizedStock}
                                    </span>
                                  </td>
                                  <td className="p-3 font-black text-gray-700 dark:text-gray-200 bg-emerald-50/50 dark:bg-emerald-900/5 text-sm">
                                    {p.terjual}
                                  </td>
                                  <td className="p-3 font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-900/5 text-sm">
                                    Rp {p.labaBersih.toLocaleString("id-ID")}
                                  </td>
                                  <td className="p-3 flex justify-center gap-2">
                                    <button
                                      onClick={() => openModal(p)}
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={() => handleDelete(p.id)}
                                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                                    >
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </main>
      </div>

      {/* MODAL 1: KELOLA KATEGORI */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-zinc-700 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-4 border-b border-gray-100 dark:border-zinc-700 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">
                🗂️ Manajemen Kategori
              </h3>
              <button
                onClick={() => setIsCategoryModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
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

            <div className="p-4 border-b border-gray-100 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900/50 shrink-0">
              <form onSubmit={handleSaveCategory} className="flex gap-2">
                <input
                  type="text"
                  required
                  placeholder="Nama Kategori Baru..."
                  value={categoryForm.nama}
                  onChange={(e) =>
                    setCategoryForm({ ...categoryForm, nama: e.target.value })
                  }
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg"
                >
                  {categoryForm.id ? "Update" : "Tambah"}
                </button>
                {categoryForm.id && (
                  <button
                    type="button"
                    onClick={() => setCategoryForm({ id: null, nama: "" })}
                    className="px-3 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 font-bold text-sm rounded-lg"
                  >
                    Batal
                  </button>
                )}
              </form>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <ul className="space-y-2">
                {categories.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-4">
                    Belum ada kategori.
                  </p>
                ) : (
                  categories.map((cat) => (
                    <li
                      key={cat.id}
                      className="flex justify-between items-center p-3 bg-white dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-xl shadow-sm"
                    >
                      <span className="font-semibold text-gray-700 dark:text-gray-200 text-sm">
                        {cat.nama}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setCategoryForm(cat)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(cat.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                        >
                          🗑️
                        </button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: TAMBAH / EDIT PRODUK */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl w-full max-w-lg border border-gray-100 dark:border-zinc-700 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 dark:border-zinc-700 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">
                {editId ? "Edit Produk" : "Tambah Produk"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
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

            <div className="overflow-y-auto p-4 custom-scrollbar">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-6 mb-2 p-3 bg-gray-50 dark:bg-zinc-900/50 rounded-xl border border-gray-200 dark:border-zinc-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="jenis"
                      value="Produksi Sendiri"
                      checked={formData.jenis === "Produksi Sendiri"}
                      onChange={(e) =>
                        setFormData({ ...formData, jenis: e.target.value })
                      }
                      className="w-4 h-4 text-amber-600"
                    />
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      🍞 Produksi Sendiri
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="jenis"
                      value="Titipan UMKM"
                      checked={formData.jenis === "Titipan UMKM"}
                      onChange={(e) =>
                        setFormData({ ...formData, jenis: e.target.value })
                      }
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm font-bold text-gray-700 dark:text-gray-300">
                      📦 Titipan UMKM
                    </span>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nama Produk
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white outline-none"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Kategori Produk
                    </label>
                    <select
                      value={formData.kategori_id}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          kategori_id: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white outline-none"
                    >
                      <option value="">-- Pilih Kategori (Opsional) --</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.nama}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    URL Foto Produk
                  </label>
                  <input
                    type="url"
                    value={formData.foto}
                    onChange={(e) =>
                      setFormData({ ...formData, foto: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white outline-none text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Harga Jual (Rp)
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.price}
                      onChange={(e) =>
                        setFormData({ ...formData, price: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Stok Awal
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.stock}
                      onChange={(e) =>
                        setFormData({ ...formData, stock: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white outline-none"
                    />
                  </div>
                </div>
                {formData.jenis === "Produksi Sendiri" ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Modal Bahan (Rp)
                      </label>
                      <input
                        type="number"
                        required
                        value={formData.modalBahan}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            modalBahan: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Biaya Kemasan (Rp)
                      </label>
                      <input
                        type="number"
                        required
                        value={formData.biayaKemasan}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            biayaKemasan: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Harga Awal / Modal Titipan (Rp)
                    </label>
                    <input
                      type="number"
                      required
                      value={formData.hargaAwal}
                      onChange={(e) =>
                        setFormData({ ...formData, hargaAwal: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-gray-900 dark:text-white outline-none"
                    />
                  </div>
                )}
                <div className="pt-4 flex gap-3 sticky bottom-0 bg-white dark:bg-zinc-800 py-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 font-semibold rounded-lg"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg"
                  >
                    Simpan Produk
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
