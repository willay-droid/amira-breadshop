import { useState, useEffect, useContext } from "react";
import Head from "next/head";
import ThemeToggle from "../components/ThemeToggle";
import { AuthContext } from "../context/AuthContext";
import { ProductContext } from "../context/ProductContext";
import { supabase } from "../lib/supabase";

export default function KasirPage() {
  const { logout, user } = useContext(AuthContext);
  const { products, fetchProducts, isLoading } = useContext(ProductContext);

  const [cart, setCart] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [receiptData, setReceiptData] = useState(null);

  // State untuk Search, Pre-Order, & Popup Pembayaran
  const [searchProduct, setSearchProduct] = useState("");
  const [isPreOrder, setIsPreOrder] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pickupDate, setPickupDate] = useState("");

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [uangDiterima, setUangDiterima] = useState("");

  // State Khusus DP (Down Payment)
  const [nominalDP, setNominalDP] = useState("");

  // State Khusus Fitur Pelunasan PO
  const [unpaidPOs, setUnpaidPOs] = useState([]);
  const [showUnpaidModal, setShowUnpaidModal] = useState(false);

  // State Khusus Edit Stok Cepat oleh Kasir
  const [stockModal, setStockModal] = useState({
    isOpen: false,
    product: null,
    newStock: "",
  });

  // Ambil data PO yang belum lunas setiap kali komponen dimuat
  const fetchUnpaidPOs = async () => {
    try {
      const { data, error } = await supabase
        .from("transaksi")
        .select("*")
        .eq("status_pembayaran", "Belum Lunas")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setUnpaidPOs(data);
    } catch (error) {
      console.error("Gagal mengambil data PO belum lunas:", error.message);
    }
  };

  useEffect(() => {
    fetchUnpaidPOs();
  }, []);

  // Fungsi Aman untuk Pindah Mode (Mereset Keranjang jika perlu)
  const handleModeChange = (isPOMode) => {
    if (isPreOrder === isPOMode) return;
    if (cart.length > 0) {
      const confirmReset = window.confirm(
        "Pindah mode akan mereset daftar pesanan yang sedang diinput. Lanjutkan?",
      );
      if (!confirmReset) return;
    }
    setIsPreOrder(isPOMode);
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setPickupDate("");
    setSearchProduct("");
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchProduct.toLowerCase()),
  );

  const addToCart = (product) => {
    if (!isPreOrder && product.stock <= 0) {
      alert(
        "Stok harian habis! Gunakan mode Pre-Order jika ini pesanan khusus.",
      );
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        const newQty = existing.qty + 1;
        if (!isPreOrder && newQty > product.stock) {
          alert("Maksimal stok harian tercapai!");
          return prev;
        }
        return prev.map((item) =>
          item.id === product.id ? { ...item, qty: newQty } : item,
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const removeFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const updateQty = (productId, delta) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === productId) {
          const newQty = item.qty + delta;
          if (newQty > 0 && (isPreOrder || newQty <= item.stock))
            return { ...item, qty: newQty };
        }
        return item;
      }),
    );
  };

  const handleDirectQtyChange = (productId, value) => {
    const val = parseInt(value, 10);
    const product = products.find((p) => p.id === productId);
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === productId) {
          if (isNaN(val) || val <= 0) return { ...item, qty: 1 };
          if (!isPreOrder && product && val > product.stock) {
            alert(
              `Stok harian tidak mencukupi! Maksimal stok: ${product.stock}`,
            );
            return { ...item, qty: product.stock };
          }
          return { ...item, qty: val };
        }
        return item;
      }),
    );
  };

  const totalBelanja = cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0,
  );
  const finalDP =
    isPreOrder && nominalDP !== "" ? Number(nominalDP) : totalBelanja;
  const sisaTagihanCheckout = totalBelanja - finalDP;

  const handleProceedClick = () => {
    if (cart.length === 0) return;
    if (isPreOrder && (!customerName || !pickupDate)) {
      alert("Mohon isi Nama Pemesan dan Tanggal Pengambilan untuk Pre-Order!");
      return;
    }
    setPaymentMethod(null);
    setUangDiterima("");
    setNominalDP("");
    setShowPaymentModal(true);
  };

  const handleCheckout = async (method) => {
    setShowPaymentModal(false);
    setIsProcessing(true);

    try {
      const prefix = isPreOrder ? "PO" : "TRX";
      const kodeTrx = `${prefix}-${Date.now().toString().slice(-6)}`;
      const statusBayar = sisaTagihanCheckout > 0 ? "Belum Lunas" : "Lunas";

      const { data: trxData, error: trxError } = await supabase
        .from("transaksi")
        .insert([
          {
            kode_trx: kodeTrx,
            total_omset: totalBelanja,
            metode_pembayaran: method,
            nama_pelanggan: customerName || null,
            status_pembayaran: statusBayar,
            dp_dibayar: finalDP,
            sisa_tagihan: Math.max(0, sisaTagihanCheckout),
          },
        ])
        .select("id")
        .single();

      if (trxError) throw trxError;
      const transaksiId = trxData.id;

      for (const item of cart) {
        const { error: detailError } = await supabase
          .from("detail_transaksi")
          .insert([
            {
              transaksi_id: transaksiId,
              produk_id: item.id,
              qty: item.qty,
              harga_jual_saat_ini: item.price,
              hpp_bahan_saat_ini: item.modalBahan,
              hpp_kemasan_saat_ini: item.biayaKemasan,
            },
          ]);

        if (detailError) throw detailError;
        if (!isPreOrder) {
          const { error: stockError } = await supabase
            .from("produk")
            .update({ stok: item.stock - item.qty })
            .eq("id", item.id);
          if (stockError) throw stockError;
        }
      }

      setReceiptData({
        kode: kodeTrx,
        waktu: new Date().toLocaleString("id-ID"),
        items: [...cart],
        total: totalBelanja,
        kasir: user?.name || "Kasir",
        isPO: isPreOrder,
        pemesan: customerName || "-",
        telepon: customerPhone || "-",
        tglAmbil: pickupDate || "-",
        metodeBayar: method,
        dpDibayar: finalDP,
        sisaTagihan: Math.max(0, sisaTagihanCheckout),
        status: statusBayar,
        uangDiterima: method === "Cash" ? Number(uangDiterima) : 0,
      });

      setCart([]);
      setIsPreOrder(false);
      setCustomerName("");
      setCustomerPhone("");
      setPickupDate("");
      fetchProducts();
      fetchUnpaidPOs();
    } catch (error) {
      alert("Gagal memproses transaksi: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleLunasiPO = async (idTrx, sisaTagihan) => {
    if (
      window.confirm(
        `Yakin ingin melunasi sisa tagihan Rp ${sisaTagihan.toLocaleString("id-ID")} ini?`,
      )
    ) {
      try {
        const { error } = await supabase
          .from("transaksi")
          .update({ status_pembayaran: "Lunas", sisa_tagihan: 0 })
          .eq("id", idTrx);

        if (error) throw error;
        alert("Berhasil dilunasi!");
        fetchUnpaidPOs();
      } catch (err) {
        alert("Gagal melunasi: " + err.message);
      }
    }
  };

  // Fungsi Edit Stok Cepat oleh Kasir
  const openStockModal = (e, product) => {
    e.stopPropagation(); // Mencegah masuk ke keranjang saat tombol edit diklik
    setStockModal({ isOpen: true, product, newStock: product.stock });
  };

  const handleUpdateStock = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from("produk")
        .update({ stok: Number(stockModal.newStock) })
        .eq("id", stockModal.product.id);

      if (error) throw error;
      fetchProducts(); // Refresh data produk secara real-time
      setStockModal({ isOpen: false, product: null, newStock: "" });
    } catch (err) {
      alert("Gagal mengupdate stok: " + err.message);
    }
  };

  const handlePrint = () => window.print();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF7] dark:bg-zinc-900">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden bg-[#FDFBF7] dark:bg-zinc-900 flex font-sans">
      <Head>
        <title>POS Kasir - Toko Roti Amira</title>
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #printable-receipt, #printable-receipt * { visibility: visible; }
            #printable-receipt { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; color: black !important; }
            .no-print { display: none !important; }
          }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
          .dark ::-webkit-scrollbar-thumb { background: #3f3f46; }
        `}</style>
      </Head>

      {/* SIDEBAR KIRI */}
      <aside className="w-64 bg-white dark:bg-zinc-800 border-r border-gray-200 dark:border-zinc-700 hidden md:flex flex-col shrink-0 z-30 shadow-[4px_0_24px_rgba(0,0,0,0.02)] dark:shadow-black/20">
        <div className="h-[68px] flex items-center px-6 border-b border-gray-200 dark:border-zinc-700 shrink-0">
          <span className="text-2xl mr-2">🥐</span>
          <h1 className="text-xl font-bold text-amber-900 dark:text-amber-400 truncate">
            Kasir Amira
          </h1>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
          <div className="mb-6">
            <div className="px-3 mb-3 flex items-center justify-between text-gray-500 dark:text-gray-400">
              <span className="text-[11px] font-bold uppercase tracking-wider">
                Menu Transaksi
              </span>
              <span className="text-[10px]">▼</span>
            </div>
            <div className="space-y-1 pl-1">
              <button
                onClick={() => handleModeChange(false)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl font-semibold text-sm transition-all ${
                  !isPreOrder
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-400 shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-700"
                }`}
              >
                <span className="text-lg">🏪</span> Pembelian Toko
              </button>
              <button
                onClick={() => handleModeChange(true)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl font-semibold text-sm transition-all ${
                  isPreOrder
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-400 shadow-sm"
                    : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-700"
                }`}
              >
                <span className="text-lg">📦</span> Pemesanan PO
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* AREA KANAN */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <nav className="bg-white dark:bg-zinc-800 border-b border-gray-200 dark:border-zinc-700 px-4 md:px-6 h-[68px] flex justify-between items-center z-20 shrink-0 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 hidden sm:block">
              {isPreOrder
                ? "📦 Mode Pemesanan Pre-Order"
                : "🏪 Mode Pembelian Reguler"}
            </h2>
          </div>
          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            <button
              onClick={() => setShowUnpaidModal(true)}
              className="relative p-2 w-10 h-10 flex items-center justify-center text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-700 rounded-lg transition-all shadow-sm bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700"
              title="Daftar PO Belum Lunas"
            >
              <span className="text-xl">📋</span>
              {unpaidPOs.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center shadow-md animate-bounce border-2 border-white dark:border-zinc-800">
                  {unpaidPOs.length}
                </span>
              )}
            </button>
            <div className="h-6 w-px bg-gray-300 dark:bg-zinc-600 mx-1"></div>
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

        <div className="flex flex-1 overflow-hidden bg-gray-50 dark:bg-zinc-900/50">
          <main className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-4 relative custom-scrollbar">
            <div className="bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md p-3 rounded-xl shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_30px_rgba(0,0,0,0.6)] border border-gray-200/50 dark:border-zinc-700/50 flex items-center gap-3 shrink-0 sticky top-0 z-20">
              <span className="text-gray-400 pl-2">🔍</span>
              <input
                type="text"
                placeholder="Cari nama roti cepat..."
                value={searchProduct}
                onChange={(e) => setSearchProduct(e.target.value)}
                className="w-full bg-transparent text-sm outline-none text-gray-800 dark:text-gray-100 placeholder-gray-400"
              />
              {searchProduct && (
                <button
                  onClick={() => setSearchProduct("")}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-6">
              {filteredProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className={`bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-sm border cursor-pointer ${
                    !isPreOrder && p.stock <= 0
                      ? "border-red-200 opacity-60"
                      : "border-gray-100 hover:border-amber-400 dark:border-zinc-700 dark:hover:border-amber-500"
                  } transition-all text-left group relative overflow-hidden flex flex-col`}
                >
                  <div className="aspect-square bg-amber-50 dark:bg-zinc-700 w-full rounded-xl mb-3 flex items-center justify-center text-4xl group-hover:scale-105 transition-transform pointer-events-none">
                    🍞
                  </div>
                  <div className="flex-1 flex flex-col justify-between w-full">
                    <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm md:text-base line-clamp-2">
                      {p.name}
                    </h3>
                    <div className="mt-2">
                      <p className="text-amber-600 dark:text-amber-500 font-bold">
                        Rp {p.price.toLocaleString("id-ID")}
                      </p>

                      {/* PERBAIKAN: Tombol Edit Stok disisipkan tanpa mengganggu klik keranjang */}
                      <div className="mt-1 flex justify-between items-center">
                        {/* PERBAIKAN: Tombol Edit Stok disisipkan tanpa mengganggu klik keranjang */}
                        <div className="mt-1 flex justify-between items-center w-full">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                              Stok: {p.stock}
                            </span>
                            {!isPreOrder && p.stock <= 0 && (
                              <span className="text-xs text-red-500 font-bold ml-1">
                                Habis
                              </span>
                            )}
                          </div>
                          <button
                            onClick={(e) => openStockModal(e, p)}
                            className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 rounded text-[10px] font-bold text-amber-700 dark:text-amber-400 transition-colors"
                          >
                            EDIT
                          </button>
                        </div>
                        {!isPreOrder && p.stock <= 0 && (
                          <span className="text-xs text-red-500 font-bold">
                            Habis
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </main>

          {/* KERANJANG KANAN */}
          <aside className="w-80 lg:w-96 bg-white dark:bg-zinc-800 border-l border-gray-200 dark:border-zinc-700 flex flex-col shadow-xl z-20 shrink-0">
            <div className="p-4 border-b border-gray-200 dark:border-zinc-700 space-y-3 shrink-0">
              <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                Detail Pesanan
              </h2>
              {isPreOrder ? (
                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-xl border border-blue-200 dark:border-blue-800">
                  <p className="text-xs font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                    <span>📦</span> Mode Pesanan PO Aktif
                  </p>
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">
                    Stok harian etalase tidak dipotong.
                  </p>
                </div>
              ) : (
                <div className="bg-emerald-50 dark:bg-emerald-900/30 p-3 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                    <span>🏪</span> Mode Reguler Aktif
                  </p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1">
                    Stok dipotong otomatis setelah lunas.
                  </p>
                </div>
              )}

              {isPreOrder && (
                <div className="space-y-2 pt-1 animate-fadeIn">
                  <input
                    type="text"
                    placeholder="Nama Pemesan / Acara *"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-xs outline-none text-gray-800 dark:text-gray-200"
                  />
                  <input
                    type="text"
                    placeholder="No. Telepon"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-xs outline-none text-gray-800 dark:text-gray-200"
                  />
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">
                      Tanggal Pengambilan *
                    </label>
                    <input
                      type="date"
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900 text-xs outline-none text-gray-800 dark:text-gray-200"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {cart.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  Belum ada pesanan
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-start gap-2"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-100 text-sm leading-tight">
                        {item.name}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Rp {item.price.toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 bg-gray-50 dark:bg-zinc-700 rounded-lg p-1 shrink-0">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="w-6 h-6 flex items-center justify-center bg-white dark:bg-zinc-600 rounded shadow-sm text-gray-600 dark:text-gray-200"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={item.qty}
                        onChange={(e) =>
                          handleDirectQtyChange(item.id, e.target.value)
                        }
                        className="w-10 text-center text-xs font-bold bg-transparent outline-none text-gray-800 dark:text-white"
                      />
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        disabled={!isPreOrder && item.qty >= item.stock}
                        className="w-6 h-6 flex items-center justify-center bg-white dark:bg-zinc-600 rounded shadow-sm text-gray-600 dark:text-gray-200 disabled:opacity-50"
                      >
                        +
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded dark:hover:bg-red-900/20 shrink-0"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
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
                ))
              )}
            </div>

            <div className="p-4 bg-gray-50 dark:bg-zinc-800/80 border-t border-gray-200 dark:border-zinc-700 shrink-0">
              <div className="flex justify-between items-center mb-4">
                <span className="text-gray-600 dark:text-gray-400 font-medium">
                  Total Tagihan:
                </span>
                <span className="text-2xl font-bold text-amber-600 dark:text-amber-500">
                  Rp {totalBelanja.toLocaleString("id-ID")}
                </span>
              </div>
              <button
                onClick={handleProceedClick}
                disabled={cart.length === 0 || isProcessing}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors shadow-lg flex justify-center items-center gap-2"
              >
                {isProcessing
                  ? "Memproses..."
                  : isPreOrder
                    ? "Lanjut Proses PO"
                    : "Lanjut Pembayaran"}
              </button>
            </div>
          </aside>
        </div>
      </div>

      {/* Modal Update Stok Cepat */}
      {stockModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-800 w-full max-w-xs rounded-2xl shadow-2xl p-6 border border-gray-100 dark:border-zinc-700 animate-fadeIn">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">
              Update Stok Cepat
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {stockModal.product?.name}
            </p>

            <form onSubmit={handleUpdateStock} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Jumlah Stok Saat Ini
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={stockModal.newStock}
                  onChange={(e) =>
                    setStockModal({ ...stockModal, newStock: e.target.value })
                  }
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-amber-500 font-bold text-xl text-center text-gray-800 dark:text-white"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setStockModal({
                      isOpen: false,
                      product: null,
                      newStock: "",
                    })
                  }
                  className="flex-1 py-2 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 rounded-xl font-semibold transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-colors shadow-md"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Popup Pilih Metode Pembayaran */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-800 w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center border border-gray-100 dark:border-zinc-700 animate-fadeIn max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">
              {paymentMethod === "Cash"
                ? "Pembayaran Tunai"
                : "Konfirmasi Pembayaran"}
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Total Tagihan:{" "}
              <span className="font-bold text-amber-600">
                Rp {totalBelanja.toLocaleString("id-ID")}
              </span>
            </p>

            {!paymentMethod ? (
              <div className="space-y-4">
                {isPreOrder && (
                  <div className="text-left bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl border border-amber-200 dark:border-amber-700/50">
                    <label className="block text-sm font-bold text-amber-900 dark:text-amber-400 mb-2">
                      Uang Muka / DP (Rp)
                    </label>
                    <input
                      type="number"
                      value={nominalDP}
                      onChange={(e) => setNominalDP(e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-amber-300 dark:border-amber-600 bg-white dark:bg-zinc-800 outline-none focus:ring-2 focus:ring-amber-500 font-bold"
                      placeholder="Kosongkan jika LUNAS"
                    />
                    {nominalDP && Number(nominalDP) < totalBelanja && (
                      <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400">
                        Sisa Kekurangan Nanti: Rp{" "}
                        {(totalBelanja - Number(nominalDP)).toLocaleString(
                          "id-ID",
                        )}
                      </p>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod("Cash")}
                    className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-300 font-bold flex flex-col items-center gap-2 transition-all shadow-sm"
                  >
                    <span className="text-3xl">💵</span>
                    <span>TUNAI</span>
                  </button>
                  <button
                    onClick={() => handleCheckout("QRIS")}
                    className="p-4 rounded-xl border-2 border-blue-500 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 text-blue-800 dark:text-blue-300 font-bold flex flex-col items-center gap-2 transition-all shadow-sm"
                  >
                    <span className="text-3xl">📱</span>
                    <span>QRIS</span>
                  </button>
                </div>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="w-full mt-2 py-2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 font-semibold"
                >
                  Batal Transaksi
                </button>
              </div>
            ) : (
              <div className="text-left space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Uang Tunai Diterima (Rp)
                  </label>
                  <input
                    type="number"
                    value={uangDiterima}
                    onChange={(e) => setUangDiterima(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-zinc-600 bg-gray-50 dark:bg-zinc-900 outline-none focus:ring-2 focus:ring-amber-500 font-bold text-lg"
                    placeholder="Misal: 100000"
                    autoFocus
                  />
                </div>
                {uangDiterima && Number(uangDiterima) >= finalDP ? (
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex justify-between items-center border border-emerald-200 dark:border-emerald-800">
                    <span className="text-sm font-bold text-emerald-800 dark:text-emerald-400">
                      Kembalian:
                    </span>
                    <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                      Rp{" "}
                      {(Number(uangDiterima) - finalDP).toLocaleString("id-ID")}
                    </span>
                  </div>
                ) : uangDiterima ? (
                  <p className="text-sm text-red-500 font-medium animate-pulse text-center">
                    ⚠️ Uang tunai kurang dari tagihan/DP!
                  </p>
                ) : null}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setPaymentMethod(null);
                      setUangDiterima("");
                    }}
                    className="flex-1 py-3 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 dark:bg-zinc-700 rounded-xl font-semibold transition-colors"
                  >
                    Kembali
                  </button>
                  <button
                    onClick={() => handleCheckout("Cash")}
                    disabled={!uangDiterima || Number(uangDiterima) < finalDP}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-xl font-bold transition-colors"
                  >
                    Selesaikan
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Daftar PO Belum Lunas */}
      {showUnpaidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-800 w-full max-w-2xl rounded-2xl shadow-2xl p-6 border border-gray-100 dark:border-zinc-700 animate-fadeIn max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-200 dark:border-zinc-700">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                📋 Daftar PO Belum Lunas
              </h3>
              <button
                onClick={() => setShowUnpaidModal(false)}
                className="text-gray-400 hover:text-red-500 text-xl font-bold"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {unpaidPOs.length === 0 ? (
                <p className="text-center text-gray-500 py-10">
                  Yeay! Semua pesanan PO sudah lunas bersih.
                </p>
              ) : (
                unpaidPOs.map((po) => (
                  <div
                    key={po.id}
                    className="bg-gray-50 dark:bg-zinc-900 p-4 rounded-xl border border-gray-200 dark:border-zinc-700 flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                  >
                    <div>
                      <p className="font-bold text-gray-800 dark:text-gray-100">
                        {po.kode_trx}{" "}
                        <span className="text-xs font-normal text-gray-500 bg-gray-200 dark:bg-zinc-700 px-2 py-0.5 rounded-full ml-1">
                          {new Date(po.created_at).toLocaleDateString("id-ID")}
                        </span>
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        Pemesan:{" "}
                        <span className="font-semibold text-gray-800 dark:text-gray-200">
                          {po.nama_pelanggan || "Tanpa Nama"}
                        </span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Total Tagihan: Rp{" "}
                        {po.total_omset.toLocaleString("id-ID")} | DP: Rp{" "}
                        {po.dp_dibayar.toLocaleString("id-ID")}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                      <div className="text-left md:text-right">
                        <p className="text-xs text-red-500 font-bold uppercase tracking-wider mb-1">
                          Sisa Kekurangan
                        </p>
                        <p className="text-lg font-black text-red-600 dark:text-red-400">
                          Rp {po.sisa_tagihan.toLocaleString("id-ID")}
                        </p>
                      </div>
                      <button
                        onClick={() => handleLunasiPO(po.id, po.sisa_tagihan)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-lg shadow-md transition-colors"
                      >
                        Lunasi
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Struk / Cetak Nota */}
      {receiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div
            id="printable-receipt"
            className="bg-white w-full max-w-sm rounded-xl shadow-2xl p-6 relative"
          >
            <button
              onClick={() => setReceiptData(null)}
              className="no-print absolute top-3 right-3 text-gray-400 hover:text-gray-700"
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
            <div className="text-center border-b border-dashed border-gray-300 pb-4 mb-4 text-black">
              <h2 className="text-xl font-bold">TOKO ROTI AMIRA</h2>
              <p className="text-xs text-gray-600 mt-1">
                Jl. Raya Sukses No. 123, Surabaya
              </p>
              <div className="mt-2 inline-block px-2 py-0.5 bg-gray-100 rounded text-xs font-bold uppercase">
                {receiptData.isPO
                  ? "*** NOTA PRE-ORDER / ACARA ***"
                  : "STRUK PENJUALAN"}
              </div>
              <div className="text-xs text-gray-500 mt-2 flex justify-between">
                <span>{receiptData.waktu}</span>
                <span>{receiptData.kode}</span>
              </div>
              {receiptData.isPO && (
                <div className="text-left text-xs bg-gray-50 p-2 rounded mt-2 space-y-1">
                  <p>
                    <strong>Pemesan:</strong> {receiptData.pemesan}
                  </p>
                  <p>
                    <strong>Telepon:</strong> {receiptData.telepon}
                  </p>
                  <p>
                    <strong>Tgl Ambil:</strong> {receiptData.tglAmbil}
                  </p>
                  <p
                    className={`mt-1 font-bold ${receiptData.status === "Lunas" ? "text-emerald-600" : "text-red-600"}`}
                  >
                    STATUS: {receiptData.status.toUpperCase()}
                  </p>
                </div>
              )}
            </div>
            <div className="space-y-3 mb-4 text-sm text-black max-h-60 overflow-y-auto">
              {receiptData.items.map((item, index) => (
                <div key={index} className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-gray-500">
                      {item.qty} x Rp {item.price.toLocaleString("id-ID")}
                    </p>
                  </div>
                  <p className="font-semibold mt-1">
                    Rp {(item.qty * item.price).toLocaleString("id-ID")}
                  </p>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-gray-300 pt-3 text-black">
              <div className="flex justify-between items-center font-bold text-lg mb-2">
                <span>Total Belanja</span>
                <span>Rp {receiptData.total.toLocaleString("id-ID")}</span>
              </div>
              {receiptData.isPO ? (
                <>
                  <div className="flex justify-between items-center text-sm mt-2 border-t border-gray-200 pt-2">
                    <span>DP / Dibayar di Muka</span>
                    <span>
                      Rp {receiptData.dpDibayar.toLocaleString("id-ID")}
                    </span>
                  </div>
                  {receiptData.sisaTagihan > 0 ? (
                    <div className="flex justify-between items-center text-sm font-bold mt-1 text-red-600">
                      <span>Sisa Kekurangan</span>
                      <span>
                        Rp {receiptData.sisaTagihan.toLocaleString("id-ID")}
                      </span>
                    </div>
                  ) : (
                    <div className="flex justify-between items-center text-sm font-bold mt-1 text-emerald-600">
                      <span>Sisa Kekurangan</span>
                      <span>LUNAS (Rp 0)</span>
                    </div>
                  )}
                  {receiptData.metodeBayar === "Cash" && (
                    <div className="flex justify-between items-center text-xs mt-3 pt-2 border-t border-dashed border-gray-200 text-gray-600">
                      <span>
                        Tunai Diberikan: Rp{" "}
                        {receiptData.uangDiterima.toLocaleString("id-ID")}
                      </span>
                      <span>
                        Kembalian: Rp{" "}
                        {(
                          receiptData.uangDiterima - receiptData.dpDibayar
                        ).toLocaleString("id-ID")}
                      </span>
                    </div>
                  )}
                </>
              ) : receiptData.metodeBayar === "Cash" ? (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span>Tunai</span>
                    <span>
                      Rp {receiptData.uangDiterima.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm font-bold mt-1 pt-1 border-t border-gray-200">
                    <span>Kembalian</span>
                    <span>
                      Rp{" "}
                      {(
                        receiptData.uangDiterima - receiptData.total
                      ).toLocaleString("id-ID")}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center text-sm">
                  <span>Pembayaran</span>
                  <span>QRIS (Lunas)</span>
                </div>
              )}
            </div>
            <div className="text-center mt-6 text-xs text-gray-500 text-black">
              <p>Kasir: {receiptData.kasir}</p>
              <p className="mt-1 font-medium">
                Terima Kasih Atas Kepercayaannya!
              </p>
            </div>
            <button
              onClick={handlePrint}
              className="no-print w-full mt-6 py-2 bg-gray-900 hover:bg-black text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              🖨️ Cetak Nota
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
