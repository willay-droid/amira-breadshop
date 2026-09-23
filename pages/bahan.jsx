import { useState, useEffect, useContext } from "react";
import ThemeToggle from "../components/ThemeToggle";
import { supabase } from "../lib/supabase";
import { AuthContext } from "../context/AuthContext";

export default function BahanPage() {
  const { logout } = useContext(AuthContext);
  const [materials, setMaterials] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "Bahan Baku",
    cost: "",
  });

  // State untuk Search, Sort, & Pagination
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "id", direction: "asc" });
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchMaterials = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("bahan")
        .select("*")
        .order("id", { ascending: true });

      if (error) throw error;

      if (data) {
        const formattedData = data.map((m) => ({
          id: m.id,
          name: m.nama,
          type: m.tipe,
          cost: m.biaya,
        }));
        setMaterials(formattedData);
      }
    } catch (error) {
      console.error("Gagal menarik data bahan:", error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const openModal = (material = null) => {
    if (material) {
      setEditId(material.id);
      setFormData({
        name: material.name,
        type: material.type,
        cost: material.cost,
      });
    } else {
      setEditId(null);
      setFormData({ name: "", type: "Bahan Baku", cost: "" });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => setIsModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editId) {
        const { error } = await supabase
          .from("bahan")
          .update({
            nama: formData.name,
            tipe: formData.type,
            biaya: Number(formData.cost),
          })
          .eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bahan").insert([
          {
            nama: formData.name,
            tipe: formData.type,
            biaya: Number(formData.cost),
          },
        ]);
        if (error) throw error;
      }
      closeModal();
      fetchMaterials();
    } catch (error) {
      alert("Gagal menyimpan data: " + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Yakin mau hapus data ini?")) {
      try {
        const { error } = await supabase.from("bahan").delete().eq("id", id);
        if (error) throw error;
        fetchMaterials();
      } catch (error) {
        alert("Gagal menghapus data: " + error.message);
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

  // Filter & Sort Data
  const filteredData = materials.filter(
    (m) =>
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.type.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const sortedData = [...filteredData].sort((a, b) => {
    if (a[sortConfig.key] < b[sortConfig.key])
      return sortConfig.direction === "asc" ? -1 : 1;
    if (a[sortConfig.key] > b[sortConfig.key])
      return sortConfig.direction === "asc" ? 1 : -1;
    return 0;
  });

  const bahanBakuList = sortedData.filter((m) => m.type === "Bahan Baku");
  const kemasanList = sortedData.filter((m) => m.type === "Kemasan");

  return (
    // PERBAIKAN: Set h-screen, flex-col, overflow-hidden
    <div className="h-screen flex flex-col overflow-hidden bg-[#FDFBF7] dark:bg-zinc-900 transition-colors duration-300">
      {/* Header Statis: shrink-0, shadow-md, z-20 */}
      <nav className="bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 px-4 md:px-6 py-3 flex justify-between items-center shrink-0 shadow-md dark:shadow-black/40 z-20 gap-2">
        <h1 className="ml-12 lg:ml-0 text-lg md:text-2xl font-bold text-amber-900 dark:text-amber-400 truncate">
          Toko Roti Amira
          <span className="hidden sm:inline text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
            | Kelola Master Data
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

      {/* PERBAIKAN: Kontainer scroll mandiri untuk area tabel bahan */}
      <div className="flex-1 overflow-y-auto w-full custom-scrollbar">
        <main className="p-4 md:p-6 max-w-5xl mx-auto space-y-6 pt-6 pb-20">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Master Data Bahan & Kemasan
            </h2>
            <button
              onClick={() => openModal()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg shadow-md text-sm"
            >
              + Tambah Data
            </button>
          </div>

          {/* Panel Kontrol Pencarian */}
          <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-700 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Cari Item atau Kategori
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Nama bahan/kemasan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-sm focus:ring-2 focus:ring-amber-500 outline-none text-gray-800 dark:text-gray-200"
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center p-10">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tabel Bahan Baku */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-orange-600 dark:text-orange-400 border-b border-gray-200 dark:border-zinc-700 pb-2">
                  📦 Bahan Baku
                </h3>
                <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 overflow-hidden">
                  <table className="w-full text-left border-collapse select-none">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-zinc-700 text-gray-500 dark:text-gray-400 text-sm">
                        <th
                          onClick={() => handleSort("name")}
                          className="p-4 font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700"
                        >
                          Nama Item {renderSortIcon("name")}
                        </th>
                        <th
                          onClick={() => handleSort("cost")}
                          className="p-4 font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700"
                        >
                          Biaya {renderSortIcon("cost")}
                        </th>
                        <th className="p-4 font-medium text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                      {bahanBakuList.length === 0 && (
                        <tr>
                          <td
                            colSpan="3"
                            className="p-4 text-center text-gray-400 text-sm"
                          >
                            Tidak ada bahan baku.
                          </td>
                        </tr>
                      )}
                      {bahanBakuList.map((m) => (
                        <tr
                          key={m.id}
                          className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                          <td className="p-4 text-gray-800 dark:text-gray-100 font-medium">
                            {m.name}
                          </td>
                          <td className="p-4 text-red-600 dark:text-red-400 font-bold">
                            Rp {m.cost.toLocaleString("id-ID")}
                          </td>
                          <td className="p-4 flex justify-center gap-2">
                            <button
                              onClick={() => openModal(m)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(m.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabel Kemasan */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-blue-600 dark:text-blue-400 border-b border-gray-200 dark:border-zinc-700 pb-2">
                  🛍️ Kemasan
                </h3>
                <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-700 overflow-hidden">
                  <table className="w-full text-left border-collapse select-none">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-100 dark:border-zinc-700 text-gray-500 dark:text-gray-400 text-sm">
                        <th
                          onClick={() => handleSort("name")}
                          className="p-4 font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700"
                        >
                          Nama Item {renderSortIcon("name")}
                        </th>
                        <th
                          onClick={() => handleSort("cost")}
                          className="p-4 font-medium cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-700"
                        >
                          Biaya {renderSortIcon("cost")}
                        </th>
                        <th className="p-4 font-medium text-center">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
                      {kemasanList.length === 0 && (
                        <tr>
                          <td
                            colSpan="3"
                            className="p-4 text-center text-gray-400 text-sm"
                          >
                            Tidak ada kemasan.
                          </td>
                        </tr>
                      )}
                      {kemasanList.map((m) => (
                        <tr
                          key={m.id}
                          className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                        >
                          <td className="p-4 text-gray-800 dark:text-gray-100 font-medium">
                            {m.name}
                          </td>
                          <td className="p-4 text-red-600 dark:text-red-400 font-bold">
                            Rp {m.cost.toLocaleString("id-ID")}
                          </td>
                          <td className="p-4 flex justify-center gap-2">
                            <button
                              onClick={() => openModal(m)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDelete(m.id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal Form */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 dark:border-zinc-700 overflow-hidden">
            <div className="p-4 border-b border-gray-100 dark:border-zinc-700 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">
                {editId ? "Edit Data" : "Tambah Data Baru"}
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
                  Kategori
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white outline-none"
                >
                  <option value="Bahan Baku">Bahan Baku</option>
                  <option value="Kemasan">Kemasan</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nama Item
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white outline-none"
                  placeholder="Misal: Plastik OPP..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Biaya per Satuan (Rp)
                </label>
                <input
                  type="number"
                  required
                  value={formData.cost}
                  onChange={(e) =>
                    setFormData({ ...formData, cost: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-white outline-none"
                  placeholder="Misal: 400"
                />
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
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
