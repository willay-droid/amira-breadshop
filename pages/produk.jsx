import { useState, useContext } from "react";
import ThemeToggle from "../components/ThemeToggle";
import { supabase } from "../lib/supabase";
import { AuthContext } from "../context/AuthContext";
import { ProductContext } from "../context/ProductContext";

export default function ProdukPage() {
  const { logout } = useContext(AuthContext);
  const { products, fetchProducts, isLoading } = useContext(ProductContext);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    stock: "",
    modalBahan: "",
    biayaKemasan: "",
    foto: "",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "asc" });
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const openModal = (product = null) => {
    if (product) {
      setEditId(product.id);
      setFormData({
        name: product.name,
        price: product.price,
        stock: product.stock,
        modalBahan: product.modalBahan,
        biayaKemasan: product.biayaKemasan,
        foto: product.foto || "",
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
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        nama: formData.name,
        harga_jual: Number(formData.price),
        stok: Number(formData.stock),
        modal_bahan: Number(formData.modalBahan),
        biaya_kemasan: Number(formData.biayaKemasan),
        foto: formData.foto,
      };

      if (editId) {
        const { error } = await supabase
          .from("produk")
          .update(payload)
          .eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("produk").insert([payload]);
        if (error) throw error;
      }

      closeModal();
      fetchProducts();
    } catch (error) {
      alert("Gagal menyimpan produk: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Yakin mau hapus produk ini?")) {
      try {
        const { error } = await supabase.from("produk").delete().eq("id", id);
        if (error) throw error;
        fetchProducts();
      } catch (error) {
        alert("Gagal menghapus produk: " + error.message);
      }
    }
  };

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

  const filteredData = products.filter((item) =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const sortedData = [...filteredData].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key])
      return sortConfig.direction === "asc" ? -1 : 1;
    if (a[sortConfig.key] > b[sortConfig.key])
      return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const limit = rowsPerPage === "all" ? sortedData.length : Number(rowsPerPage);
  const totalPages = Math.ceil(sortedData.length / limit) || 1;
  const paginatedData = sortedData.slice(
    (currentPage - 1) * limit,
    currentPage * limit,
  );

  return (
    // PERBAIKAN: Gunakan h-screen, flex-col, overflow-hidden agar fit layar
    <div className="h-screen flex flex-col overflow-hidden bg-[#FDFBF7] dark:bg-zinc-900 transition-colors duration-300">
      {/* Header Statis: shrink-0, shadow-md, z-20 */}
      <nav className="bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 px-4 md:px-6 py-3 flex justify-between items-center shrink-0 shadow-md dark:shadow-black/40 z-20 gap-2">
        <h1 className="ml-12 lg:ml-0 text-lg md:text-2xl font-bold text-amber-900 dark:text-amber-400 truncate">
          Toko Roti Amira
          <span className="hidden sm:inline text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
            | Kelola Produk
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

      {/* PERBAIKAN: Kontainer scroll mandiri untuk area tabel produk */}
      <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
        <main className="p-4 md:p-6 max-w-6xl mx-auto space-y-6 pt-6 pb-20">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Daftar Menu Roti
            </h2>
            <button
              onClick={() => openModal()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-md text-sm"
            >
              + Tambah Produk
            </button>
          </div>

          <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Cari Produk
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Nama produk..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-amber-500 outline-none text-gray-800 dark:text-gray-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Tampilkan
              </label>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-amber-500 outline-none text-gray-800 dark:text-gray-200"
              >
                <option value={10}>10 Baris</option>
                <option value={100}>100 Baris</option>
                <option value="all">Semua Data</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center p-10">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 overflow-hidden flex flex-col">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px] select-none">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-zinc-700 text-gray-500 dark:text-gray-400 text-sm">
                      <th className="p-4 font-medium">Foto</th>
                      <th
                        onClick={() => handleSort("name")}
                        className="p-4 font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700"
                      >
                        Nama Produk {renderSortIcon("name")}
                      </th>
                      <th
                        onClick={() => handleSort("price")}
                        className="p-4 font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700"
                      >
                        Harga Jual {renderSortIcon("price")}
                      </th>
                      <th
                        onClick={() => handleSort("stock")}
                        className="p-4 font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700"
                      >
                        Stok {renderSortIcon("stock")}
                      </th>
                      <th className="p-4 font-medium text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                    {paginatedData.length === 0 ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="p-8 text-center text-gray-500"
                        >
                          Data produk tidak ditemukan.
                        </td>
                      </tr>
                    ) : (
                      paginatedData.map((p) => (
                        <tr
                          key={p.id}
                          className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                          <td className="p-4">
                            {p.foto ? (
                              <img
                                src={p.foto}
                                alt={p.name}
                                className="w-12 h-12 object-cover rounded-xl border border-gray-200 dark:border-zinc-700 shadow-sm"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-amber-50 dark:bg-zinc-700 rounded-xl flex items-center justify-center text-xl">
                                🍞
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-gray-800 dark:text-gray-100 font-medium">
                            {p.name}
                          </td>
                          <td className="p-4 text-amber-600 dark:text-amber-500 font-bold">
                            Rp {p.price.toLocaleString("id-ID")}
                          </td>
                          <td className="p-4">
                            <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold rounded-full">
                              {p.stock} pcs
                            </span>
                          </td>
                          <td className="p-4 flex justify-center gap-2">
                            <button
                              onClick={() => openModal(p)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(p.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                            >
                              🗑️
                            </button>
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
                  - {Math.min(currentPage * limit, sortedData.length)} dari{" "}
                  {sortedData.length} data
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

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl w-full max-w-lg border border-gray-100 dark:border-zinc-700 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-zinc-700 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">
                {editId ? "Edit Produk" : "Tambah Produk"}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
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
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
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
                  placeholder="Misal: Roti Coklat Keju"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  URL Foto Produk (Opsional)
                </label>
                <input
                  type="url"
                  value={formData.foto}
                  onChange={(e) =>
                    setFormData({ ...formData, foto: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white outline-none text-xs"
                  placeholder="https://contoh.com/gambar-roti.jpg"
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
                      setFormData({ ...formData, modalBahan: e.target.value })
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
                      setFormData({ ...formData, biayaKemasan: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white outline-none"
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-2 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 text-gray-700 dark:text-gray-200 font-semibold rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-md"
                >
                  Simpan Produk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
